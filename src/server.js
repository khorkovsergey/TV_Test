/* =========================================================================
   Expert Marketplace — concierge MVP.

   Flow: request → AI brief → hard filter + ranking → booking
         → consultant notes → standardised summary (streamed).

   Deliberate pilot boundaries (not gaps):
   · no payments — a booking holds a slot, money is settled outside
   · no licence registry — consultant status is labelled unverified
   · the model gives no advice, it structures; disclaimers are added by the server
   ========================================================================= */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import {
  buildBrief, rankMatches, hardFilter, streamSummary,
  hasKey, MODEL, RefusalError
} from './claude.js';
import { ask as copilotAsk, MODEL as COPILOT_MODEL } from './copilot.js';
import * as market from './market.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '256kb' }));

/* ------------------------------------------------------------ home A/B test
   The task-based home is a hypothesis, so the machinery to run it as an
   experiment is here: a new visitor can be split 50/50 against the old promo
   home, and every analytics event carries the assignment.

   The split is OFF by default (HOME_AB=on turns it on). This stand is shown to
   people, not measured on traffic, and a coin flip at the front door means the
   person being shown the work can land on the control and conclude nothing
   shipped. With the split off, `/` always serves the task home and the control
   stays one `?home=classic` away — visible on demand, never in the way.

   Split server-side on purpose — deciding in the browser would either flash the
   wrong page first or block the first paint. The cookie is readable by scripts
   because the client has to stamp the same flag on its events. */
const PUBLIC = path.join(here, '..', 'public');
const HOME_PAGE = { task: 'index.html', classic: 'classic.html' };
const YEAR = 365 * 24 * 3600;
const HOME_AB = /^(1|on|true|yes)$/i.test(process.env.HOME_AB || '');

function readCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

app.get('/', (req, res) => {
  const jar = readCookies(req);
  const forced = HOME_PAGE[req.query.home] ? req.query.home : null;

  // Someone who has been here before keeps what they had; only a genuinely new
  // visitor is randomised, and returning visitors default to the control.
  // With the experiment off, an explicit ?home= still wins for one visit, but
  // nothing sticks a visitor to the control behind their back.
  const returning = jar.tv_seen === '1';
  const variant = forced
    || (HOME_AB
      ? ((HOME_PAGE[jar.home_variant] ? jar.home_variant : null)
         || (returning ? 'classic' : (Math.random() < 0.5 ? 'task' : 'classic')))
      : 'task');

  res.setHeader('Set-Cookie', [
    `home_variant=${variant}; Path=/; Max-Age=${YEAR}; SameSite=Lax`,
    `tv_seen=1; Path=/; Max-Age=${YEAR}; SameSite=Lax`
  ]);
  // A shared cache must never pin one variant for everyone.
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC, HOME_PAGE[variant]));
});

app.use(express.static(PUBLIC));

const PORT = process.env.PORT || 3000;
const STAFF_TOKEN = process.env.STAFF_TOKEN || '';

/* Minimal gate on the internal screens. Not a substitute for authentication —
   production would put SSO here; this keeps casual visitors out. */
function staffOnly(req, res, next) {
  if (!STAFF_TOKEN) return next();          // locally you may run without a token
  const given = req.get('x-staff-token') || req.query.token;
  if (given === STAFF_TOKEN) return next();
  res.status(401).json({ error: 'Staff token required' });
}

const wrap = fn => (req, res) => fn(req, res).catch(err => fail(res, err));

/* Claude Opus 5 rates: $5 / $25 per million tokens; cache reads ~0.1x and
   cache writes ~1.25x of the input rate. One place, used by both endpoints. */
function callCost(c) {
  return ((c.input_tokens  | 0) / 1e6) * 5
       + ((c.output_tokens | 0) / 1e6) * 25
       + ((c.cache_read    | 0) / 1e6) * 0.5
       + ((c.cache_write   | 0) / 1e6) * 6.25;
}
const tokensOf = c => (c.input_tokens | 0) + (c.output_tokens | 0) + (c.cache_read | 0) + (c.cache_write | 0);

