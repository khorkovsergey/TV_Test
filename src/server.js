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
import { randomUUID, timingSafeEqual } from 'node:crypto';
import * as db from './db.js';
import { ROUTES, PAGE_OF, LEGACY, chartRoute, symbolRoute } from './routes.js';
import * as analytics from './analytics.js';
import {
  buildBrief, rankMatches, hardFilter, streamSummary,
  hasKey, MODEL, RefusalError
} from './claude.js';
import { ask as copilotAsk, MODEL as COPILOT_MODEL } from './copilot.js';
import * as market from './market.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/* Railway sets RAILWAY_ENVIRONMENT; NODE_ENV covers everything else. Declared
   before the middleware because the security headers depend on it. */
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);

const app = express();

/* Railway terminates TLS and forwards; without this `req.ip` is the proxy and
   every rate limit keys on one address (§SEC-007). */
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '256kb' }));

/* Visit analytics. First in the chain so a page view is counted even if the
   route below it 404s — a 404 is still somebody arriving.

   It records an anonymous visitor hash and a country, never an IP. See
   `src/analytics.js` for what that costs and what it buys. */
analytics.useDb(db);
app.use((req, _res, next) => { analytics.record(req); next(); });

/* §SEC-006 — security headers, written out rather than pulled from a
   dependency, because there are six of them and the stand has no build step.

   No CSP yet, deliberately and with the reason stated: the pages carry large
   inline scripts (§ARCH-003), so a strict policy would need either `unsafe-inline`
   — which is a policy that permits the thing it exists to prevent — or the
   script extraction that is on the P1 list. A header that pretends to protect
   is worse than an absent one. */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

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

/* ------------------------------------------------------------------ routes
   Six sections, clean paths, and not one broken bookmark. Every page that
   existed before this release keeps working: the old `.html` paths issue a
   permanent redirect to their new home and carry the query string with them,
   so `/markets.html?cls=crypto` still lands on the crypto filter and
   `/symbol.html?symbol=BTCUSD` still opens bitcoin. */

const send = file => (_req, res) => res.sendFile(path.join(PUBLIC, file));

/* Section hubs and the pages inside them — from the shared registry, so a
   route cannot exist in Express and be spelled differently in an API response
   (§ROUTE-001). */
for (const [route, file] of Object.entries(PAGE_OF)) {
  if (route === ROUTES.home) continue;   // the A/B gate decides what `/` serves
  app.get(route, send(file));
}

/* One asset hub per instrument. The page reads the symbol from the path; the
   old query form is redirected into it below. */
app.get('/symbols/:symbol', send('symbol.html'));
app.get('/symbols', (_req, res) => res.redirect(301, '/markets'));

/* Legacy paths, from the shared registry. Nothing 404s, nothing loses its query. */
for (const [from, to] of Object.entries(LEGACY)) {
  app.get(from, (req, res) => {
    const qs = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
    res.redirect(301, to + qs);
  });
}

/* The symbol page moved from a query to a path; keep the old address alive and
   preserve the instrument it pointed at. */
app.get('/symbol.html', (req, res) => {
  const sym = String(req.query.symbol || 'BTCUSD').toUpperCase().replace(/[^A-Z0-9.\-=^]/g, '');
  res.redirect(301, symbolRoute(sym || 'BTCUSD'));
});

app.use(express.static(PUBLIC));

const PORT = process.env.PORT || 3000;
const STAFF_TOKEN = process.env.STAFF_TOKEN || '';
const CONSENT_VERSION = '2026-07-consent-v2';

/* §SEC-001 — fail closed.

   This used to read `if (!STAFF_TOKEN) return next()`, so a deployment that
   forgot the variable served the consultant desk and the metrics screen — real
   enquiries, names and emails — to anyone who typed the URL. The absence of a
   secret is not permission.

   Deliberately NOT a hard startup crash: the staff area is one corner of the
   stand, and taking the whole portal down because an optional feature is
   unconfigured is the failure mode §OPS-001 warns about. Staff endpoints
   refuse; everything else keeps serving. */
