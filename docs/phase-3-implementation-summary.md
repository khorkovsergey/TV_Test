# Phase 3 — implementation summary

**Goal.** Phase 2 gave the portal a clean six-section architecture and, in doing so, made every
destination look the same. Phase 3 restores the product thinking on top of that architecture without
undoing it: the strategic bets are visible, honestly labelled and connected to real journeys, and the
navigation still has six entries.

Shipped as one release. No rewrite: still Node 20 + Express 4 (ESM), static HTML, vanilla JS, no
build step (§27.4).

## What was added

### The registry — `public/features.js`

One source for thirteen entries (NEW-01…08, CORE-01…05), each with the user problem, the solution,
the audience, the route, the surfaces it must appear on, the metric that would judge the bet, and an
honest `depth` 1–5. Two shared components come out of it: `Features.badge(status)` and
`Features.promo(id, surface, opts)`. No page owns a copy of a feature's status (§VIS-001/002).

Status vocabulary: `NEW` (works here) · `BETA` · `CONCEPT` (idea, demonstrated, not a product) ·
`PREMIUM` (paid tier as a concept) · `IMPROVED` (rebuilt journey). The `NEW` / `CONCEPT` split is the
one that matters — see [`strategic-feature-registry.md`](strategic-feature-registry.md).

### NEW-05 Personal Wealth Hub — `/capital/wealth`

Built, not mocked. A four-step profile (market assets → cash, deposits, currency → goal, horizon,
risk → preview), then analysis: totals, idle capital, concentration, currency structure, and a macro
bridge that names *which of your holdings* an FOMC date touches. Then a scenario runner — move 10 /
25 / 50% of the cash into an ETF, bonds or crypto — with a before/after table, scenarios saved to the
device and compared, a handoff to an expert carrying the scenario, and a screener continuation
carrying the asset class. Loud `PROTOTYPE · NOTHING IS CONNECTED` disclosure throughout.

### Four honest concept demos

| Route | Feature | What it actually shows |
|---|---|---|
| `/new/everywhere` | NEW-03 | Real deep links that carry symbol, timeframe, event and the original question; the portal opens where the reading left off. |
| `/new/geo-aeo` | NEW-04 | A page written to be answerable: short answer first, then explanation, source and update time — with real `FAQPage` JSON-LD in the head. |
| `/research/ai-private` | NEW-06 | A written sample report, and a paid door that is labelled as a simulation. Nothing is charged. |
| `/community/rewards` | NEW-08 | A simulated points ledger with earning rules and history, so the loop is visible rather than asserted. |

Each says in its own body copy that it is a concept. The badge alone is not enough.

### NEW-07 Expert Marketplace — from 2 surfaces to 11

The deepest feature on the stand was reachable from two places. It is now on home, the mega-menu,
the command palette and search, the asset hub rail, the portfolio page, the wealth hub, the academy,
the copilot panel, `/new` and `/showcase` — all through one promo component, each placement chosen
because it is a moment the person actually has the problem. Details and the placement rules are in
[`strategic-feature-visibility-map.md`](strategic-feature-visibility-map.md).

### Two front doors — `/new` and `/showcase`

`/new` is the product-innovations launchpad: what works, what is a concept, what was rebuilt, with
the problem and metric on every card. `/showcase` is the case map: a table of every idea, its status,
the user problem, what the prototype does, the metric and the route.

### Search (§8)

Features are indexed in the ⌘K palette alongside 95 destinations, 49 instruments and the action
list — findable by name, by the problem they solve, and by the words a person would type:
*expert*, *adviser*, *human help*, *savings*, *ai assistant*, *answer engine*, *deep link*.

### Showcase mode (§12)

A floating control turns on the case note under each block — which hypothesis it tests and the metric
that would judge it. Off by default, obviously a reviewer's aid, and it never changes what the product
does. Also reachable as `?showcase=1`.

### Home (§VIS-005)

A block *New ways to use the platform*: four working features as cards, three more as chips, and a
link to `/new`. It sits after the tasks and before the market brief — the front page still answers
"what do you want to do", not "look what we built".

## Files changed

**New:** `public/features.js`, `public/wealth.html`, `public/new.html`, `public/showcase.html`,
`public/everywhere.html`, `public/geo-aeo.html`, `public/ai-private.html`, `public/rewards.html`,
and this doc set.

**Changed:** `public/index.html` (feature block), `public/symbol.html` (deeper rail),
`public/capital.html` (promo strip), `public/academy.html` (expert handoff),
`public/copilot.js` (escalation block), `public/nav.js` (feature index, showcase control),
`public/portal.css` (badges, cards, promo, showcase control), `src/server.js` (7 routes),
plus the `NEW` launcher and `features.js` injected into 20 pages.

**Deliberately untouched:** `public/classic.html` — it is the A/B control and must stay the old
promo home; the acceptance suite asserts it does not load the registry.

## Acceptance

`phase3-test.cjs` — **116 checks, all green**: registry integrity (unique ids, valid statuses,
resolvable `related`, concepts capped at depth 3), the home block, `/new` and `/showcase`, every
strategic route returning 200, all eleven NEW-07 surfaces individually probed, twelve natural-language
palette queries, showcase mode on/off and via query string, honest-disclosure checks on all five
concept/prototype pages (including real `FAQPage` JSON-LD), the Wealth Hub's four steps, impression
analytics, and a regression block asserting six nav sections, three modes and an untouched A/B control.

Full regression across the earlier suites: rel-test 155, plus fix-test, home-test, v2-test, data-test,
progressive-test, bg-test and academy-regress — 821 checks in total, no failures.

## What is deliberately not done

Listed in [`phase-3-remaining-backlog.md`](phase-3-remaining-backlog.md).