function fail(res, err) {
  if (err instanceof RefusalError) {
    return res.status(422).json({
      error: 'The model declined this request under its safety policies',
      details: err.details || null
    });
  }
  if (err?.code === 'NO_KEY') {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY is not set on the server' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: err?.message || 'Internal error' });
}

/* ------------------------------------------------------------------ health */

/* Reports configuration state without leaking secrets: presence and token
   length, never values. Lets you verify a deploy without opening the dashboard. */
app.get('/api/health', wrap(async (_req, res) => {
  const problems = [];
  if (db.MODE === 'memory') problems.push('DATABASE_URL is not set: data will be lost on restart');
  if (!hasKey()) problems.push('ANTHROPIC_API_KEY is not set: AI steps will return 503');
  if (!STAFF_TOKEN) problems.push('STAFF_TOKEN is not set: consultant desk and metrics are open to anyone');
  else if (STAFF_TOKEN.length < 12) problems.push('STAFF_TOKEN is shorter than 12 characters — guessable');

  res.json({
    ok: problems.length === 0,
    storage: db.MODE,
    storage_note: db.MODE === 'memory'
      ? 'DATABASE_URL is not set — data will not survive a restart'
      : 'Postgres connected',
    ai: hasKey() ? 'ready' : 'ANTHROPIC_API_KEY is not set',
    model: MODEL,
    copilot_model: COPILOT_MODEL,
    home_ab: HOME_AB ? 'on — / is split 50/50 between the task home and the control'
                     : 'off — / always serves the task home; ?home=classic shows the control',
    staff_protected: Boolean(STAFF_TOKEN),
    problems,
    ready_for_pilot: problems.length === 0
  });
}));

/* ------------------------------------------------------- request and brief */

/* Must stay identical to the <select> on the request form and to
   CAPITAL_MIDPOINT in claude.js. */
const CAPITAL_BANDS = ['under $50k', '$50k-$250k', '$250k-$1M', 'over $1M', 'prefer not to say'];

app.post('/api/requests', wrap(async (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (!b.contact_name?.trim()) errors.push('Please enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contact_email || '')) errors.push('Please enter a valid email');
  if (!b.country?.trim()) errors.push('Please choose a country');
  if (!CAPITAL_BANDS.includes(b.capital_band)) errors.push('Please choose a capital range');
  if ((b.goal_text || '').trim().length < 40) errors.push('Tell us a little more — at least 40 characters');
  if (b.consent !== true) errors.push('Consent is required to share your context with a consultant');
  if (errors.length) return res.status(400).json({ errors });

  const request = {
    contact_name:  String(b.contact_name).trim().slice(0, 120),
    contact_email: String(b.contact_email).trim().slice(0, 200),
    country:       String(b.country).trim().slice(0, 4).toUpperCase(),
    language:      String(b.language || 'en').trim().slice(0, 5),
    capital_band:  b.capital_band,
    goal_text:     String(b.goal_text).trim().slice(0, 6000),
    consent:       true
  };

  const id = await db.createRequest(request);

  // The brief is built immediately: without it the consultant has nothing to read.
  let brief = null, briefError = null;
  try {
    brief = await buildBrief({ id, ...request });
  } catch (err) {
    briefError = err instanceof RefusalError
      ? 'The model declined this request under its safety policies'
      : (err?.code === 'NO_KEY' ? 'AI key is not configured on the server' : String(err?.message || err));
  }
  await db.setBrief(id, brief, briefError);

  res.status(201).json({ id, brief, brief_error: briefError });
}));

app.get('/api/requests/:id', wrap(async (req, res) => {
  const r = await db.getRequest(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  res.json(r);
}));

app.get('/api/requests', staffOnly, wrap(async (_req, res) => {
  res.json(await db.listRequests());
}));

/* ------------------------------------------------------------------- match */

app.post('/api/requests/:id/match', wrap(async (req, res) => {
  const request = await db.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const all = await db.listConsultants();
  const candidates = hardFilter(request, all);

  if (candidates.length === 0) {
    return res.json({
      ranked: [],
      note: 'No consultant cleared the hard filter on jurisdiction, language and capital range. ' +
            'The pilot roster is small, so this is an expected state rather than a failure.'
    });
  }

  const brief = typeof request.brief === 'string' ? JSON.parse(request.brief) : request.brief;
  const ranked = await rankMatches(request, brief, candidates);
  await db.saveMatches(request.id, ranked);

  const byId = new Map(all.map(c => [c.id, c]));
  res.json({
    ranked: ranked.map(m => ({ ...m, consultant: byId.get(m.consultant_id) })),
    filtered_out: all.length - candidates.length
  });
}));

app.get('/api/consultants', wrap(async (_req, res) => {
  res.json(await db.listConsultants());
}));

/* ----------------------------------------------------------------- booking */

app.post('/api/bookings', wrap(async (req, res) => {
  const { request_id, consultant_id, slot } = req.body || {};
  if (!request_id || !consultant_id || !slot) {
    return res.status(400).json({ error: 'request_id, consultant_id and slot are required' });
  }
  const request = await db.getRequest(request_id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const consultant = await db.getConsultant(consultant_id);
  if (!consultant) return res.status(404).json({ error: 'Consultant not found' });

  const id = await db.createBooking(request_id, consultant_id, String(slot).slice(0, 40));
  res.status(201).json({ id, consultant: consultant.name, slot });
}));

app.get('/api/bookings', staffOnly, wrap(async (_req, res) => {
  const [bookings, requests, consultants, consultations, calls] = await Promise.all([
    db.listBookings(), db.listRequests(200), db.listConsultants(),
    db.listConsultations(), db.listAiCalls(1000)
  ]);
  const reqById = new Map(requests.map(r => [r.id, r]));
  const conById = new Map(consultants.map(c => [c.id, c]));
  const sumByBooking = new Map(consultations.map(c => [c.booking_id, c]));

  // AI spend is attributed to the request, then surfaced on its bookings.
  const costByRequest = {};
  for (const c of calls) {
    if (!c.request_id) continue;
    costByRequest[c.request_id] = (costByRequest[c.request_id] || 0) + callCost(c);
  }
  const bookingsPerRequest = {};
  for (const b of bookings) bookingsPerRequest[b.request_id] = (bookingsPerRequest[b.request_id] || 0) + 1;

  res.json(bookings.map(b => ({
    ...b,
    request: reqById.get(b.request_id) || null,
    consultant: conById.get(b.consultant_id) || null,
    has_summary: sumByBooking.has(b.id),
    ai_cost_usd: Number((costByRequest[b.request_id] || 0).toFixed(4)),
    is_repeat: (bookingsPerRequest[b.request_id] || 0) > 1
  })));
}));

/* -------------------------------------------- consultation summary (stream) */

app.post('/api/bookings/:id/summary', staffOnly, wrap(async (req, res) => {
  const booking = await db.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const notes = String(req.body?.notes || '').trim();
  if (notes.length < 30) {
    return res.status(400).json({ error: 'Notes are too short — at least 30 characters' });
  }

  const request = await db.getRequest(booking.request_id);
  const brief = typeof request?.brief === 'string' ? JSON.parse(request.brief) : request?.brief;

  // Server-Sent Events: text goes out as it is generated.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const summary = await streamSummary({
      brief, notes, requestId: booking.request_id,
      onDelta: delta => send('delta', { text: delta })
    });
    await db.saveConsultation(booking.id, notes, summary);
    await db.setBookingStatus(booking.id, 'completed');
    send('done', { summary });
  } catch (err) {
    const message = err instanceof RefusalError
      ? 'The model declined this request under its safety policies'
      : (err?.code === 'NO_KEY' ? 'ANTHROPIC_API_KEY is not set on the server' : String(err?.message || err));
    send('error', { message });
  }
  res.end();
}));

app.get('/api/bookings/:id/summary', staffOnly, wrap(async (req, res) => {
  const c = await db.getConsultation(req.params.id);
  if (!c) return res.status(404).json({ error: 'No summary yet' });
  res.json(c);
}));

/* ----------------------------------------------------------------- metrics */

/* Exactly the metrics named in the hypothesis: booking rate, completed
   consultations, repeat bookings — plus AI cost, without which the pilot's
   unit economics cannot be computed. */
app.get('/api/metrics', staffOnly, wrap(async (_req, res) => {
  const [requests, bookings, consultations, calls, matched] = await Promise.all([
    db.listRequests(1000), db.listBookings(), db.listConsultations(),
    db.listAiCalls(1000), db.countRequestsWithMatches()
  ]);

  const withBooking = new Set(bookings.map(b => b.request_id));
  const perRequest = {};
  for (const b of bookings) perRequest[b.request_id] = (perRequest[b.request_id] || 0) + 1;
  const repeat = Object.values(perRequest).filter(n => n > 1).length;

  const tok = calls.reduce((a, c) => ({
    input:  a.input  + (c.input_tokens  | 0),
    output: a.output + (c.output_tokens | 0),
    read:   a.read   + (c.cache_read    | 0),
    write:  a.write  + (c.cache_write   | 0)
  }), { input: 0, output: 0, read: 0, write: 0 });

  const usd = calls.reduce((a, c) => a + callCost(c), 0);
  const cacheTotal = tok.read + tok.write;

  // Per-operation breakdown: which step of the flow actually costs money.
  const byKind = {};
  for (const c of calls) {
    const k = byKind[c.kind] || (byKind[c.kind] = { calls: 0, tokens: 0, cost: 0 });
    k.calls++;
    k.tokens += tokensOf(c);
    k.cost += callCost(c);
  }
  for (const k of Object.values(byKind)) k.cost = Number(k.cost.toFixed(4));

  const completedCount = consultations.filter(c => c.summary_md).length;

  // The cache is only reused between calls of the SAME kind: brief, match and
  // summary have different system prompts. While each kind has run once, a zero
  // hit rate is normal rather than a symptom — count repeats so the metrics page
  // does not raise a false alarm.
  const perKind = {};
  for (const c of calls) perKind[c.kind] = (perKind[c.kind] || 0) + 1;
  const repeatKindCalls = Object.values(perKind).reduce((a, n) => a + Math.max(0, n - 1), 0);

  res.json({
    requests: requests.length,
    briefs_ok: requests.filter(r => r.brief).length,
    briefs_failed: requests.filter(r => r.brief_error).length,
    matched_requests: matched,
    bookings: bookings.length,
    requests_with_booking: withBooking.size,
    booking_rate: requests.length ? Math.round(withBooking.size / requests.length * 100) : 0,
    completed: completedCount,
    completion_rate: bookings.length ? Math.round(completedCount / bookings.length * 100) : 0,
    repeat_bookings: repeat,
    repeat_rate: withBooking.size ? Math.round(repeat / withBooking.size * 100) : 0,
    ai_calls: calls.length,
    refusals: calls.filter(c => c.stop_reason === 'refusal').length,
    tokens: tok,
    by_kind: byKind,
    cache_hit_rate: cacheTotal ? Math.round(tok.read / cacheTotal * 100) : 0,
    repeat_kind_calls: repeatKindCalls,
    est_cost_usd: Number(usd.toFixed(4)),
    est_cost_per_request_usd: requests.length ? Number((usd / requests.length).toFixed(4)) : 0,
    est_cost_per_consultation_usd: completedCount ? Number((usd / completedCount).toFixed(4)) : 0
  });
}));

app.get('/api/ai-calls', staffOnly, wrap(async (_req, res) => {
  res.json(await db.listAiCalls(100));
}));

/* ----------------------------------------------------------------- markets */

/* The quote layer is public because every page needs it and it holds no
   secrets — but it is cached server-side, so a hundred open tabs still cost the
   upstream one request a minute. */
app.get('/api/markets', wrap(async (req, res) => {
  const snap = await market.snapshot();
  const cls = String(req.query.cls || '').trim();
  const items = cls ? snap.items.filter(i => i.cls === cls) : snap.items;
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ ...snap, classes: market.CLASSES, items });
}));

