/* =========================================================================
   Visit analytics — how many people, from where.

   WHAT THIS RECORDS

   One row per page view: a timestamp, the path, the referrer's host, an
   anonymous visitor id and a two-letter country code.

   WHAT IT DELIBERATELY DOES NOT RECORD

   The IP address. Not in the database, not in a log line, not in memory
   beyond the moment it takes to hash it. The visitor id is

       sha256(ip + '|' + user-agent + '|' + SECRET)  → first 16 hex chars

   which is stable for the same person on the same device — so "unique
   visitors" means something — and is not reversible into an address. The
   secret is generated per process unless ANALYTICS_SALT is set; setting it is
   what makes the id stable across restarts.

   COUNTRY, AND THE COMPROMISE IN IT

   Railway's proxy does not forward a client country header — its `edgeRegion`
   is where Railway's own edge sits, not where the visitor is. So:

     1. Several known country headers are checked first, in case the stand
        ever sits behind a CDN that provides one. Free, exact, no third party.
     2. Failing that, the address is MASKED to its /24 (IPv4) or /48 (IPv6)
        and only that prefix is sent to a public geo service, once per prefix,
        cached in memory. A prefix identifies a country reliably and a person
        far less well than a full address.

   That second step is a real tradeoff: a prefix still leaves this stand. It is
   opt-outable with ANALYTICS_GEO=off, in which case every country reads
   `unknown` and the visitor count still works. The lookup never blocks a
   response — the row is written immediately and the country filled in when
   the answer arrives.

   An offline database would avoid the third party entirely; the usual one
   (`geoip-lite`) unpacks to 115 MB, which is not a reasonable thing to add to
   a prototype's build. Stated here so the choice is visible rather than
   inferred.
   ========================================================================= */

import crypto from 'node:crypto';

const SALT = process.env.ANALYTICS_SALT || crypto.randomBytes(16).toString('hex');
const GEO_ON = String(process.env.ANALYTICS_GEO || 'on').toLowerCase() !== 'off';

/* Paths that are not a person looking at a page. Assets, health checks and the
   analytics endpoint itself would otherwise triple the numbers. */
const IGNORE = /^\/(api|assets|favicon|apple-touch-icon|robots|sitemap\.xml)|\.(css|js|svg|png|jpg|ico|map|woff2?)$/i;

/* Bots identify themselves, and the honest thing is to count them separately
   rather than to pretend they are visitors or to drop them silently. Yesterday
   every single hit on this stand was a link-preview crawler; a dashboard that
   showed "8 visitors" would have been worse than no dashboard. */
const BOT = /bot|crawler|spider|crawling|facebookexternalhit|facebot|twitterbot|slackbot|telegrambot|whatsapp|discordbot|preview|headless|lighthouse|curl\/|wget|python-requests|axios\/|go-http-client|NetworkingExtension/i;

const COUNTRY_HEADERS = [
  'cf-ipcountry',            // Cloudflare
  'x-vercel-ip-country',     // Vercel
  'x-country-code',          // some proxies
  'x-geo-country',
  'fastly-client-country'
];

/* ------------------------------------------------------------------ ids */

function visitorId(ip, ua) {
  return crypto.createHash('sha256')
    .update(String(ip || '') + '|' + String(ua || '') + '|' + SALT)
    .digest('hex').slice(0, 16);
}

/* /24 for IPv4, /48 for IPv6. Enough to place a country, not enough to place
   a household. */
/* Loopback and private ranges have no country and asking about them is a
   wasted round trip on every local request. */
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd|fe80)/i;

