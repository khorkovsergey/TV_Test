# Visit analytics

How many people, from where. Added because the question "who visited yesterday?" had no answer at
all: the server logged nothing, and the client-side `Portal.track()` writes to the visitor's own
`localStorage`, where the owner of the site cannot see it.

## Where to look

```
/metrics  →  "Who visited"     (staff token required)
GET /api/analytics?period=1h|24h|7d|30d   (staff token required)
```

Staff-only. The data is aggregate and anonymous, but it is still traffic data and does not belong
on a public endpoint.

## What is recorded

One row per page view:

| field | example | note |
|---|---|---|
| `ts` | `2026-07-29T08:14:02Z` | |
| `visitor` | `9f3a1c…` (16 hex) | salted hash, see below |
| `path` | `/economy` | query string dropped |
| `country` | `ES` | two letters, or `null` |
| `bot` | `false` | |
| `ref` | `t.me` | referrer **host** only |
| `mode` | `simple` | only if a `ui_mode` cookie exists; this stand keeps the mode in localStorage, so usually `null` |

## What is NOT recorded

**The IP address.** Not in the database, not in a log line, not held in memory past the moment it
takes to hash it. There is no column for it and nothing to leak.

The visitor id is:

```
sha256(ip + '|' + user-agent + '|' + SECRET) → first 16 hex characters
```

Stable for the same person on the same device — so "unique visitors" means something — and not
reversible into an address.

**Set `ANALYTICS_SALT`** to a long random string. Without it a fresh secret is generated per
process, and every restart makes returning visitors look new. The dashboard says so when it is
unset rather than quietly reporting inflated numbers.

## Bots are counted, never mixed in

Every hit on this stand on 28 July was a link-preview crawler — `facebookexternalhit`, `Facebot`,
`Twitterbot`, plus iOS fetching a touch icon, all eight inside one second. A dashboard reporting
"8 visitors" would have been worse than no dashboard.

Requests whose user-agent matches a known crawler, or which send no user-agent at all, are recorded
with `bot: true` and reported in their own KPI. They never enter the visitor or page counts.

Asset requests (`.css`, `.js`, `.svg`, images, fonts) and `/api/*` are not counted at all — they are
one page view arriving in pieces, not several visits.

## Country, and the compromise in it

Railway's proxy does **not** forward a client country header. Its `edgeRegion` field is where
Railway's own edge sits, not where the visitor is — reading it as geo would be wrong in a way that
looks right.

So, in order:

1. **Known country headers** are checked first — `cf-ipcountry`, `x-vercel-ip-country` and three
   others — in case the stand ever sits behind a CDN that provides one. Free, exact, no third
   party. Tested and working.
2. **Failing that**, the address is masked to its **/24** (IPv4) or **/48** (IPv6) and only that
   prefix goes to a public geo service, once per prefix, cached in memory for the process lifetime.

`212.169.220.210` becomes `212.169.220.0`, which resolves to `ES` — a prefix places a country
reliably and a person far less well than a full address does.

**This is a real tradeoff and it is stated on the dashboard, not just here:** a prefix still leaves
the stand. Set `ANALYTICS_GEO=off` to disable it entirely; visitor counts keep working and every
country reads `unknown`.

Private and loopback ranges are never sent anywhere.

The lookup **never blocks a response.** The row is written immediately and the country patched in
when the answer arrives, so a slow or dead geo service costs a page view nothing.

An offline database would avoid the third party completely. The usual one, `geoip-lite`, unpacks to
**115 MB** — not a reasonable thing to add to a prototype's build, so it was rejected. Recorded here
so the choice is visible rather than inferred.

## The timeline: arrival, transitions, time on page

`/metrics` → **VISITS** shows one row per visit — arrival time, country, page count, total time,
referrer — expanding into the step-by-step path: step number, clock time, page, seconds spent.

A **visit** ends after 30 minutes without a page view. The convention every analytics tool uses,
written into the code rather than assumed.

### Time on page has two sources, and they are never mixed

The server sees an arrival and then silence, and silence is identical whether somebody read for
four minutes or closed the tab at once. So:

| source | how | accurate for |
|---|---|---|
| **measured** | the page itself reports its *visible* milliseconds on `pagehide` / `visibilitychange`, via `navigator.sendBeacon` | any page, **and the only way to know the last page of a visit** |
| **inferred** | the gap to that visitor's next page view | every page except the last |

The dashboard renders them differently — measured in white, inferred in grey with a `~`. "4 minutes,
measured" and "4 minutes, calculated from the next click" are different claims and are not allowed
to look alike.

A last page with no beacon shows **an em-dash, not a zero**. Zero would average beautifully and be
a lie.

### What the beacon sends, and what it cannot do

`{ path, ms }` — nothing else. No id: the server derives the visitor hash from the same request it
already sees, so a page cannot attribute time to somebody else.

Only **visible** time counts. A tab left open in the background for an hour is not an hour of
reading. Anything over an hour is discarded as "left it open" rather than averaged in, and under
500 ms is discarded as passing through.

`POST /api/analytics/dwell` is deliberately **not** staff-gated: it is the visitor's own browser
reporting on the visitor's own visit, and it can only ever write a duration onto a row that request
already created.

## Storage

With `DATABASE_URL` set: a `page_views` table, plus an in-memory ring as a fast read path.

Without it: **the ring only** — 20 000 rows, lost on every restart and every deploy. The stand is
currently in this state; `/api/system/status` reports `storage: memory`. The dashboard says which
one is in force rather than letting the reader assume.

## What it does not answer

- **Cross-device identity.** A visit from a phone and one from a laptop are two visitors, always.
- **Who, personally.** By design. Identifying visitors needs a legal basis and a consent banner,
  and this is a public case-study stand carrying brand assets it does not own — the wrong place for
  it.
- **Anything before it was deployed.** Railway's own HTTP logs cover the period before this, for as
  long as the plan retains them.

## Limitations worth knowing before quoting a number

A visitor on a phone and the same person on a laptop count as two — different user-agent, different
address.

A visitor behind a shared corporate NAT with an identical browser build can collapse into one.

`unknown` in the geo table is not an error: it is a private address, a failed lookup, or geo turned
off.