app.get('/api/markets/movers', wrap(async (req, res) => {
  const limit = Math.min(12, Math.max(3, Number(req.query.limit) || 6));
  res.set('Cache-Control', 'public, max-age=30');
  res.json(await market.movers(limit));
}));

app.get('/api/symbol/:symbol', wrap(async (req, res) => {
  const data = await market.one(req.params.symbol);
  if (!data) return res.status(404).json({ error: 'Unknown symbol', universe: market.UNIVERSE.map(i => i.symbol) });
  res.set('Cache-Control', 'public, max-age=30');
  res.json(data);
}));

/* ----------------------------------------------------------------- copilot */

/* Simple per-IP window. The Copilot is open to anyone who loads a page, so it
   needs a ceiling — one careless loop in a browser tab would otherwise spend
   real money. In-memory is fine for a single-instance pilot; a shared store
   would be needed behind more than one replica. */
const COPILOT_LIMIT = Number(process.env.COPILOT_RPM || 20);
const hits = new Map();

function rateLimited(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  const now = Date.now();
  const window = (hits.get(ip) || []).filter(t => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  if (hits.size > 5000) hits.clear();          // crude guard against unbounded growth
  return window.length > COPILOT_LIMIT;
}

app.post('/api/copilot', wrap(async (req, res) => {
  if (rateLimited(req)) {
    return res.status(429).json({ error: `Too many questions — limit is ${COPILOT_LIMIT} per minute.` });
  }
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages is required' });
  }
  const out = await copilotAsk({ messages, context: context || {} });
  res.json(out);
}));

