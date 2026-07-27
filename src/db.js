/* =========================================================================
   Слой хранения.

   Если задан DATABASE_URL — работаем на Postgres (продовый путь, Railway).
   Если нет — поднимаем то же API поверх памяти процесса, чтобы сервис можно
   было запустить локально без базы. Память честно помечена как непостоянная:
   данные исчезают при перезапуске, и /api/health это показывает.
   ========================================================================= */

import pg from 'pg';
import { randomUUID } from 'node:crypto';

const URL = process.env.DATABASE_URL || '';
export const MODE = URL ? 'postgres' : 'memory';

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
  language      TEXT NOT NULL DEFAULT 'ru',
  capital_band  TEXT NOT NULL,
  goal_text     TEXT NOT NULL,
  consent       BOOLEAN NOT NULL DEFAULT FALSE,
  brief         JSONB,
  brief_error   TEXT
);

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
  status        TEXT NOT NULL DEFAULT 'booked',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consultations (
  booking_id    TEXT PRIMARY KEY,
  notes         TEXT NOT NULL,
  summary_md    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

/* Демо-ростер. Лицензии помечены как непроверенные — это пилот, а не реестр. */
const SEED = [
  { id: 'c1', name: 'А. Ковалёв',  jurisdiction: 'RU', languages: ['ru'],        specialties: ['первые шаги', 'облигации', 'налоги'],           license_id: 'DEMO-RU-001', capital_min: 0,       capital_max: 5000000,  rate_hour: 6000,  bio: 'Работает с теми, кто впервые выходит за пределы депозита.' },
  { id: 'c2', name: 'M. Iversen',  jurisdiction: 'EU', languages: ['en', 'de'],  specialties: ['портфель', 'ETF', 'пенсионные счета'],          license_id: 'DEMO-EU-014', capital_min: 1000000, capital_max: 50000000, rate_hour: 14000, bio: 'Долгосрочные портфели, распределение активов, горизонты 10+ лет.' },
  { id: 'c3', name: 'S. Rao',      jurisdiction: 'IN', languages: ['en', 'hi'],  specialties: ['первые шаги', 'акции', 'риск'],                 license_id: 'DEMO-IN-207', capital_min: 0,       capital_max: 2000000,  rate_hour: 3500,  bio: 'Объясняет риск на простых примерах, много работает с новичками.' },
  { id: 'c4', name: 'J. Whitfield',jurisdiction: 'US', languages: ['en'],        specialties: ['портфель', 'налоги', 'концентрация позиции'],   license_id: 'DEMO-US-882', capital_min: 5000000, capital_max: null,     rate_hour: 22000, bio: 'Крупный капитал, концентрированные позиции, налоговая оптимизация.' },
  { id: 'c5', name: 'Е. Соколова', jurisdiction: 'RU', languages: ['ru', 'en'],  specialties: ['крипта', 'риск', 'диверсификация'],             license_id: 'DEMO-RU-045', capital_min: 100000,  capital_max: 10000000, rate_hour: 9000,  bio: 'Крипто-активы в контексте общего портфеля, без хайпа.' }
];

/* ------------------------------------------------------------------ postgres */

let pool = null;

function pgConfig() {
  // Внутренний хост Railway TLS не требует, внешний — требует.
  const internal = /\.railway\.internal|localhost|127\.0\.0\.1/.test(URL);
  return { connectionString: URL, ssl: internal ? false : { rejectUnauthorized: false } };
}

/* ------------------------------------------------------------------- memory */

const mem = {
  consultants: new Map(),
  requests: new Map(),
  matches: [],
  bookings: new Map(),
  consultations: new Map(),
  aiCalls: []
};

/* ------------------------------------------------------------------- init */

export async function init() {
  if (MODE === 'postgres') {
    pool = new pg.Pool(pgConfig());
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
  } else {
    for (const c of SEED) {
      mem.consultants.set(c.id, { ...c, license_state: 'unverified', active: true });
    }
  }
}

const q = (text, params) => pool.query(text, params);

/* ------------------------------------------------------------- consultants */

export async function listConsultants() {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM consultants WHERE active ORDER BY name');
    return rows;
  }
  return [...mem.consultants.values()].filter(c => c.active);
}