function staffOnly(req, res, next) {
  if (!STAFF_TOKEN) {
    if (IS_PROD) {
      console.error('[security] staff request refused: STAFF_TOKEN is not configured');
      return res.status(503).json({ error: 'Staff area is not configured on this deployment' });
    }
    return next();                          // local development only
  }
  /* §SEC-001 — header only. A token in the query string is copied into browser
     history, proxy logs, referrers and screenshots. */
  const given = String(req.get('x-staff-token') || '');
  const a = Buffer.from(given.padEnd(64).slice(0, 64), 'utf8');
  const b = Buffer.from(STAFF_TOKEN.padEnd(64).slice(0, 64), 'utf8');
  if (given.length === STAFF_TOKEN.length && timingSafeEqual(a, b)) return next();
  res.status(401).json({ error: 'Unauthorised' });
}

const COPILOT_LIMIT = Number(process.env.COPILOT_RPM || 20);

/* §SEC-007 — the old limiter had three problems and each of them was a bypass:

   1. it read `x-forwarded-for` directly, a header the client can set, without
      trusting the proxy — so a caller could rotate their own identity;
   2. it cleared the ENTIRE map at 5,000 keys, so filling it reset everyone's
      counter, which turned the memory guard into the attack;
   3. it protected the Copilot and nothing else — brief generation, matching
      and booking, all of which cost money or write records, were unlimited.

   `app.set('trust proxy', 1)` at the top makes `req.ip` the real client on
   Railway, and eviction is now per-key and by age. This is still in-process
   and therefore per-instance: correct for one container, and named as a
   limitation rather than presented as a distributed limiter. */
const buckets = new Map();

function limit(name, perMinute) {
  return (req, res, next) => {
    const key = name + '|' + (req.ip || 'unknown');
    const now = Date.now();
    const window = (buckets.get(key) || []).filter(t => now - t < 60_000);
    window.push(now);
    buckets.set(key, window);

    /* Evict only what has gone quiet — never everyone at once. */
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (!v.length || now - v[v.length - 1] > 120_000) buckets.delete(k);
        if (buckets.size <= 4000) break;
      }
    }

    if (window.length > perMinute) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: `Too many requests — limit is ${perMinute} per minute.` });
    }
    next();
  };
}

/* Classes, not one number: reading is cheap, a model call is not. */
const limitAI      = limit('ai', COPILOT_LIMIT);
const limitWrite   = limit('write', 12);
const limitBooking = limit('booking', 6);

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
  /* A taken slot is a normal outcome of two people wanting the same time. */
  if (err?.code === 'SLOT_TAKEN') {
    return res.status(409).json({ error: 'That slot is no longer available', code: 'SLOT_TAKEN' });
  }
  /* §SEC-005 — the internal message stays in the log, the client gets an id.
     Before this, a database error handed the visitor the SQL, and a provider
     failure handed them the provider's own wording. */
  const errorId = 'err_' + randomUUID().slice(0, 8);
  console.error('[error]', errorId, err);
  if (IS_PROD) {
    return res.status(500).json({ error: 'The request could not be completed', error_id: errorId });
  }
  res.status(500).json({ error: err?.message || 'Internal error', error_id: errorId });
}

/* ------------------------------------------------------------------ health */

/* §OPS-001 — three questions, three endpoints.

   Railway uses the healthcheck to decide whether to keep the container. The
   old `/api/health` answered "is everything configured", which meant an
   unset ANTHROPIC_API_KEY — an optional feature — could report the whole
   portal unhealthy and get it restarted. Liveness, readiness and feature
   status are different questions and are now asked separately. */

/* "Not set" and "set but unreachable" are different problems with different
   fixes, and reporting the second as the first sent me looking for a missing
   variable that was already there. */
const storageProblem = () => process.env.DATABASE_URL
  ? 'DATABASE_URL is set but Postgres did not answer: serving from memory, data will be lost on restart'
  : 'DATABASE_URL is not set: data will be lost on restart';

/* Liveness: the process is up and answering. Nothing else. */
app.get('/health/live', (_req, res) => res.json({ ok: true }));

/* Readiness: can we serve the core portal? Static pages and market data need
   no database and no model key, so a stand with neither is still ready. */
app.get('/health/ready', wrap(async (_req, res) => {
  const ready = true;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    storage: db.MODE,
    note: db.MODE === 'memory'
      ? 'Running without a database: form submissions live in memory and are lost on restart'
      : 'Postgres connected'
  });
}));

/* Feature status: what optional integrations are configured. Read by the
   staff screen and by a human checking a deploy — never by the healthcheck. */