/* Actions are confirmed by the user in the widget; the client owns the pilot
   storage (watchlist, alerts). This endpoint validates and acknowledges, so the
   UI has one place to talk to and the server can count what was confirmed. */
const ACTION_IDS = new Set(['create_alert', 'open_chart', 'compare', 'add_watchlist']);

app.post('/api/copilot/action', wrap(async (req, res) => {
  const { id, payload } = req.body || {};
  if (!ACTION_IDS.has(id)) return res.status(400).json({ error: 'Unknown action' });

  const p = payload || {};
  switch (id) {
    case 'create_alert':
      if (!p.symbol || !p.condition) return res.status(400).json({ error: 'symbol and condition are required' });
      return res.json({ ok: true, confirm: `Alert created for ${p.symbol}: ${p.condition}${p.value != null ? ' ' + p.value : ''}` });
    case 'add_watchlist':
      if (!p.symbol) return res.status(400).json({ error: 'symbol is required' });
      return res.json({ ok: true, confirm: `${p.symbol} added to your watchlist` });
    // Charts now open in the workspace, not inside an Academy lesson: the new
    // IA gives the portal and the chart a single, explicit boundary.
    case 'open_chart':
      if (!p.symbol) return res.status(400).json({ error: 'symbol is required' });
      return res.json({ ok: true, navigate: '/charts.html', symbol: p.symbol, range: p.range || '1D' });
    case 'compare': {
      const syms = Array.isArray(p.symbols) ? p.symbols.filter(Boolean) : [];
      if (syms.length < 2) return res.status(400).json({ error: 'at least two symbols are required' });
      return res.json({ ok: true, navigate: '/charts.html', symbol: syms[0], compare: syms });
    }
  }
}));

/* -------------------------------------------------------------------- boot */

const server = await (async () => {
  await db.init();
  return app.listen(PORT, () => {
    console.log(`Expert Marketplace listening on ${PORT}`);
    console.log(`  storage: ${db.MODE}${db.MODE === 'memory' ? ' (non-persistent — set DATABASE_URL)' : ''}`);
    console.log(`  AI: ${hasKey() ? MODEL : 'no key set, AI steps will return 503'}`);
    if (!STAFF_TOKEN) console.log('  STAFF_TOKEN not set — internal screens are open');
  });
})();

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
