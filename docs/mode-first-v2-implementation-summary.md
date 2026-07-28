# Mode-first v2 — Implementation Result (P0)

P0 of §33. P1 (the remaining surfaces) and P2 (depth) are separate releases; what is not built is
in [`mode-first-v2-remaining-backlog.md`](mode-first-v2-remaining-backlog.md).

## Central mode architecture

`public/modes.js` keeps one policy and one store. It now also carries the four profiles that turn
a mode from a density setting into a composition:

```
                simple          standard        pro
navigation      guided          balanced        professional
home            guided-home     daily-home      professional-desk
form            wizard          grouped         dense
copilot         teacher         researcher      analyst
maxPrimaryTabs  5               8               12
```

`public/mode-surfaces.js` — sixteen surfaces, three compositions each, with an objective in one
sentence. `public/mode-orchestrator.js` — reflow with state preservation.

## Simple experience

Leads with My Money and Learn. Home opens with four guided tasks, money first. Everything else is
one press away under "Show more tasks".

## Standard experience

**Unchanged where it counts.** The top menu is byte-for-byte yesterday's six sections, and that is
now asserted rather than assumed. Home opens with `Continue` — recent symbol, saved research,
saved screeners, transactions, Academy progress — built from work the visitor actually did, and
absent entirely on a first visit.

## Professional experience

Reads `Professional` everywhere a person looks; the stored id is still `pro`, and the three
migrations are unchanged. `shortLabel: 'Pro'` exists because a mobile switcher has room for three
words. Screeners and Charts are direct top-level routes. Home leads with the desk — the strip is
**moved above** the task grid rather than appended under it, which is the difference between a
composition and a decoration.

## Navigation

Rebuilt at runtime from `Navigation.topNav(mode)`, no reload. Static markup stays Standard and is
the no-JS fallback. Displaced sections live under `More`, which carries the active state when the
open page is one of them. `everySectionReachable()` is true in all three modes.

`PANEL_PRIORITY` promotes entries **across** the rows/more split, because sorting within the
buckets could never have lifted Pine, Options and Strategies out of `more`. Sections with
identical Standard and Professional panels: **five before, zero after**.

## Home

Nine routes, three compositions, all nine reachable in every mode:

| | leads with | tasks shown |
|---|---|---|
| Simple | four guided tasks | 4 |
| Standard | Continue | 6 |
| Professional | the desk | 0, folded into "Explore the platform" |

The old `SIMPLE_ROUTES` had three entries while the comment four lines above promised four; the
"Show 4 more tasks" label was hardcoded. Both are gone — the count is computed.

## Chart, My Money, Copilot, strategic features

Untouched in P0 beyond reading the central profiles. The chart's 90 checks, My Money's 95 and the
14-entry registry are all still green. `TUNE-10`'s maturity is `beta` in every mode — the mode
changes prominence, never truth.

## Existing-user preservation

Stored `standard` stays `standard`; `pro` displays as Professional. Watchlist, alerts, saved
screens, `money_store_v1` and saved chart research are untouched, and no storage key was renamed.
Eight checks in the suite exist only to say so.

## Files created

```
public/mode-surfaces.js
public/mode-orchestrator.js
tests/browser/modes-v2-test.cjs
docs/mode-first-v2-current-source-audit.md
docs/mode-first-v2-navigation-matrix.md
docs/mode-first-v2-surface-matrix.md
docs/mode-first-v2-state-preservation.md
docs/mode-first-v2-implementation-summary.md
docs/mode-first-v2-remaining-backlog.md
```

## Files changed

`public/modes.js` · `public/navigation.js` · `public/nav.js` · `public/index.html` ·
`public/features.js` (CORE-01 copy) · 25 page shells (two script tags) · `README.md` ·
`tests/browser/{rel,home,fix,progressive}-test.cjs`

## Tests

`modes-v2-test.cjs` — 68 checks across policy, navigation, existing-user protection, the three
Home compositions, the orchestrator and the promises the switcher makes.

Four suites had expectations rewritten, in each case because they encoded behaviour this release
deliberately changes:

- "the top menu has six items" → Standard equals the baseline, and every section is reachable from
  every mode.
- "no `More` in the header" → `More` is the honest door for what a mode displaced. `Products` is
  still banned.
- "Simple,Standard,Pro" → the visible label is Professional.
- "every panel has an entry to its section" → the `More` panel is not a section and has no page.
- The palette probe for `pro mode` now expects `Professional mode`; `pro` remains a search term,
  so typing it still finds it.

## Bugs found while doing this

**Duplicate listeners on rebuild.** Reusing the existing anchors when the menu was rebuilt left
the previous build's click handler attached: after one mode switch a door opened and closed on the
same press. Anchors are now rebuilt and focus restored by label.

**`sel()` escaped nothing.** The first version of the selector escaper produced `'$1'` where it
meant `'\\$1'` — a replacement of each character with itself. Caught by writing the check rather
than by reading the line.

## Known limitations

Only Home has a state adapter; the other seven surfaces get their composition object and nothing
moves until P1. Scroll is restored to the same pixel offset rather than to the same element.
`hub.js` still buckets by complexity and has not yet been given the composition. The remaining
surfaces — Overview, Markets, Research, Screener, Asset Hub, Money, Learn, Community, Practice,
Experts — read their profiles but do not yet recompose.
