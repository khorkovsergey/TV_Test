# Source audit — implementation result

Every item below was reproduced in the source before it was changed. Findings and the ones that did
not reproduce are in [`source-audit-confirmed-findings.md`](source-audit-confirmed-findings.md);
what was deliberately left is in
[`source-audit-remaining-backlog.md`](source-audit-remaining-backlog.md).

## Security

**SEC-001 — staff endpoints fail closed.** `if (!STAFF_TOKEN) return next()` is gone. In production
the staff endpoints return 503 when the token is unconfigured; in development they stay open. Not a
startup crash, on purpose: taking the whole portal down because one optional area is unconfigured is
the failure mode OPS-001 warns about. The query-string token is gone entirely — header only,
constant-time comparison, generic `Unauthorised` that does not reveal whether a token exists.

**SEC-002 — no credential in localStorage.** The staff and metrics pages use `sessionStorage`, and
delete any value earlier builds left in `localStorage` on load.

**SEC-003 — request ownership.** The identifier and the credential are separate objects now: a full
UUID identifies the record, a 256-bit token proves you created it, and only `sha256(token)` is
stored. `GET /api/requests/:id`, `POST /:id/match` and `POST /api/bookings` all require it in
`Authorization: Bearer` or `X-Request-Token`. A wrong token returns 404 rather than 403 —
confirming an id exists is itself a leak. The client keeps the token in `sessionStorage`, never in
the URL.

**SEC-004 — AI consent is separate.** Two checkboxes, neither preselected: a model reading and
structuring the text is a different purpose from a consultant reading the result. Recorded with a
version and a timestamp, plus a plain statement of what is stored and a warning not to paste account
numbers into a free-text box.

**SEC-005 — errors return an id.** Production clients get
`{"error": "The request could not be completed", "error_id": "err_…"}`; the internal error goes to
the log under that id. Operational errors keep their specific safe messages (422 refusal, 503 no
key, 409 taken slot).

