# Source audit — confirmed findings

Every item below was reproduced in the source before it was changed. Items that were claimed but
did not reproduce are listed at the end, because an audit that only confirms is not an audit.

## P0 — security and privacy

| ID | Finding | Reproduced as |
|---|---|---|
| SEC-001 | `staffOnly()` began `if (!STAFF_TOKEN) return next()` and also accepted `req.query.token` | A deployment that forgot the variable served the consultant desk and the metrics screen — real enquiries with names and emails — to anyone with the URL. A token in the query string is copied into history, proxy logs and referrers. |
| SEC-002 | Staff token stored in `localStorage` under `em.token` | A long-lived credential readable by any script that ever runs on the origin. |
| SEC-003 | `GET /api/requests/:id` and `POST /:id/match` had no ownership check; ids were `req_` + 8 hex characters | Knowing an id returned somebody's name, email, country, capital band and free-text story, and triggered a paid model call. |
| SEC-004 | One consent checkbox covered consultant sharing; AI processing was not mentioned | A model structures the text and ranks people against it — a separate purpose with no separate answer. |
| SEC-005 | `fail()` returned `err.message` verbatim | A database error handed the visitor the SQL; a provider failure handed them the provider's wording. |
| SEC-006 | No security headers | No `nosniff`, no frame policy, no referrer policy, no HSTS. |
| SEC-007 | One in-memory limiter, on the Copilot only | It read `x-forwarded-for` without trusting the proxy (client-settable), and cleared the **entire** map at 5,000 keys — so filling it reset everyone's counter. Brief generation, matching and booking were unlimited. |

## P0 — truthfulness

| ID | Finding | Reproduced as |
|---|---|---|
| EXP-001 | `features.js` described Expert Marketplace as *"Licensed advisers verified by regulator and jurisdiction"* while the README states licence integration is deliberately absent and licences are demo data | The single most damaging line on a stand whose argument is trust. |
| EXP-003 | Booking rendered a green `CONFIRMED` tag | No calendar, no payment, no consultant acceptance existed. |
| CHART-002 | The chart claimed "40 tools" | There are three drawing controls and eight toolbar buttons. |
| CHART-004 | The chart disclaimer said it "is not connected to a market data feed" | It fetches the same delayed quotes as the rest of the portal. |
| ARCH-002 | Docs claimed 970 passing checks | The suites existed and passed, but lived outside the repository. For anyone reading the ZIP they did not exist. |
| ARCH-001 | `package.json`, README and the server log described the whole portal as "Expert Marketplace" | Stale identity from when that was the entire product. |

## P0 — correctness

| ID | Finding | Reproduced as |
|---|---|---|
| MKT-001 | `refresh()` replaced the cache unconditionally | `fetchAll` converts every failure into `{ok:false}` and never throws, so `refresh()` never threw either. The comment on `snapshot()` promised the previous snapshot would survive a total outage; in fact it was overwritten with 49 failures. |
| ROUTE-001 | The Copilot action endpoint returned `/charts.html` | A path that has been a 301 for two releases — an extra round trip and a legacy URL in the analytics. |
| ROUTE-004 | No 404 page | Unknown paths fell through to Express's plain-text `Cannot GET /x`. |
| UI-002 | "Create an alert" and "Ask the Copilot" both opened the Copilot | Two promises, one behaviour, and the alerts list stayed empty however many times you pressed it. |
| UI-003 | The home CTA added BTC and TSLA to an empty watchlist and reported it saved | Choosing financial instruments on somebody's behalf and calling it their choice. |
| UI-005 | Following an event changed a button label and nothing else | Gone on reload. |
| UI-006 | `Sign in` was a `<span>` | Not focusable, not a control to assistive technology, and it did nothing. |
| CSS-001 | The mobile block sat **above** the base `.portal-nav` rules | Same selector, same specificity, later in the file — so the desktop height and the search box won on a phone. The media query looked present and did nothing. |
| A11Y-001 | No `<h1>` on the chart and lesson pages | |
| A11Y-002 | 120 buttons with no explicit `type` | Inside a form the default is submit. |
| ASSET-003 | The signal summary said readings were "above their reference" and stamped them with the browser's clock | The computation time shown was not the time of the data. |
| WEALTH-002 | *"Diversification is the only thing in investing that is close to free"* | An unsourced absolute claim on a page that also disclaims giving advice. |
| WEALTH-003 | The scenario table coloured the "after" column green when it judged the change an improvement | Nothing there knows the visitor's objective. |
| ACADEMY-003 | Registration used `alert()` | Unstyleable, blocking, and its text said nothing about where progress actually lives. |
| DB-004 | Truncated UUIDs for requests, bookings and AI calls | 32 bits of entropy on values that appear in URLs. |
| EXP-002 | No uniqueness on `(consultant_id, slot)` | Two people could hold the same time and both be told it was theirs. |
| EXP-004 | Booking trusted the client-supplied consultant id | A request from one jurisdiction could book an adviser filtered out for it by editing one field. |

## Claimed but not reproduced

- **MODE-001 — "`home.js` and `ia.js` define their own mode logic."** Partly stale: both delegate to
  `modes.js` since the mode refactor. They *do* still carry a local `ORDER` map as a fallback for
  when `modes.js` fails to load; that duplication is real and is on the P1 list, but the model is no
  longer defined three times.
- **MODE-002 and MODE-003 — temporary disclosure and state preservation.** Already implemented and
  covered by 201 assertions in `tests/browser/mode-test.cjs`.
- **"Tabs become active without content" (UI-001).** The nine asset-hub tabs scroll to sections that
  exist; four of them are pilot sections whose content is a labelled stub rather than an empty
  panel. Worth improving, not the defect described.

## Not fixed in this pass, and why

- **CSP (part of SEC-006).** A strict policy needs the inline scripts extracted first (ARCH-003).
  A policy with `unsafe-inline` permits exactly what it exists to prevent, so the header is absent
  and the reason is written in the code rather than the gap being left silent.
- **DB-001 migrations.** The schema still uses `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE … IF
  NOT EXISTS` for the new columns. That is honest for a single-instance prototype and is on the
  backlog.
- **SEO-004 server-rendered symbol pages** and **ARCH-003/004 shared shell** — P1, listed in
  [`source-audit-remaining-backlog.md`](source-audit-remaining-backlog.md).
