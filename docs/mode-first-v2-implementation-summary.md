# Mode-first v2 — Implementation Result (P0 + P1 so far)

P0 of §33 in full, and part of P1. What is not built is stated at the end and in [`mode-first-v2-remaining-backlog.md`](mode-first-v2-remaining-backlog.md).

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

## P1 additions

`modeRole` in the feature registry (§25) with `roleIn`, `byRole` and `rankedFor` reading it —
`Features.flagship(mode)` now returns a different set per mode, and `flagship()` without an
argument still behaves as before. The registry's own `prominence` stays mode-independent, so a
mode changes how loudly a feature is said and nothing else.

The shared form system (§27). Three profiles that decide how much a person is asked at once, and
one rule that outranks them: applying a profile moves fields between containers instead of
re-rendering them, so a half-typed value survives the switch.

Mode notices (§6.1, §6.3). One line under the header, shown once, never a modal, and never
switching the mode by itself. A visitor with saved work and no stated preference is offered
Standard with "Don't ask again" among the answers.

State adapters for Home, Chart, Money and Screener (§29). Before this, `registerStateAdapter`
was called by nobody.

Screener columns and form profile from the matrix, with "why this matched" in Simple — read off
the filters that are actually set, never invented.

## Known limitations

State adapters cover Home, Chart, Money and Screener. Asset Hub, Academy, Expert Marketplace and
Copilot have none.

Scroll is restored to the same pixel offset rather than to the same element; after a
recomposition that offset can be a different place on the page.

Surfaces that still compose themselves the old way: Overview, Asset Hub, Learn, Academy,
Community, Practice, Expert Marketplace. `hub.js` accepts a composition but only `/research`
passes one.

The form renderer is used by no page yet — the Screener declares its profile on `body` but still
draws its own filter markup, and My Money's Quick Add and the Expert Marketplace intake build
theirs by hand.

`/money/*` still serves one shell for eight routes.

An earlier version of this document claimed a Home state adapter existed when
`registerStateAdapter` was called by nobody at all. It is corrected here, not quietly.
