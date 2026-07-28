# Phase 5 + 6 — remaining backlog

P0-A and P0-B are done and deployed. This is what the master prompt asks for that is **not** built,
stated plainly rather than implied as present.

## P0 items completed

Navigation: separate user-navigation registry · Overview out of the top level · Capital → My Budget ·
workspace behind the profile · no `MAPPED`/`PILOT`/`PRO` in normal menus · Home reduced to three
tasks with money first · one flagship block instead of eight equal cards · `verified broker` copy
removed · hardcoded FOMC removed from the task copy.

My Budget: versioned data model · Quick Add · income, expense, transfer · monthly overview ·
categories · goals with contribution-based projection · emergency fund · debts · net worth ·
recurring · export/delete · onboarding that never asks about holdings · `/money` and eight
sub-routes with 301s from `/capital` and `/capital/wealth` · legacy import with preview ·
95-check suite including the full fitness-trainer scenario.

## P0 items not completed

**Mobile bottom navigation (§7.3).** The header still renders six sections as a scrollable row at
narrow widths. `portal.css` has the 720px block from the earlier phase, but a purpose-built bottom
nav with `Home · Markets · My Budget · Research · More` plus a contextual `+` in My Budget does not
exist. This is the largest missing P0 item and the one a phone visitor notices first.

**Permanent prototype strip (§13.4).** Still on every page. Replacing it with a compact header
badge plus contextual warnings touches 25 pages and the `bg-test` suite that asserts its presence;
it was scheduled after navigation and Home, and navigation and Home took the time.

**Footer reduction to four columns (§8).** Still six groups.

**Dead fragments (§12.4).** 13 unique fragment targets in `ia.js` still have no matching section id.
The user-facing menus no longer link to most of them, so an ordinary visitor is far less likely to
hit one — but the site map and the palette still can.

**Showcase state still persists globally (§6.3).** `features.js` writes `showcase_mode` to
localStorage; it should be query-parameter or session-scoped.

## P1

**My Budget depth:** budget envelopes, recurring payments as a real schedule rather than a list, tax
reserve as an envelope that fills from selected income, debts with a payoff view, net-worth history
by month, multi-currency.

**Money Copilot (§13).** The Copilot does not read Money context. It should answer "where did I
spend the most this month" and be able to categorise a transaction, create an envelope or open the
right Academy step — with explicit consent before any personal figure is used.

**Financial-foundations Academy track (§14).** The nine-step track from three transactions to Paper
Trading. The completion events already exist (`money-action` is dispatched on every transaction and
goal), so the track needs wiring rather than inventing.

**Paper Trading bridge (§11.8).** Trade is renamed Practice, but the practice journey itself is
still a pilot.

**Tool coherence (§11).** Markets narrative-first, Research task-first, Screener "why this matched",
Asset Hub hierarchy and a symbol-relevant event chip, chart control maturity, contextual Expert
Marketplace intake from My Budget.

**Shared app shell (§14.1).** Header and footer are still duplicated across 25 pages. Every
navigation change in this phase was 25 edits — which is exactly how variants appear.

**Page controllers (§14.3).** `index.html`, `symbol.html`, `charts.html`, `screener.html`,
`markets.html`, `experts.html` and `academy.html` still carry large inline scripts. My Budget was
built the new way — `public/money/{model,store,page}.js` — as the pattern for the rest. This also
still blocks a real CSP.

## P2

Multi-currency, CSV import, portfolio integration, advanced scenarios, AI Private depth, bank-connect
fake door, performance, localisation, analytics dashboards.

## Owner actions

**`DATABASE_URL` still does not reach the Railway service.** `/api/system/status` reports
`storage: memory`. My Budget is unaffected — it never leaves the browser — but Expert Marketplace
enquiries are lost on every restart.

**The stand is public and carries brand assets it does not own.** Password-gate or de-brand; the
decision is still open.