export function maskIp(ip) {
  const s = String(ip || '').replace(/^::ffff:/, '');
  if (!s || PRIVATE.test(s)) return '';
  if (s.includes(':')) return s.split(':').slice(0, 3).join(':') + '::';
  const p = s.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.${p[2]}.0` : '';
}

/* --------------------------------------------------------------- country */

const geoCache = new Map();          // masked prefix → country code
const geoPending = new Set();
const GEO_CACHE_MAX = 2000;

async function lookupCountry(prefix) {
  if (!GEO_ON || !prefix) return null;
  if (geoCache.has(prefix)) return geoCache.get(prefix);
  if (geoPending.has(prefix)) return null;
  geoPending.add(prefix);
  try {
    const ctl = AbortSignal.timeout ? AbortSignal.timeout(2500) : undefined;
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(prefix)}/country/`,
      { signal: ctl, headers: { 'User-Agent': 'tv-portal-prototype/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const code = (await r.text()).trim().toUpperCase();
    const ok = /^[A-Z]{2}$/.test(code) ? code : null;
    if (geoCache.size >= GEO_CACHE_MAX) geoCache.clear();
    geoCache.set(prefix, ok);
    return ok;
  } catch {
    /* A geo service being down must never cost a page view. The row is
       already stored; it simply keeps `unknown`. */
    geoCache.set(prefix, null);
    return null;
  } finally {
    geoPending.delete(prefix);
  }
}

/* ----------------------------------------------------------------- store */

/* In-memory ring. Used as the only store when DATABASE_URL is absent, and as
   a fast read path when it is present. 20 000 rows is roughly a fortnight of
   this stand's traffic and a few megabytes. */
const RING_MAX = 20000;
const ring = [];

function remember(row) {
  ring.push(row);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
}

/* ------------------------------------------------------------- recording */

let db = null;
export function useDb(mod) { db = mod; }

export function record(req) {
  try {
    const path = (req.path || '/').split('?')[0];
    if (IGNORE.test(path)) return null;

    const ua = String(req.get('user-agent') || '');
    const ip = req.ip || '';
    const isBot = BOT.test(ua) || !ua;

    let country = null;
    for (const h of COUNTRY_HEADERS) {
      const v = req.get(h);
      if (v && /^[A-Za-z]{2}$/.test(v.trim())) { country = v.trim().toUpperCase(); break; }
    }

    const prefix = maskIp(ip);
    if (!country && geoCache.has(prefix)) country = geoCache.get(prefix);

    const row = {
      ts: new Date().toISOString(),
      visitor: visitorId(ip, ua),
      path,
      country: country || null,
      bot: isBot,
      ref: refHost(req.get('referer')),
      mode: modeOf(req)
    };

    remember(row);
    if (db && db.logPageView) db.logPageView(row).catch(() => {});

    /* Resolve the country after responding, and patch the row in place. The
       page view is never delayed by a geo call. */
    if (!row.country && prefix) {
      lookupCountry(prefix).then(code => {
        if (!code) return;
        row.country = code;
        if (db && db.setPageViewCountry) db.setPageViewCountry(row.ts, row.visitor, code).catch(() => {});
      }).catch(() => {});
    }

    return row;
  } catch {
    /* Analytics may never be the reason a page fails to load. */
    return null;
  }
}

function refHost(referer) {
  if (!referer) return null;
  try {
    const h = new URL(referer).host;
    return h || null;
  } catch { return null; }
}

/* The visitor's chosen mode travels in a cookie only if the page set one; this
   stand keeps it in localStorage, so the server usually cannot see it. Read it
   if present, say nothing if not — rather than guessing. */
function modeOf(req) {
  const c = String(req.get('cookie') || '');
  const m = c.match(/(?:^|;\s*)ui_mode=(simple|standard|pro)\b/);
  return m ? m[1] : null;
}

/* --------------------------------------------------------------- reading */

const HOURS = { '1h': 1, '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

export async function summary(period = '24h') {
  const hours = HOURS[period] || 24;
  const since = Date.now() - hours * 3600 * 1000;

  let rows = ring.filter(r => Date.parse(r.ts) >= since);
  if (db && db.listPageViews) {
    try {
      const fromDb = await db.listPageViews(new Date(since).toISOString());
      if (Array.isArray(fromDb) && fromDb.length > rows.length) rows = fromDb;
    } catch { /* the ring is the fallback, and it is already loaded */ }
  }

  const people = rows.filter(r => !r.bot);
  const bots = rows.filter(r => r.bot);

  const uniq = list => new Set(list.map(r => r.visitor)).size;
  const tally = (list, key) => {
    const m = new Map();
    for (const r of list) {
      const k = r[key] || 'unknown';
      if (!m.has(k)) m.set(k, { key: k, views: 0, visitors: new Set() });
      const e = m.get(k);
      e.views++; e.visitors.add(r.visitor);
    }
    return [...m.values()]
      .map(e => ({ key: e.key, views: e.views, visitors: e.visitors.size }))
      .sort((a, b) => b.visitors - a.visitors || b.views - a.views);
  };

  /* An hourly histogram, oldest first, so a sparkline can be drawn without
     the client having to bucket anything. */
  const buckets = new Array(Math.min(hours, 720)).fill(0).map((_, i) => {
    const from = since + i * 3600 * 1000;
    const to = from + 3600 * 1000;
    const inBucket = people.filter(r => {
      const t = Date.parse(r.ts);
      return t >= from && t < to;
    });
    return { from: new Date(from).toISOString(), visitors: uniq(inBucket), views: inBucket.length };
  });

  return {
    ok: true,
    period,
    since: new Date(since).toISOString(),
    generated_at: new Date().toISOString(),
    geo_enabled: GEO_ON,
    salt_is_stable: Boolean(process.env.ANALYTICS_SALT),
    storage: db && db.logPageView ? 'database + memory' : 'memory only',
    visitors: uniq(people),
    views: people.length,
    bot_views: bots.length,
    bot_visitors: uniq(bots),
    countries: tally(people, 'country'),
    pages: tally(people, 'path').slice(0, 25),
    referrers: tally(people.filter(r => r.ref), 'ref').slice(0, 15),
    modes: tally(people.filter(r => r.mode), 'mode'),
    hourly: buckets
  };
}

/* Exposed for the tests: they need to be able to write a row without an HTTP
   request and to clear what previous checks left behind. */
export const _ring = ring;
export function _reset() { ring.length = 0; geoCache.clear(); }
export function _push(row) { remember(row); }
export { visitorId as _visitorId };