export async function getConsultant(id) {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM consultants WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.consultants.get(id) || null;
}

/* ---------------------------------------------------------------- requests */

export async function createRequest(r) {
  const id = 'req_' + randomUUID().slice(0, 8);
  if (MODE === 'postgres') {
    await q(
      `INSERT INTO requests (id,contact_name,contact_email,country,language,capital_band,goal_text,consent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, r.contact_name, r.contact_email, r.country, r.language, r.capital_band, r.goal_text, r.consent]
    );
  } else {
    mem.requests.set(id, { id, created_at: new Date().toISOString(), brief: null, brief_error: null, ...r });
  }
  return id;
}

export async function setBrief(id, brief, error) {
  if (MODE === 'postgres') {
    await q('UPDATE requests SET brief=$2, brief_error=$3 WHERE id=$1',
      [id, brief ? JSON.stringify(brief) : null, error || null]);
  } else {
    const r = mem.requests.get(id);
    if (r) { r.brief = brief || null; r.brief_error = error || null; }
  }
}

export async function getRequest(id) {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM requests WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.requests.get(id) || null;
}

export async function listRequests(limit = 50) {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM requests ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows;
  }
  return [...mem.requests.values()]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit);
}

/* ----------------------------------------------------------------- matches */

export async function saveMatches(requestId, ranked) {
  if (MODE === 'postgres') {
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
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM matches WHERE request_id=$1 ORDER BY score DESC', [requestId]);
    return rows;
  }
  return mem.matches.filter(m => m.request_id === requestId).sort((a, b) => b.score - a.score);
}

/* ---------------------------------------------------------------- bookings */

export async function createBooking(requestId, consultantId, slot) {
  const id = 'bk_' + randomUUID().slice(0, 8);
  if (MODE === 'postgres') {
    await q('INSERT INTO bookings (id,request_id,consultant_id,slot) VALUES ($1,$2,$3,$4)',
      [id, requestId, consultantId, slot]);
  } else {
    mem.bookings.set(id, {
      id, request_id: requestId, consultant_id: consultantId, slot,
      status: 'booked', created_at: new Date().toISOString()
    });
  }
  return id;
}

export async function getBooking(id) {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM bookings WHERE id=$1', [id]);
    return rows[0] || null;
  }
  return mem.bookings.get(id) || null;
}

export async function listBookings() {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM bookings ORDER BY created_at DESC');
    return rows;
  }
  return [...mem.bookings.values()].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function setBookingStatus(id, status) {
  if (MODE === 'postgres') await q('UPDATE bookings SET status=$2 WHERE id=$1', [id, status]);
  else { const b = mem.bookings.get(id); if (b) b.status = status; }
}

/* ----------------------------------------------------------- consultations */

export async function saveConsultation(bookingId, notes, summaryMd) {
  if (MODE === 'postgres') {
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
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM consultations WHERE booking_id=$1', [bookingId]);
    return rows[0] || null;
  }
  return mem.consultations.get(bookingId) || null;
}

export async function listConsultations() {
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM consultations');
    return rows;
  }
  return [...mem.consultations.values()];
}

/* --------------------------------------------------------------- ai audit */

export async function logAiCall(rec) {
  const row = { id: 'ai_' + randomUUID().slice(0, 8), created_at: new Date().toISOString(), ...rec };
  if (MODE === 'postgres') {
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
  if (MODE === 'postgres') {
    const { rows } = await q('SELECT * FROM ai_calls ORDER BY created_at DESC LIMIT $1', [limit]);
    return rows;
  }
  return mem.aiCalls.slice(-limit).reverse();
}
