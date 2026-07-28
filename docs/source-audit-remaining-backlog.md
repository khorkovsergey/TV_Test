# Source audit — remaining backlog

What the audit raised and this pass did not do, with the reason. Everything here is a scope
decision, not an oversight.

## P1 — architecture

**ARCH-003 — extract the inline scripts.** `symbol.html`, `charts.html`, `index.html`,
`wealth.html`, `screener.html`, `markets.html` and `experts.html` carry large inline blocks. They
are syntax-checked now, but they cannot be unit-tested, they duplicate logic across pages, and they
are the reason a strict CSP is impossible. Target: `public/pages/*.js` with the HTML left semantic.
This is the single highest-leverage item on the list — it unblocks the CSP and removes most of the
copy drift.

**ARCH-004 — one shared shell.** The header and footer are duplicated across 25 pages in at least
two variants. Options that fit a no-build stand: server-side includes, or three small Web Components
(`<portal-header>`, `<portal-footer>`, `<prototype-disclaimer>`). Until then, a nav change means 25
edits, which is how variants appear in the first place.

**ARCH-005 — the stale global disclaimer.** Several pages still say the experts flow and the Copilot
are the only functional services. That was true two releases ago; watchlists, alerts, saved screens,
Academy progress and the wealth profile all persist now. The disclaimer should be generated from the
feature registry's maturity data rather than written by hand per page.

**ARCH-006 — central copy.** `public/copy.js` or a real dictionary. The lint rule exists; the
dictionary does not.

**MODE-001 — the last duplicate `ORDER` maps.** `home.js` and `ia.js` still carry a local level
order as a fallback for when `modes.js` fails to load. Small, real, and worth removing once the
shared shell guarantees load order.

## P1 — data and operations

**DB-001 — migrations.** The schema uses `CREATE TABLE IF NOT EXISTS` plus `ALTER TABLE … ADD COLUMN
IF NOT EXISTS`. Honest for one instance; a `migrations/` directory with a runner is the right shape
before anyone else deploys this.

**DB-002/DB-003 — foreign keys and remaining indexes.** Indexes on `requests.created_at`,
`matches.request_id`, `bookings.request_id`, `bookings.consultant_id` and the unique booking slot
are in. Foreign keys between requests, matches, bookings, consultants and consultations are not.

**DB-006 — deletion endpoint.** `DELETE /api/requests/:id` behind the existing ownership token, plus
a scheduled purge for the 90-day policy in [`data-retention.md`](data-retention.md). The policy is
written; the automation is not.

**DB-007 — TLS verification.** `rejectUnauthorized: false` is still in the Postgres config for
Railway's certificate chain. Documented rather than removed, because removing it without testing
against Railway's actual chain would break the deploy.

**OPS-003/OPS-004 — compression, cache headers and structured logging.** `no-store` on `/api/*` is
in. Compression, immutable caching for static assets, and request-id logging are not.

## P1 — product depth

**COP-001…005 — Copilot.** Context detection still collapses several surfaces into `portal`; chips
are built once and do not update after a symbol or mode change; conversation history is not
persisted; sources show hostnames rather than titles and links. The register now differs across all
three modes and the action count follows the policy — the rest is open.

**CHART-003 — selected-period intelligence is hardcoded.** The same July window and the same CPI/ETF
explanation appear for every instrument. It needs a small event model keyed by symbol and date range,
with an empty state when nothing matches, and sample data labelled as sample.

**CHART-005 — audit every toolbar control.** The count is honest now (11, not 40), but each control
should be classified functional / prototype / disabled rather than all rendering as active.

**ASSET-001 — the Event Chip is a universal FOMC countdown.** Same fix as CHART-003: real event data
keyed by symbol, absent when there is nothing relevant, rather than one hardcoded event everywhere.

**ASSET-002 — journey actions that only disable a button.** Every journey step needs a route,
context and a completion condition; no success state without a completed action.

**ASSET-004 — the feature rail is always on.** Three strategic promos on every asset visit is
advertising. It should key off what the visitor has already done.

**ACADEMY-002 — lessons complete on "mark as read".** The first track should complete from shared
state: adding to a watchlist completes the watchlist step, creating an alert completes the alert
step. The alert store built for UI-002 makes this straightforward now.

**UI-001 — pilot tab panels.** All nine asset-hub tabs scroll to sections that exist, but four lead
to labelled stubs. Either build them or mark them `coming-soon` in a tab registry.

## P2

- **SEO-002/SEO-004** — per-route metadata, canonicals, Open Graph, and server-rendered symbol pages.
  `robots.txt` and `sitemap.xml` are environment-aware now and default to *not indexed*; the rest
  matters only if the stand is ever meant to be public.
- **PERF-001…004** — drop the PNG fallbacks where WebP suffices, route-level script loading, lazy
  mounting of Pro-only modules, and virtualised tables.
- **A11Y-003…006** — native controls in place of clickable spans (the segmented pickers on the expert
  form remain), focus traps in the command palette and Copilot, `prefers-reduced-motion` on
  programmatic scrolling, and full mega-menu keyboard behaviour.
- **Localisation** — deferred by decision; the estimate stands in
  [`phase-3-remaining-backlog.md`](phase-3-remaining-backlog.md).

## Outside the code — owner decisions

**`DATABASE_URL` still does not reach the Railway service.** `/api/system/status` reports
`storage: memory`; enquiries are lost on every restart. Fix: in the service's own Variables tab, add
`DATABASE_URL = ${{Postgres.DATABASE_URL}}`.

**`STAFF_TOKEN` must be set before the next deploy.** Staff endpoints now fail closed in production:
without the variable they return 503. That is the intended behaviour, and it is a change from
"quietly open", so it needs the variable set rather than discovering it later.

**The stand is public and carries real brand assets.** Two options remain: password-gate everything,
or de-brand. Until one is chosen the disclosures carry the load, and they should not have to.
