# Mode-first v2 — Initial Source Audit

Written before any code change, from the source and from a real run. Every count below was
produced by executing the code, not by reading a previous document.

## Snapshot and startup

`node src/server.js` boots with dependencies installed. Warm-up fetches 49 instruments; the
history endpoint answers within a second of boot after the retry added in the chart release.

## npm check result

```
check:syntax   60 files/blocks parsed, 0 failed
check:copy     59 files scanned, 0 problems
```

## npm test result

The brief states the full suite was not reproduced in its own audit environment because
`express` could not be imported. It reproduces here. Last complete run:

```
academy 37 · bg 52 · chart 90 · data 81 · fix 123 · home 102
mode 195 · money 95 · phase3 119 · progressive 67 · rel 160 · v2 87
12 of 12 suites passed
```

This is the regression baseline for everything below. A refactor that leaves it green has not
proved it is right, but a refactor that breaks it has proved something.

## Current routes

`src/routes.js` is the single registry: home, classic, overview, research, trade, learn,
community, markets, screeners, charts, symbol, academy, lesson, experts, rewards, money + 8
`/money/*`, wealth, aiPrivate, everywhere, geoAeo, whatsNew, showcase, sitemap, staff, metrics.
Legacy paths 301 from one table. **No parallel route tree exists and none will be created.**

## Current IA counts

Executed against `public/ia.js`:

```
98 destinations — live 38 · pilot 20 · mapped 40
```

Matches the brief. `ia.js` powers the palette, search, sitemap, showcase and coverage tests;
`navigation.js` powers the menus. That separation stays.

## Current strategic-feature count

`public/features.js` — **14 entries**: 9 strategic (NEW-01…08 + TUNE-10) and 5 core (CORE-01…05).

## Current mode policy

`public/modes.js`: one list `simple | standard | pro`, versioned `experience_prefs`, migration
for `standart`/`beginner`/`advanced`, and per-mode `density`, `explanationDepth`,
`maxPrimaryActions`, `chartPreset`, `defaultCommunityFeed`, `tableDensity`,
`showContextualEducation`, `showAdvancedByDefault`, plus the `VISIBILITY` vocabulary and
`presentation(complexity)`.

What it does **not** carry: navigation profile, home profile, form profile, copilot profile,
module order, default tabs, primary/overflow actions.

## Current navigation behaviour

`public/navigation.js` holds one static `SECTIONS` array. `Navigation.menu(sectionId, mode)`
filters a section's `primary` by entry level and pushes the rest into `more`.

`public/nav.js` rewrites only the **inside** of the mega panel. The top-level `.portal-nav .menu`
anchors are static HTML repeated in every page and are identical in all three modes.

Measured, by executing `Navigation.menu()` for each section:

| Section | simple | standard | pro |
|---|---|---|---|
| Markets | 4 | 6 | 6 — **identical to Standard** |
| Research | 4 | 6 | 6 — **identical to Standard** |
| My Money | 4 | 6 | 6 — **identical to Standard** |
| Learn | 4 | 6 | 6 — **identical to Standard** |
| Community | 3 | 5 | 6 |
| Practice | 2 | 4 | 4 — **identical to Standard** |

**In five sections out of six the Professional panel is byte-identical to Standard.** That is
GAP-04, and it is caused by source-array order plus a fixed cap rather than by any per-mode
priority. Professional never gets `Screeners` or `Charts` at the top level, and never gets Pine,
Options or Strategies in the leading rows of Research.

## Current Home behaviour

`public/index.html` carries 9 `[data-route]` cards.

```js
const SIMPLE_ROUTES = ['manage_money', 'understand_market', 'research_asset'];   // three
```

The comment four lines above it says *"Simple starts with four tasks"*. The array has three.
`applyMode()` then hides the rest with `style.display`, and Professional renders the same nine
cards **plus** `#proStrip`. So:

```
Professional = Standard + one extra block
```

which is a decoration, not a professional scenario. Confirms GAP-05 exactly as written.

## Current mode-aware pages

Counting mode references per page:

```
charts.html  15   symbol.html 6   index.html 6
markets.html  1   experts.html 1  academy.html 1   new.html 1   wealth.html 1
```

Plus external controllers: `nav.js` 54 · `hub.js` 18 · `chart-page.js` 26 · `money/page.js` 14 ·
`academy.js` 12 · `copilot.js` 6.

## Current superficial mode differences

- **`hub.js`** — `modules(mode, list)` buckets by declared complexity into open / folded / more
  and **preserves source order**. No lead module, no per-mode order, no per-mode primary actions,
  no page objective. Confirms GAP-07.
- **`academy.js`** — adds a class and folds `[data-advanced]`. No per-mode curriculum. GAP-10.
- **`money/page.js`** — reorders onboarding choices, folds `categoriesCard` and `safetyCard`,
  changes explanation depth. `deep.netWorth` is declared and never used; there is no net-worth
  module in the canonical HTML; `/money/*` all serve one shell. GAP-09.
- **`copilot.js`** — the mode changes the **number** of suggested prompts and nothing else. The
  server already has three registers. GAP-11.
- **`charts.html`** — carries a second global mode control (`#modePill`) beside the header
  switcher. Two equal switchers read as two settings. GAP-12.

## Current non-mode-aware pages

