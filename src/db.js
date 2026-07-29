/* =========================================================================
   Storage layer.

   With DATABASE_URL set we run on Postgres (the production path, Railway).
   Without it, the same API is served from process memory so the service can
   start locally with no database. Memory mode is labelled honestly: data is
   lost on restart, and /api/health says so.
   ========================================================================= */

import pg from 'pg';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';

const URL = process.env.DATABASE_URL || '';

/* Not a constant: a Postgres that will not answer must be able to demote the
   process to memory rather than keep the portal down. `MODE` is therefore a
   getter over a mutable value, and every reader — /api/system/status, the boot
   log, the analytics module — sees the demotion without being told. */
let _mode = URL ? 'postgres' : 'memory';

/* Exported as a live ESM binding, not a copy: when `init()` demotes the
   process to memory, every reader — /api/system/status, the boot log, the
   analytics summary — sees it immediately, with no call site changed and no
   second source of truth to drift. */
export { _mode as MODE };

/* ------------------------------------------------------------------ schema */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS consultants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  jurisdiction  TEXT NOT NULL,
  languages     TEXT[] NOT NULL DEFAULT '{}',
  specialties   TEXT[] NOT NULL DEFAULT '{}',
  license_id    TEXT,
  license_state TEXT NOT NULL DEFAULT 'unverified',
  capital_min   BIGINT NOT NULL DEFAULT 0,
  capital_max   BIGINT,
  rate_hour     INTEGER,
  bio           TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS requests (
  id            TEXT PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_name  TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  country       TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en',
  capital_band  TEXT NOT NULL,
  goal_text     TEXT NOT NULL,
  consent       BOOLEAN NOT NULL DEFAULT FALSE,
  -- §SEC-004: sharing a brief with a consultant and having a model read it are
  -- two different purposes, so they are two different answers. Neither is
  -- preselected in the form.
  consent_ai        BOOLEAN NOT NULL DEFAULT FALSE,
  consent_version   TEXT,
  consent_at        TIMESTAMPTZ,
  -- §SEC-003: the id identifies the record; this hash is what proves the
  -- caller is the person who created it. The token itself is shown once and
  -- never stored.
  access_hash   TEXT,
  brief         JSONB,
  brief_error   TEXT
);

-- Columns added after the first release; CREATE TABLE IF NOT EXISTS above will
-- not add them to an existing database.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS consent_ai BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS consent_version TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS access_hash TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'held';

CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);
CREATE INDEX IF NOT EXISTS matches_request_idx ON matches (request_id);
CREATE INDEX IF NOT EXISTS bookings_request_idx ON bookings (request_id);
CREATE INDEX IF NOT EXISTS bookings_consultant_idx ON bookings (consultant_id);

