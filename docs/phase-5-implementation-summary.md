# Phase 5 + 6 — implementation result

P0-A (navigation) and P0-B (My Budget) delivered as one change set. What was deliberately not done
is in [`phase-5-remaining-backlog.md`](phase-5-remaining-backlog.md).

## Global navigation changes

The portal was a product map rendered as a website. `ia.js` — 98 destinations, **40 of them
mapped-but-unbuilt** — powered every mega menu, so an ordinary visitor was reading an internal
inventory in which unbuilt tools sat beside working ones as equals, each carrying `PILOT` or
`MAPPED`.

`public/navigation.js` is now the user-navigation registry: canonical, task-oriented entries that
lead somewhere real. `ia.js` stays the inventory and keeps powering the command palette, the site
map, the showcase and the coverage tests — the places where completeness is the point.

Top level: **Markets · Research · My Budget · Learn · Community · Practice**.

- **Overview** left the top level; Home already did that job. The page stays, because three Markets
  entries point at its sections.
- **Capital** became **My Budget**. "Capital" is an abstract, investment-oriented word for a section
  whose job is to show where a salary went.
- **Trade** became **Practice**, because paper trading works and broker connection does not exist.
  It goes back when the real flow has depth.

No `MAPPED`, `PILOT`, `PRO` or `LIVE` anywhere in a normal menu — asserted by test.

## Home simplification

Three tasks above the fold, **Manage my money first**: manage my money · understand the market ·
research an asset. The rest folds into `More`.

One flagship block instead of eight equal cards. Hierarchy is what makes a strategic feature
memorable; repetition is what made them forgettable. Beside it, three compact links — Guided
Academy, Research Copilot, Expert Marketplace.

Removed: `Connect a verified broker` (no broker is connected to this stand) and the hardcoded FOMC
countdown in the task copy.

## Workspace

Watchlists, alerts, saved research, saved screeners and What's new moved behind the profile as
`My workspace`. They are things you keep, not a topic — and they were the first thing the old
`Capital` section showed, ahead of anything about money.

## My Budget implementation

The old hub opened with *"What is invested in markets right now? Stocks & ETFs / Crypto / Bonds"*.
For the person the case describes — a self-employed trainer with a notebook — that first screen is
a closed door.

`public/money/{model,store,page}.js`:

- Quick Add: income, expense, transfer, in about ten seconds
- transaction ledger with edit and delete
- categories grouped as essential / flexible / saving
- monthly overview: came in, went out, left, repeats
- goals with contribution-based projection
- financial safety: reserve in months covered, debts, tax
- net worth = assets − liabilities
- recurring rules, export JSON/CSV, delete everything
- onboarding that asks what would be useful now, never what you hold
- the financial progress ladder deciding the one next step

The arithmetic decisions are in
[`personal-finance-data-model.md`](personal-finance-data-model.md); the product reasoning is in
[`my-money-product-model.md`](my-money-product-model.md). The ones worth repeating:

- transfers never count as income or expense
- insufficient data returns `null`, never `0`
- goal projection uses the monthly contribution, at 0% assumed return
- the emergency fund is reported in months covered, with no universal norm
- cash is never called idle
- negative cash flow leads to spending, not to a reserve nobody can fund
- the market is never the next step before the stage that earns it

## Legacy Wealth migration

`wealth_profile` and `wealth_scenarios` import on request, with a preview of exactly what will be
created. Cash and deposits become accounts, instruments become investment accounts, the goal
becomes a goal, scenarios are kept verbatim. The old keys are not deleted, and nothing is inserted
silently.

## Routes and redirects

`/money` plus `/money/{transactions,budget,accounts,goals,safety,net-worth,investing,scenarios}`.
301 from `/capital`, `/capital/wealth`, `/capital.html`, `/wealth.html`. `/overview` still serves
the market narrative.

## Mode changes

My Budget is one data store with three compositions: Simple opens with the month, the ledger and one
next step; Standard adds the planning cards; Pro adds the structural view. Folded, never removed,
and the mode never touches the numbers.

## Tests added

`tests/browser/money-test.cjs` — **95 checks**, including the mandatory fitness-trainer scenario end
to end: notebook onboarding, four client payments, gym rent, transport, phone, the monthly figure,
a tax envelope, a reserve goal, returning the next day to add another transaction, and no broker
CTA anywhere along the way. It also pins every arithmetic rule listed above, and asserts that none
of the four early stages routes to the Screener.

## Test expectations rewritten, not preserved

Per §1.5 of the brief, tests that asserted the *old* model were updated rather than protected:
six sections starting with Overview, seven task tiles, "Wealth Hub" as a menu label, `/capital` as
a canonical route. All four statements are false by design now.

## Known limitations

Mobile bottom navigation is not built — the header still scrolls horizontally at narrow widths, and
that is the largest missing P0 item. The permanent prototype strip and the six-column footer are
still there. Thirteen dead fragment targets remain in the inventory, though the user-facing menus no
longer link to most of them. Showcase state still persists in localStorage.