**SEC-006 — headers.** `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, HSTS in production, `no-store` on `/api/*`. No CSP, with the reason
written in the code rather than the gap left silent.

**SEC-007 — real rate limits.** `trust proxy` set so `req.ip` is the client on Railway. Three
classes — AI 20/min, writes 12/min, bookings 6/min — with `Retry-After`. Eviction is per key and by
age; the old code cleared the entire map at 5,000 keys, which made filling it a way to reset
everyone's counter.

## Truthfulness

**EXP-001 — one field became three.** `maturity` (live/beta/prototype/concept), `releaseMarker`
(new/improved) and `commercialTier` (included/premium) are independent now. Expert Marketplace is
`prototype`, and the claim *"Licensed advisers verified by regulator and jurisdiction"* is replaced
by copy that states licences are demo records checked against no registry. `npm run check:copy`
fails the build if it comes back.

**EXP-003 — bookings are held, not confirmed.** The green `CONFIRMED` tag is gone; the state is
`HELD IN PROTOTYPE · AWAITING CONSULTANT CONFIRMATION`, with a paragraph explaining that no calendar
is connected, nothing is charged, and the consultant is a demo record. The database default changed
to `held`.

**EXP-002 — a slot cannot be double-booked.** Unique index on `(consultant_id, slot)` for held and
confirmed rows, a `SlotTakenError` that becomes a 409 rather than a 500, and the same rule enforced
in the in-memory store so local behaviour matches production.

**EXP-004 — the consultant must be on the shortlist.** Booking re-runs the hard filter for that
enquiry and refuses a consultant it excludes. A client-supplied id is a suggestion, not an
authority.

**CHART-002/004 — honest counts and disclosure.** "40 tools" became "11 controls", which is what
exists. The disclaimer now separates what is real (the price line, the side panel and the instrument
switcher use the same delayed quotes as the rest of the portal) from what is a prototype surface
(drawing tools, indicators, replay, selected-period intelligence).

**ARCH-001 — project identity.** `package.json`, the README and the server log describe the portal;
the concierge-MVP rationale moved to [`expert-marketplace.md`](expert-marketplace.md).

**ARCH-002 — the tests are in the repository.** Ten suites moved from a scratch directory into
`tests/browser/`, with `tests/run.cjs` booting the server once and running them all. The README no
longer states counts — the test output does.

## Correctness

**MKT-001 — the cache survives an outage.** `refresh()` now measures quality before replacing:
zero successes or under 50% throws, the previous snapshot stays, and a symbol that failed keeps its
last known value marked `retained`. The snapshot reports `quality`, `retained_count` and the
retained symbols, so a page can say some rows are older instead of quietly mixing them.

**ROUTE-001 — one route registry.** `src/routes.js` holds every canonical path; Express routing,
redirects and the Copilot's action responses all read from it. The Copilot returned `/charts.html`,
a two-release-old redirect.

**ROUTE-004 — a 404 page that helps.** It states what was asked for, offers search, the six
sections and the site map, and guesses the five closest destinations from the information
architecture. API paths get JSON.

**UI-002 — alerts are real.** `public/alerts.js` is a shared store: symbol, condition, threshold,
note, persistence, removal, and an `alerts-changed` event. "Create an alert" opens a small dialog
and creates one; "Ask the Copilot" opens the Copilot. They used to do the same thing, and neither
produced an alert. `/capital` lists them from the same store.

**UI-003 — no silent instrument selection.** The home CTA used to add BTC and TSLA to an empty
watchlist and report it saved. It asks now, with an explicit "use a sample list" button.

**UI-005 — following an event persists.** A stored object with a timestamp, not a button label.

**UI-006 — Sign in is a button.** Focusable, typed, and it says accounts are not connected and where
progress actually lives.

**CSS-001 — the cascade bug.** The mobile block sat above the base `.portal-nav` rules, so the
desktop height and the search box won on a phone. Base first, overrides last, plus a 720px block for
the header at phone widths.

**A11Y-001/002.** `<h1>` on the chart and lesson pages, visually hidden where the layout has no room
for one. 120 buttons got an explicit `type="button"`.

**ASSET-003 — the signal summary.** Renamed, thresholds stated, "above their reference" replaced by
what each reading actually measures, data sufficiency reported, and the timestamp is the quote's
`asOf` rather than the clock on the visitor's device.

**WEALTH-002/003 — no verdicts.** *"Diversification is the only thing in investing that is close to
free"* is gone. The scenario table shows direction of change (↑/↓) instead of colouring an outcome
green, and lists its model assumptions: the ETF proxy is one broad equity holding, no return, fee,
tax or spread is modelled, nothing rebalances.

**ACADEMY-003 — no `alert()`.** An inline panel that says the progress is already saved, in this
browser, and that there is nothing to sign up for.

**DB-004 — full identifiers** for requests, bookings and AI calls.

**OPS-001 — health split.** `/health/live` (process), `/health/ready` (core portal — what Railway
now checks), `/api/system/status` (optional integrations). An unset AI key no longer makes the
service look unhealthy.

**OPS-002 — graceful shutdown.** Stop accepting, drain, close the Postgres pool, forced exit after
10 seconds, structured logs.

**DB-005 — memory storage is loud.** Production without a database logs three warning lines and
reports it in `/api/system/status`; `DEMO_EPHEMERAL=true` acknowledges it deliberately.

**SEO-001/003.** `robots.txt` and `sitemap.xml` are environment-aware and default to *not indexed* —
correct for a stand carrying brand assets it does not own. `PUBLIC_INDEX=true` flips it, and even
then staff, metrics, showcase and the A/B control stay out.

## New checks

```
npm run check:syntax   47 files and inline blocks, including every public/*.js and every <script>
npm run check:copy     banned spellings + unverifiable verification claims
npm test               10 browser suites against a real server
```

The old `npm run check` covered four server files and missed `market.js`, `copilot.js`, all browser
modules and every inline block.

## Test results

All suites green: rel 157 · mode 201 · fix 122 · phase3 116 · home 101 · v2 87 · data 80 ·
progressive 71 · bg 52 · academy 37. Syntax and copy gates clean.

## Deployment notes

- **Set `STAFF_TOKEN` before the next deploy.** Staff endpoints now refuse without it in production.
  That is the intended change; discovering it from a 503 would be worse than reading it here.
- `railway.json` healthcheck moved to `/health/ready`.
- `DATABASE_URL` still needs adding to the service's own Variables tab.
- New environment variables: `PUBLIC_INDEX`, `DEMO_EPHEMERAL`.