CREATE TABLE IF NOT EXISTS matches (
  request_id    TEXT NOT NULL,
  consultant_id TEXT NOT NULL,
  score         INTEGER NOT NULL,
  rationale     TEXT,
  concerns      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, consultant_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id            TEXT PRIMARY KEY,
  request_id    TEXT NOT NULL,
  consultant_id TEXT NOT NULL,
  slot          TEXT NOT NULL,
  -- §EXP-003: nothing external confirms anything here, so the vocabulary
  -- stops at "held". A 'confirmed' state may only exist once a real
  -- consultant acceptance event does.
  status        TEXT NOT NULL DEFAULT 'held',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §EXP-002: one consultant cannot hold two people in the same slot. Without
-- this, two visitors racing on the same button both got a booking id and both
-- were told the time was theirs.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_consultant_slot_unique
  ON bookings (consultant_id, slot)
  WHERE status IN ('held', 'confirmed');

CREATE TABLE IF NOT EXISTS consultations (
  booking_id    TEXT PRIMARY KEY,
  notes         TEXT NOT NULL,
  summary_md    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Page views. No IP column, deliberately: the visitor column is a salted hash
-- and the country is resolved from a masked prefix. Nothing here can leak an
-- address. Written as an SQL comment, not a JS one: this block is a template
-- literal, and a backtick inside it ends the schema early.
CREATE TABLE IF NOT EXISTS page_views (
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  visitor    TEXT NOT NULL,
  path       TEXT NOT NULL,
  country    TEXT,
  bot        BOOLEAN NOT NULL DEFAULT false,
  ref        TEXT,
  mode       TEXT
);
CREATE INDEX IF NOT EXISTS page_views_ts ON page_views (ts DESC);

CREATE TABLE IF NOT EXISTS ai_calls (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  model         TEXT NOT NULL,
  request_id    TEXT,
  stop_reason   TEXT,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read    INTEGER NOT NULL DEFAULT 0,
  cache_write   INTEGER NOT NULL DEFAULT 0,
  ms            INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/* Demo roster. Licences are marked unverified — this is a pilot, not a registry.
   capital_min / capital_max are USD and must stay consistent with the capital
   bands in server.js and the midpoint table in claude.js. */
const SEED = [
  { id: 'c1', name: 'James Whitfield', jurisdiction: 'US', languages: ['en'],       specialties: ['getting started', 'bonds', 'taxes'],                 license_id: 'DEMO-US-001', capital_min: 0,      capital_max: 1000000, rate_hour: 180, bio: 'Works with people moving money beyond a savings account for the first time.' },
  { id: 'c2', name: 'Marta Iversen',   jurisdiction: 'EU', languages: ['en', 'de'], specialties: ['portfolio', 'ETFs', 'retirement accounts'],          license_id: 'DEMO-EU-014', capital_min: 0,      capital_max: 5000000, rate_hour: 240, bio: 'Long-horizon portfolios, asset allocation, ten years and beyond.' },
  { id: 'c3', name: 'Sunita Rao',      jurisdiction: 'IN', languages: ['en', 'hi'], specialties: ['getting started', 'equities', 'risk'],               license_id: 'DEMO-IN-207', capital_min: 0,      capital_max: null,    rate_hour: 90,  bio: 'Explains risk through plain examples; most of her clients are first-timers.' },
  { id: 'c4', name: 'Daniel Osei',     jurisdiction: 'US', languages: ['en'],       specialties: ['portfolio', 'taxes', 'concentrated position'],       license_id: 'DEMO-US-882', capital_min: 100000, capital_max: null,    rate_hour: 320, bio: 'Larger balances, concentrated single-stock positions, tax-aware planning.' },
  { id: 'c5', name: 'Ellen Croft',     jurisdiction: 'UK', languages: ['en'],       specialties: ['crypto', 'risk', 'diversification'],                 license_id: 'DEMO-UK-045', capital_min: 0,      capital_max: null,    rate_hour: 200, bio: 'Digital assets in the context of a whole portfolio, without the hype.' }
];

/* ---------------------------------------------------------------- postgres */

let pool = null;

function pgConfig() {
  // Railway's internal host needs no TLS; the public proxy host does.
  const internal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(URL);
  return { connectionString: URL, ssl: internal ? false : { rejectUnauthorized: false } };
}

/* ------------------------------------------------------------------ memory */

const mem = {
  consultants: new Map(),
  requests: new Map(),
  matches: [],
  bookings: new Map(),
  consultations: new Map(),
  aiCalls: [],
  pageViews: []
};

/* -------------------------------------------------------------------- init */

/* Bounded, and it may give up.

   §DB-006 — `init()` used to be awaited before `app.listen`, which meant a
   database that did not answer stopped the portal from listening at all: the
   healthcheck failed after sixty seconds and the deploy was rolled back. The
   comment three lines from the call already said "a Postgres outage should not
   take the portal down"; the code did the opposite, and the first real
   DATABASE_URL proved it.

   Railway's private network is also not reachable for the first few hundred
   milliseconds of a container's life, so the very first attempt can fail on a
   perfectly healthy database. Hence retries, and a deadline. */
export async function init({ timeoutMs = 8000, attempts = 3 } = {}) {
  if (_mode === 'postgres') {
    for (let i = 1; i <= attempts; i++) {
      try {
        await withTimeout(connect(), timeoutMs);
        return;
      } catch (e) {
        const last = i === attempts;
        console.error(`[storage] postgres attempt ${i}/${attempts} failed: ${e.message}`);
        if (last) {
          console.error('[storage] giving up on postgres — serving from memory.');
          console.error('[storage] the portal stays up; stored data will not survive a restart.');
          try { await pool?.end(); } catch { /* already broken */ }
          pool = null;
          _mode = 'memory';
          seedMemory();
          return;
        }
        await new Promise(r => setTimeout(r, 400 * i));
      }
    }
  }
  seedMemory();
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timed out after ${ms}ms`)), ms))
  ]);
}

function seedMemory() {
  if (mem.consultants.size) return;
  for (const c of SEED) mem.consultants.set(c.id, { ...c, license_state: 'unverified', active: true });
}

async function connect() {
  pool = new pg.Pool(pgConfig());
  {
    await pool.query(SCHEMA);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM consultants');
    if (rows[0].n === 0) {
      for (const c of SEED) {
        await pool.query(
          `INSERT INTO consultants (id,name,jurisdiction,languages,specialties,license_id,capital_min,capital_max,rate_hour,bio)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [c.id, c.name, c.jurisdiction, c.languages, c.specialties, c.license_id,
           c.capital_min, c.capital_max, c.rate_hour, c.bio]
        );
      }
    }
  }
}