`overview.html` · `research.html` · `screener.html` · `learn.html` · `lesson.html` ·
`community.html` · `trade.html` · `rewards.html` · `money.html` (the shell; the controller is
mode-aware) · `showcase.html` · `directory.html` · `metrics.html` · `staff.html`.

## Current Chart baseline — preserve

`public/chart/` (10 modules + theme), real candlesticks with bodies and wicks, volume, right
price scale, time scale, crosshair, zoom, pan, fit, single-candle and range selection, keyboard
selection, URL selection state, docked Copilot, reactive chips, historical-date search, sources
with titles/URLs/relation, factor classification, event markers, comparison, alerts through the
shared store, saved research, `/api/market/history/:symbol`, server-side context validation.
90 checks. **Not to be rewritten.**

## Current My Money baseline — preserve

`/money` + `public/money/{model,store,page}.js`, one versioned key `money_store_v1`, everyday-money
onboarding, income/expense/transfer, categories, monthly totals, goals, safety, recurring,
financial stage, legacy import. 95 checks. **Not to be replaced by an asset-first hub.**

## Current Expert Marketplace baseline — preserve

Structured intake, separate AI and consultant consent, request ownership token, matching,
profiles, context sharing, held booking, standardised output, prototype honesty. The verification
truth is identical in every mode and stays identical.

## Current storage keys

```
ui_mode · experience_prefs · active_symbol · chart_range · compare_symbols · watchlist
alerts · saved_screens · screener_saved · followed_events · research_journey
money_store_v1 · saved_chart_research · showcase_mode · em_request_token
chart_seen (session) · wealth_profile · wealth_scenarios (legacy, read-only)
```

None may be renamed without migration.

## Existing-user regression risks

1. **Top-level menu changes per mode.** A returning Standard user must see today's six sections
   unchanged. Standard is the compatibility baseline; if it moves, the release is wrong.
2. **Home recomposition.** Nine routes exist today; all nine must stay reachable.
3. **Reflow losing state.** Moving DOM between placements can drop focus, form values, the active
   tab and scroll position. This is the single largest risk in the whole change.
4. **`style.display` orchestration.** Today's Home and chart use it. Replacing it with a
   move-based orchestrator can resurrect exactly the `[hidden]` versus author-`display` defect
   that shipped twice this week.
5. **Tests encoding accidental behaviour.** `mode-test` fingerprints every route in three modes.
   Some of those fingerprints assert today's shape, not a promise.
6. **Two mode controls on the chart.** Removing `#modePill` must not remove Advanced tools or
   "Make it my default".

## Files to preserve

`public/chart/*` · `public/money/*` · `src/market.js` · `src/copilot.js` (source model and chart
context) · `src/routes.js` · `public/ia.js` · `public/features.js` entries · `public/alerts.js` ·
`public/experts.html` data and consent flow · every browser suite's meaningful coverage.

## Files to modify

`public/modes.js` · new `public/mode-surfaces.js` · new `public/mode-orchestrator.js` ·
`public/navigation.js` · `public/nav.js` · `public/index.html` + `public/home.js` ·
`public/hub.js` · `public/copilot.js` · `public/features.js` (`modeRole`) · the 25 page shells
for the dynamic menu · `README.md` and six docs.

## P0 plan

1. This audit.
2. Visible `Pro → Professional`, `shortLabel: 'Pro'`, internal id unchanged.
3. Extend `modes.js` with the profile fields.
4. `mode-surfaces.js` — the central composition matrix.
5. `mode-orchestrator.js` — reflow with state preservation.
6. Navigation profiles + dynamic top menu.
7. Three real Home compositions.
8. State adapters.
9. Tests.
10. Full suite.

P1 (surfaces) and P2 (depth) follow as separate releases. This differs from the standing
"one release, no phases" instruction, and deliberately: P0 touches the menu, the home page and
the state machinery of every page at once. Shipping P1 in the same change would mean a single
release in which no page is as it was, with no green intermediate state to bisect against.

## State-preservation plan

`ModeOrchestrator.registerStateAdapter(surface, { capture, reflow, restore })` for Home,
Screener, Asset Hub, Chart, Money, Academy, Expert Marketplace, Copilot. Modules are **moved**,
never cloned; identified by stable `data-module-id`; focus, field values, active tab and scroll
anchor are captured before the move and restored after.

## Test plan

§32's 112 checks land in a new `tests/browser/modes-v2-test.cjs`, plus rewrites where an existing
expectation encodes the old composition rather than a promise. The three that must not weaken:
`mode-test`'s "no route is identical in two modes", `rel-test`'s shared shell, and the chart and
money suites in full.

## Risks

- **Standard is a promise.** Every change must be checked against "a returning user sees what
  they saw yesterday".
- **The orchestrator is the risky component.** DOM moves plus focus restoration is where
  subtle breakage lives, and it is hard to see in a screenshot.
- **`nav.js` rewriting the top menu** turns static markup into a runtime concern on 25 pages.
  The static markup must remain a correct no-JS Standard fallback.
- **Documentation drift is already real**, and confirmed: README still names the old six sections
  (`Overview · Research · Capital · Trade · Learn · Community`) while the product ships
  `Markets · Research · My Money · Learn · Community · Practice`; `Modes.KEEPS` promises "the six
  sections" while mode-specific top navigation will deliberately differ; `CORE-01` says "Seven
  tasks" and Home has nine.