app.get('/api/system/status', wrap(async (req, res) => {
  const problems = [];
  if (db.MODE === 'memory') problems.push(storageProblem());
  if (!hasKey()) problems.push('ANTHROPIC_API_KEY is not set: AI steps will return 503');
  if (IS_PROD && !STAFF_TOKEN) problems.push('STAFF_TOKEN is not set: the staff area refuses every request');
  res.json({
    ok: problems.length === 0,
    environment: IS_PROD ? 'production' : 'development',
    storage: db.MODE,
    ai: hasKey() ? 'ready' : 'not configured',
    staff_area: STAFF_TOKEN ? 'protected' : (IS_PROD ? 'refusing (unconfigured)' : 'open (development)'),
    problems
  });
}));

/* Reports configuration state without leaking secrets: presence and token
   length, never values. Kept for the existing dashboards and tests. */
app.get('/api/health', wrap(async (_req, res) => {
  const problems = [];
  if (db.MODE === 'memory') problems.push(storageProblem());
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

app.post('/api/requests', limitWrite, wrap(async (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (!b.contact_name?.trim()) errors.push('Please enter your name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contact_email || '')) errors.push('Please enter a valid email');
  if (!b.country?.trim()) errors.push('Please choose a country');
  if (!CAPITAL_BANDS.includes(b.capital_band)) errors.push('Please choose a capital range');
  if ((b.goal_text || '').trim().length < 40) errors.push('Tell us a little more — at least 40 characters');
  if (b.consent !== true) errors.push('Consent is required to share your context with a consultant');
  /* §SEC-004 — a model reads this text, structures it and ranks people against
     it. That is a separate purpose from "a consultant may read it", so it is a
     separate answer, and neither is preselected in the form. */
  if (b.consent_ai !== true) errors.push('Consent is required for AI processing of your enquiry');
  if (errors.length) return res.status(400).json({ errors });

  const request = {
    contact_name:  String(b.contact_name).trim().slice(0, 120),
    contact_email: String(b.contact_email).trim().slice(0, 200),
    country:       String(b.country).trim().slice(0, 4).toUpperCase(),
    language:      String(b.language || 'en').trim().slice(0, 5),
    capital_band:  b.capital_band,
    goal_text:     String(b.goal_text).trim().slice(0, 6000),
    consent:       true,
    consent_ai:    true,
    consent_version: CONSENT_VERSION
  };

  const { id, token } = await db.createRequest(request);

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

  /* The token is returned exactly once, in the response to the call that
     created the record. It is never stored server-side in reversible form. */
  res.status(201).json({ id, access_token: token, brief, brief_error: briefError });
}));

/* §SEC-003 — proof of ownership, taken from a header rather than the query
   string, because query strings end up in browser history, proxy logs and
   screenshots. A wrong or missing token is 404, not 403: confirming that an
   id exists is itself a small leak. */
function requestToken(req) {
  const auth = req.get('authorization') || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth);
  return (bearer ? bearer[1] : req.get('x-request-token') || '').trim();
}

const ownsRequest = wrap(async (req, res, next) => {
  const ok = await db.requestAccessOk(req.params.id, requestToken(req));
  if (!ok) return res.status(404).json({ error: 'Request not found' });
  next();
});

app.get('/api/requests/:id', ownsRequest, wrap(async (req, res) => {
  const r = await db.getRequest(req.params.id);
  if (!r) return res.status(404).json({ error: 'Request not found' });
  const { access_hash, ...safe } = r;   // never hand back the credential material
  res.json(safe);
}));

app.get('/api/requests', staffOnly, wrap(async (_req, res) => {
  res.json(await db.listRequests());
}));

/* ------------------------------------------------------------------- match */

app.post('/api/requests/:id/match', limitAI, ownsRequest, wrap(async (req, res) => {
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

app.post('/api/bookings', limitBooking, wrap(async (req, res) => {
  const { request_id, consultant_id, slot } = req.body || {};
  if (!request_id || !consultant_id || !slot) {
    return res.status(400).json({ error: 'request_id, consultant_id and slot are required' });
  }

  /* §SEC-003 — booking touches somebody's enquiry, so the caller has to prove
     it is theirs. Before this, knowing a request id was enough to book on
     another person's behalf. */
  if (!(await db.requestAccessOk(request_id, requestToken(req)))) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const request = await db.getRequest(request_id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const consultant = await db.getConsultant(consultant_id);
  if (!consultant) return res.status(404).json({ error: 'Consultant not found' });

  /* §EXP-004 — the consultant has to be one the hard filter actually allowed
     for this enquiry. A client-supplied id is a suggestion, not an authority:
     without this check a request from Germany could book a US-only adviser by
     editing one field in the request body. */
  const eligible = hardFilter(request, await db.listConsultants());
  if (!eligible.some(c => c.id === consultant_id)) {
    return res.status(409).json({
      error: 'That consultant is not available for this enquiry',
      reason: 'jurisdiction, language or capital range does not match'
    });
  }

  const id = await db.createBooking(request_id, consultant_id, String(slot).slice(0, 40));
  /* §EXP-003 — "held", because nothing external confirmed anything. */
  res.status(201).json({ id, consultant: consultant.name, slot, status: 'held' });
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
/* The same answer, streamed.

   §COPILOT-STREAM. The non-streaming endpoint above still exists and still
   works — it is the fallback when a browser or a proxy will not do streaming,
   and it is what the tests exercise. Both call the same `ask()`; the only
   difference is whether anybody is listening to the progress. */
app.post('/api/copilot/stream', limitAI, wrap(async (req, res) => {
  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages is required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    /* Nginx and friends buffer by default, which turns a stream back into one
       late blob — the exact thing this endpoint exists to avoid. */
    'X-Accel-Buffering': 'no'
  });

  const send = (event, data) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
  };

  /* If the visitor closes the tab mid-answer, stop writing into a dead socket
     — but let the model call finish, because it is already paid for and its
     usage still has to be logged. */
  let gone = false;
  req.on('close', () => { gone = true; });

  try {
    const out = await copilotAsk({
      messages,
      context: context || {},
      onEvent: (e) => { if (!gone) send(e.type, e); }
    });
    send('done', out);
  } catch (err) {
    send('failed', { error: String(err?.message || err), code: err?.code || null });
  } finally {
    if (!res.writableEnded) res.end();
  }
}));

/* The page reporting how long it was actually read. Not staff-only — it is the
   visitor's own browser telling us about the visitor's own visit, and it can
   only ever write a duration onto a row that request already created. The
   visitor id is derived server-side from the same address and agent, so a
   caller cannot attribute time to somebody else. */
app.post('/api/analytics/dwell', (req, res) => {
  const { path: p, ms } = req.body || {};
  analytics.recordDwell({ visitor: analytics.beaconIdFor(req), path: String(p || ''), ms });
  res.status(204).end();
});

/* How many people, from where. Staff-only: it is aggregate and anonymous, but
   it is still traffic data and does not belong on a public endpoint. */
app.get('/api/analytics', staffOnly, wrap(async (req, res) => {
  const period = String(req.query.period || '24h');
  res.json(await analytics.summary(period));
}));

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

/* Historical bars. Separate from the snapshot because it is a different
   question with a different cost: the snapshot is one shared object refreshed
   every minute, this is per symbol/interval/range and is what the chart draws
   candles from. */
app.get('/api/market/history/:symbol', wrap(async (req, res) => {
  const asked = market.normaliseHistoryQuery(req.query.interval, req.query.range);
  let data;
  try {
    data = await market.history(req.params.symbol, asked.interval, asked.range);
  } catch (err) {
    /* No invented candles. The chart shows its "historical candles are
       unavailable" state and offers a retry — that is the honest outcome. */
    return res.status(502).json({
      ok: false, symbol: String(req.params.symbol || '').toUpperCase(),
      interval: asked.interval, range: asked.range,
      error: String(err?.message || err)
    });
  }
  if (!data) {
    return res.status(404).json({
      ok: false, error: 'Unknown symbol', universe: market.UNIVERSE.map(i => i.symbol)
    });
  }
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ ok: true, ...data, count: data.candles.length });
}));

/* ----------------------------------------------------------------- copilot */

/* Simple per-IP window. The Copilot is open to anyone who loads a page, so it
   needs a ceiling — one careless loop in a browser tab would otherwise spend
   real money. In-memory is fine for a single-instance pilot; a shared store
   would be needed behind more than one replica. */

app.post('/api/copilot', limitAI, wrap(async (req, res) => {
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
const ACTION_IDS = new Set([
  'create_alert', 'open_chart', 'compare', 'add_watchlist',
  /* §17 — the actions that lead back to the chart. They are applied by the
     page, but they are validated here: the page draws what this endpoint has
     agreed is drawable, so a malformed marker never reaches the chart. */
  'mark_chart_events', 'compare_selected_period', 'expand_selected_range',
  'create_event_alert', 'save_research', 'clear_chart_selection'
]);

const MAX_EVENTS = 12;
const MAX_COMPARE = 3;
const isTime = v => /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(String(v || ''));

app.post('/api/copilot/action', wrap(async (req, res) => {
  const { id, payload } = req.body || {};
  if (!ACTION_IDS.has(id)) return res.status(400).json({ error: 'Unknown action' });

  const p = payload || {};
  switch (id) {
    case 'mark_chart_events': {
      const raw = Array.isArray(p.events) ? p.events : [];
      /* A marker with an unparseable date would land on the wrong session or
         on none at all, and a marker in the wrong place is worse than an
         absent one — so the bad ones are dropped and counted, not guessed at. */
      const events = raw
        .filter(e => e && isTime(e.time) && typeof e.title === 'string' && e.title.trim())
        .slice(0, MAX_EVENTS)
        .map(e => ({
          time: e.time,
          title: String(e.title).slice(0, 180),
          category: ['company', 'earnings', 'regulation', 'sector', 'market', 'macro', 'technical', 'flow']
            .includes(e.category) ? e.category : 'company',
          url: typeof e.url === 'string' && /^https?:\/\//.test(e.url) ? e.url.slice(0, 500) : null
        }));
      if (!events.length) return res.status(400).json({ error: 'No event carried a usable date' });
      return res.json({
        ok: true, events,
        dropped: raw.length - events.length,
        confirm: `${events.length} event${events.length > 1 ? 's' : ''} marked`
      });
    }

    case 'compare_selected_period': {
      const asked = (Array.isArray(p.symbols) ? p.symbols : []).map(s => String(s || '').toUpperCase());
      const known = asked.filter(s => market.find(s)).slice(0, MAX_COMPARE);
      if (!known.length) {
        return res.status(400).json({
          error: 'None of those instruments are in this pilot universe',
          universe: market.UNIVERSE.map(i => i.symbol)
        });
      }
      return res.json({ ok: true, symbols: known, confirm: `Comparing with ${known.join(', ')}` });
    }

    case 'create_event_alert': {
      if (!p.symbol || !market.find(p.symbol)) return res.status(400).json({ error: 'Unknown symbol' });
      if (!['event', 'volume'].includes(p.kind)) return res.status(400).json({ error: 'kind must be event or volume' });
      if (!p.description) return res.status(400).json({ error: 'description is required' });
      return res.json({
        ok: true,
        symbol: String(p.symbol).toUpperCase(),
        kind: p.kind,
        description: String(p.description).slice(0, 180),
        value: Number.isFinite(p.value) ? p.value : null,
        confirm: 'Alert saved on this device'
      });
    }

    case 'expand_selected_range':
      if (!isTime(p.from) || !isTime(p.to)) return res.status(400).json({ error: 'from and to are required' });
      return res.json({ ok: true, from: p.from, to: p.to, confirm: 'Range widened' });

    case 'save_research':
      return res.json({ ok: true, confirm: 'Saved to your research' });

    case 'clear_chart_selection':
      return res.json({ ok: true, confirm: 'Selection cleared' });
  }

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
      return res.json({ ok: true, navigate: chartRoute(p.symbol, p.range || '1D'), symbol: p.symbol, range: p.range || '1D' });
    case 'compare': {
      const syms = Array.isArray(p.symbols) ? p.symbols.filter(Boolean) : [];
      if (syms.length < 2) return res.status(400).json({ error: 'at least two symbols are required' });
      return res.json({ ok: true, navigate: chartRoute(syms[0]), symbol: syms[0], compare: syms });
    }
  }
}));

/* §SEO-003 — robots and sitemap follow the deployment, not a meta tag that
   is hardcoded on every page.

   The stand is currently NOT indexable: it carries brand assets it does not
   own and collects names and emails, so inviting crawlers would be wrong
   regardless of what the GEO/AEO bet argues. PUBLIC_INDEX=true flips it for
   a deployment genuinely meant to be public — and even then the staff,
   metrics, showcase and control-page routes stay out. */
const PUBLIC_INDEX = process.env.PUBLIC_INDEX === 'true';
const NEVER_INDEXED = ['/staff', '/metrics', '/showcase', '/classic', '/api/'];
const originOf = req => (req.protocol || 'https') + '://' + (req.get('host') || 'localhost');

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  if (!PUBLIC_INDEX) {
    return res.send(['# Case-study prototype — deliberately not indexed.',
                     'User-agent: *', 'Disallow: /', ''].join('\n'));
  }
  const lines = ['User-agent: *'].concat(
    NEVER_INDEXED.map(p => 'Disallow: ' + p),
    ['Sitemap: ' + originOf(req) + '/sitemap.xml', '']);
  res.send(lines.join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  const head = '<?xml version="1.0" encoding="UTF-8"?>';
  const open = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  if (!PUBLIC_INDEX) return res.send([head, open, '</urlset>', ''].join('\n'));
  const origin = originOf(req);
  const urls = ['/'].concat(Object.keys(PAGE_OF))
    .filter(r => !NEVER_INDEXED.some(x => r.startsWith(x)))
    .map(r => '  <url><loc>' + origin + r + '</loc></url>');
  res.send([head, open].concat(urls, ['</urlset>', '']).join('\n'));
});

/* §ROUTE-004 — an unknown path used to fall through the static handler and
   produce Express's own plain-text "Cannot GET /x". The 404 page offers a
   search, the six sections and a guess from the information architecture. */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'No such endpoint' });
  }
  res.status(404).sendFile(path.join(PUBLIC, '404.html'));
});

/* -------------------------------------------------------------------- boot */

/* §DB-006 — LISTEN FIRST, connect second.

   This used to `await db.init()` before `app.listen`. The first deploy with a
   real DATABASE_URL then failed its healthcheck after sixty seconds and was
   rolled back: the database was reachable a moment later, but by then Railway
   had already decided the container was dead. Railway's private network is not
   up for the first few hundred milliseconds of a container's life, so the very
   first connection attempt can fail on a perfectly healthy database.

   The comment on §DB-005 already promised that a Postgres outage would not take
   the portal down. It said so three lines above the call that made it false.
   The port now opens immediately; the database connects behind it, retries, and
   demotes itself to memory if it cannot. */
const server = app.listen(PORT, () => {
  console.log(`TradingView portal prototype listening on ${PORT}`);
  console.log(`  storage: connecting…`);
  console.log(`  AI: ${hasKey() ? MODEL : 'no key set, AI steps will return 503'}`);
  console.log(`  staff area: ${STAFF_TOKEN ? 'protected' : (IS_PROD ? 'REFUSING — STAFF_TOKEN is not set' : 'open (development)')}`);
  market.warm();          // fills the quote cache before the first visitor asks
});

db.init().then(() => {
  console.log(`  storage: ${db.MODE}${db.MODE === 'memory' ? ' (non-persistent — set DATABASE_URL)' : ''}`);

  /* §DB-005 — memory storage in production is a data-loss policy, not a
     default. It stays allowed (this is a public stand, and a Postgres outage
     should not take the portal down) but it is loud in the log, visible in
     /api/system/status and stated on the pages that collect anything. */
  if (IS_PROD && db.MODE === 'memory' && process.env.DEMO_EPHEMERAL !== 'true') {
    console.warn('[storage] PRODUCTION IS RUNNING WITHOUT A DATABASE.');
    console.warn('[storage] Every enquiry will be lost on the next restart.');
    console.warn('[storage] Set DATABASE_URL, or set DEMO_EPHEMERAL=true to acknowledge this deliberately.');
  }
}).catch(e => {
  /* `init()` already handles its own failures and demotes to memory. Reaching
     here means something unforeseen — say so and keep serving. */
  console.error('[storage] init failed unexpectedly:', e.message);
});

/* §OPS-002 — stop accepting, let what is in flight finish, close the pool,
   and never hang forever waiting for a socket that will not close. */
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received`);

  const forced = setTimeout(() => {
    console.error('[shutdown] timed out after 10s — exiting anyway');
    process.exit(1);
  }, 10_000);
  forced.unref();

  await new Promise(resolve => server.close(resolve));
  console.log('[shutdown] http server closed');

  try { await db.close?.(); console.log('[shutdown] database pool closed'); }
  catch (e) { console.error('[shutdown] database close failed:', e.message); }

  clearTimeout(forced);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