const q = (text, params) => pool.query(text, params);

/* ------------------------------------------------------------- consultants */

export async function listConsultants() {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM consultants WHERE active ORDER BY name');
    return rows;
  }
  return [...mem.consultants.values()].filter(c => c.active);
}

export async function getConsultant(id) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM consultants WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.consultants.get(id) || null;
}

/* ---------------------------------------------------------------- requests */

/* §SEC-003 — the identifier and the credential are separated.

   Before this, `GET /api/requests/:id` returned somebody's name, email,
   country, capital band and their free-text story to anyone who knew an id —
   and the id was a truncated UUID, eight hex characters. The same id also
   triggered a paid model call.

   Now the id stays an identifier and a separate high-entropy token is the
   credential. Only its SHA-256 lives in the database, so a database read does
   not hand over access, and the token is returned to the creator exactly once. */
const hashToken = t => createHash('sha256').update(String(t)).digest('hex');

export async function createRequest(r) {
  const id = 'req_' + randomUUID();
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const access_hash = hashToken(token);
  const consentAt = new Date().toISOString();

  if (_mode === 'postgres') {
    await q(
      `INSERT INTO requests (id,contact_name,contact_email,country,language,capital_band,goal_text,
                             consent,consent_ai,consent_version,consent_at,access_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, r.contact_name, r.contact_email, r.country, r.language, r.capital_band, r.goal_text,
       r.consent, r.consent_ai === true, r.consent_version || null, consentAt, access_hash]
    );
  } else {
    mem.requests.set(id, {
      id, created_at: new Date().toISOString(), brief: null, brief_error: null,
      consent_at: consentAt, access_hash, ...r
    });
  }
  return { id, token };
}

/* Constant-time comparison: a timing side channel on a token check is cheap to
   avoid and embarrassing to leave in. */
export async function requestAccessOk(id, token) {
  if (!token) return false;
  const row = await getRequest(id);
  if (!row || !row.access_hash) return false;
  const a = Buffer.from(hashToken(token), 'utf8');
  const b = Buffer.from(String(row.access_hash), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setBrief(id, brief, error) {
  if (_mode === 'postgres') {
    await q('UPDATE requests SET brief=$2, brief_error=$3 WHERE id=$1',
      [id, brief ? JSON.stringify(brief) : null, error || null]);
  } else {
    const r = mem.requests.get(id);
    if (r) { r.brief = brief || null; r.brief_error = error || null; }
  }
}

export async function getRequest(id) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM requests WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.requests.get(id) || null;
}

export async function listRequests(limit = 50) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM requests ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows;
  }
  return [...mem.requests.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

/* ----------------------------------------------------------------- matches */

export async function saveMatches(requestId, ranked) {
  if (_mode === 'postgres') {
    await q('DELETE FROM matches WHERE request_id=$1', [requestId]);
    for (const m of ranked) {
      await q(
        `INSERT INTO matches (request_id,consultant_id,score,rationale,concerns) VALUES ($1,$2,$3,$4,$5)`,
        [requestId, m.consultant_id, m.score, m.rationale, m.concerns]
      );
    }
  } else {
    mem.matches = mem.matches.filter(m => m.request_id !== requestId);
    for (const m of ranked) mem.matches.push({ request_id: requestId, ...m });
  }
}

export async function getMatches(requestId) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM matches WHERE request_id=$1 ORDER BY score DESC', [requestId]);
    return rows;
  }
  return mem.matches.filter(m => m.request_id === requestId).sort((a, b) => b.score - a.score);
}

/* How many requests ever reached the matching step — the funnel needs this
   between "brief built" and "booked". */
export async function countRequestsWithMatches() {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT count(DISTINCT request_id)::int AS n FROM matches');
    return rows[0].n;
  }
  return new Set(mem.matches.map(m => m.request_id)).size;
}

/* ---------------------------------------------------------------- bookings */

/* Thrown when the slot is already held. The caller turns it into a 409 rather
   than a 500, because a taken slot is a normal outcome, not a fault. */
export class SlotTakenError extends Error {
  constructor(consultantId, slot) {
    super('That slot is no longer available');
    this.name = 'SlotTakenError';
    this.code = 'SLOT_TAKEN';
    this.consultantId = consultantId;
    this.slot = slot;
  }
}

export async function createBooking(requestId, consultantId, slot) {
  /* §DB-004 — full identifier. A truncated UUID is 32 bits of entropy for a
     value that appears in URLs and is used to look records up. */
  const id = 'bk_' + randomUUID();
  if (_mode === 'postgres') {
    try {
      await q('INSERT INTO bookings (id,request_id,consultant_id,slot,status) VALUES ($1,$2,$3,$4,$5)',
        [id, requestId, consultantId, slot, 'held']);
    } catch (e) {
      if (e && e.code === '23505') throw new SlotTakenError(consultantId, slot);
      throw e;
    }
  } else {
    /* The in-memory store has to keep the same promise, or the behaviour
       differs between a local run and production — which is exactly the class
       of bug that only shows up in front of a reviewer. */
    for (const b of mem.bookings.values()) {
      if (b.consultant_id === consultantId && b.slot === slot && ['held', 'confirmed'].includes(b.status)) {
        throw new SlotTakenError(consultantId, slot);
      }
    }
    mem.bookings.set(id, {
      id, request_id: requestId, consultant_id: consultantId, slot,
      status: 'held', created_at: new Date().toISOString()
    });
  }
  return id;
}

export async function getBooking(id) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM bookings WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.bookings.get(id) || null;
}

export async function listBookings() {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM bookings ORDER BY created_at DESC');
    return rows;
  }
  return [...mem.bookings.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function setBookingStatus(id, status) {
  if (_mode === 'postgres') await q('UPDATE bookings SET status=$2 WHERE id=$1', [id, status]);
  else { const b = mem.bookings.get(id); if (b) b.status = status; }
}

/* ----------------------------------------------------------- consultations */

export async function saveConsultation(bookingId, notes, summaryMd) {
  if (_mode === 'postgres') {
    await q(
      `INSERT INTO consultations (booking_id,notes,summary_md) VALUES ($1,$2,$3)
       ON CONFLICT (booking_id) DO UPDATE SET notes=EXCLUDED.notes, summary_md=EXCLUDED.summary_md`,
      [bookingId, notes, summaryMd]
    );
  } else {
    mem.consultations.set(bookingId, {
      booking_id: bookingId, notes, summary_md: summaryMd, created_at: new Date().toISOString()
    });
  }
}

export async function getConsultation(bookingId) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM consultations WHERE booking_id=$1', [bookingId]);
    return rows[0] || null;
  }
  return mem.consultations.get(bookingId) || null;
}

export async function listConsultations() {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM consultations');
    return rows;
  }
  return [...mem.consultations.values()];
}

/* ---------------------------------------------------------------- ai audit */

export async function logAiCall(rec) {
  const row = { id: 'ai_' + randomUUID(), created_at: new Date().toISOString(), ...rec };
  if (_mode === 'postgres') {
    await q(
      `INSERT INTO ai_calls (id,kind,model,request_id,stop_reason,input_tokens,output_tokens,cache_read,cache_write,ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [row.id, row.kind, row.model, row.request_id || null, row.stop_reason || null,
       row.input_tokens | 0, row.output_tokens | 0, row.cache_read | 0, row.cache_write | 0, row.ms | 0]
    );
  } else {
    mem.aiCalls.push(row);
  }
  return row.id;
}

export async function listAiCalls(limit = 200) {
  if (_mode === 'postgres') {
    const { rows } = await q('SELECT * FROM ai_calls ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows;
  }
  return mem.aiCalls.slice(-limit).reverse();
}

/* §OPS-002 — the pool has to be closed on shutdown, or Postgres keeps the
   connections until it times them out itself. */
/* ------------------------------------------------------------ page views */

export async function logPageView(row) {
  if (_mode === 'postgres') {
    await q(`INSERT INTO page_views (ts, visitor, path, country, bot, ref, mode)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.ts, row.visitor, row.path, row.country, row.bot, row.ref, row.mode]);
    return;
  }
  mem.pageViews.push(row);
  if (mem.pageViews.length > 20000) mem.pageViews.splice(0, mem.pageViews.length - 20000);
}

/* The country arrives after the row does — the geo lookup must not delay a
   response, so the row is written first and patched when the answer comes. */
export async function setPageViewCountry(ts, visitor, country) {
  if (_mode === 'postgres') {
    await q(`UPDATE page_views SET country = $3 WHERE ts = $1 AND visitor = $2 AND country IS NULL`,
      [ts, visitor, country]);
    return;
  }
  const r = mem.pageViews.find(x => x.ts === ts && x.visitor === visitor);
  if (r && !r.country) r.country = country;
}

export async function listPageViews(sinceIso) {
  if (_mode === 'postgres') {
    const { rows } = await q(
      `SELECT ts, visitor, path, country, bot, ref, mode
         FROM page_views WHERE ts >= $1 ORDER BY ts ASC LIMIT 200000`, [sinceIso]);
    return rows.map(r => ({ ...r, ts: new Date(r.ts).toISOString() }));
  }
  return mem.pageViews.filter(r => r.ts >= sinceIso);
}

export async function close() {
  if (_mode === 'postgres' && pool) await pool.end();
}
