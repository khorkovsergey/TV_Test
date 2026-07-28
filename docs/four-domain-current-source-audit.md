# Four-domain IA — current-source audit

What the code actually looked like before this release. Written from the source, not from memory.

## The confirmed conflict

Three different top-level models existed in the same running product.

**`public/ia.js`** — the product inventory, six legacy sections:

```
Overview · Research · Capital · Trade · Learn · Community
```

98 destinations with `status` and `level`. It powers the command palette, the site map, the
showcase and the coverage tests. It is the answer to "what capabilities exist".

**`public/navigation.js`** — the user navigation, six *different* sections:

```
Markets · Research · My Money · Learn · Community · Practice
```

Task-oriented, nothing unbuilt. It is the answer to "what can I do".

**Mode profiles inside `navigation.js`** — a third model, because the top row itself varied:

```
Simple        My Money · Learn · Markets · Research · Practice
Standard      Markets · Research · My Money · Learn · Community · Practice
Professional  Markets · Screeners · Charts · Research · Practice
```

This was the real defect. Two people using the same product could not describe it to each other,
and a screenshot could not be read without first asking which mode took it. The top level also
carried personal services — My Money, Learn, Practice — as if they were peers of the market itself.

Neither of the six-section models matched the case, which asks for `Home · Market · Symbols ·
Economy`.

## What existed and had to be preserved

Read before touching anything:

```
src/routes.js       33 canonical routes + a legacy redirect table; Express, the
                    client registry, the palette, the feature registry and the
                    route tests all read from here (§ROUTE-001)
src/server.js       registers PAGE_OF in a loop; `/` is behind an A/B gate
src/market.js       49 instruments, six classes, 60s cache, honest ok:false
                    plus the OHLCV history endpoint the chart reads
src/copilot.js      three registers — teacher, researcher, analyst
public/modes.js     one policy, three presets; ids simple|standard|pro
public/mode-surfaces.js   15 surfaces × 3 compositions
public/mode-orchestrator.js  move-not-clone reflow, 8 state adapters
public/chart/*      SVG renderer, chart context, selection, markers
public/money/*      store v1, model, page controller
public/copilot.js   the widget, docked or floating
13 test suites      1414 checks
```

## Facts that shaped the implementation

**Six asset classes, not seven.** `src/market.js` defines `indices, stocks, crypto, forex,
commodities, rates`. There is no ETF class. The four-domain matrix lists "ETFs & Funds" in Market
for all three modes, so the entry exists — pointing at the screener, with the reason written into
the description rather than hidden.

**The asset hub has nine tabs**, and their ids are `overview, why, chart, events, ideas, metrics,
news, discussion, trade`. The prompt's Symbols menu names Fundamentals, Financials and Technicals,
none of which is a tab id. Rather than invent anchors, `?tab=` was added with three aliases onto
tabs that exist.

**The static nav markup is duplicated in 27 page shells** as the no-JS fallback. It had to be
rewritten in all 27, not just in the renderer.

**`nav.js` reads `Navigation.SECTIONS` and `Navigation.topNav(mode)`** and nothing else about the
structure. Keeping both names meant the renderer needed almost no change — the four domains have
the same shape (`id`, `label`, `url`, `question`) the six sections had.

**`Navigation.WORKSPACE` is read by the avatar door.** The first draft of the rewrite dropped it,
which would have broken the profile menu on every page. It is back, derived from Home's own entries
so there is one list rather than two that drift.

**`PANEL_PRIORITY` existed to promote entries across the rows/more split.** With per-mode `lead`
lists the ordering is declared directly, so the mechanism is gone and `prioritise()` is now the
identity function — kept only so `nav.js` does not have to change.

## Risks identified, and how each was handled

| risk | handling |
|---|---|
| losing inventory destinations in the regroup | ownership is **derived from the URL**, never hand-listed; `IA.everyDestinationOwned()` and a count check assert it |
| an entry silently disappearing from a menu | `more` is computed as "everything not led with"; `everyEntryReachable(mode)` asserts it |
| breaking bookmarks with the rename | `My Money → My Budget` is a label change only — routes and storage keys untouched |
| a menu entry pointing at an anchor that does not exist | every URL checked against the real page; `?tab=` added rather than fake anchors |
| tests encoding the old architecture | six checks rewritten with the reason recorded in each, as the previous release did |
| the header losing its only search affordance | the palette survives on Ctrl/Cmd+K and `/`; the Home hero gained a wide ask box wired to the Copilot |

## Deliberate deviations from the prompt

**`Profile` is not rendered as a Home menu entry.** §14.3 lists it in Professional's Home column;
§23 says Profile must not become a fifth domain and this prototype has no profile page. The avatar
door carries `My space`, and Home's menu carries the same entry.

**No redirect aliases.** §24 puts them in Phase IA-3, "only after parity", and parity has not been
reached for Options, Strategies, Pine or Fundamentals.

**`/research` is a directory rather than a redirect**, for the same reason, and because
`/research#fundamentals` cannot resolve to a symbol page without a symbol — a case §24 raises
itself.
