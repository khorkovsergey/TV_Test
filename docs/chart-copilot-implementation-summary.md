# Chart Research Copilot — implementation result

## Chart renderer

`public/chart/chart-renderer.js`. One `<rect>` body and one `<line>` wick per bar, a volume
histogram, a right price scale with a coloured last-price tag, a bottom time scale, crosshair,
hover tooltip, zoom on wheel, pan, fit-to-content and visible-range reporting.

SVG rather than canvas, deliberately: jsdom returns `null` from `getContext('2d')`, so a canvas
renderer would put §24 tests 8–23 out of reach — nobody could assert a candle was drawn or that a
click selected the right session. Each bar carries a transparent full-height hit rect, so a
pointer lands on a session because it landed on an element rather than on a computed guess. The
reasoning is in [`chart-workspace-architecture.md`](chart-workspace-architecture.md).

What went: the polyline over twenty closes, the fake `#chartNews` rectangle at fixed coordinates,
the "RSI series" that was one horizontal line, and the hardcoded `SELECTED RANGE · 21–24 JUL` box
with its invented `CPI release (Reuters 13:31)` and `record ETF inflow (Farside 09:10)`.

## Historical data endpoint

`GET /api/market/history/:symbol?interval=1d&range=3mo` — real OHLCV with per-bar timestamps in
the exchange's own timezone. `1d` up to 5 years, `1h` up to 6 months, `15m` up to 1 month; the
provider's silent clamping is applied before the request and the response reports what was
actually fetched. Five-minute cache keyed on `symbol|interval|range`, 60 keys, oldest-first
eviction, separate from the quote snapshot.

Gaps stay gaps. A bar with prices and no volume keeps its prices. One retry on a transient
failure — at boot the snapshot warm-up fires 49 upstream requests and a chart opened in that
window competes with them — then a labelled stale cache, then a 502 and an honest empty state.

## Candle and range selection

Click, arrow keys, Enter, Escape, and a URL: `?candle=2026-07-27` or `?from=…&to=…`. A selected
session survives a reload and can be sent to somebody. Shift-drag or a "Select period" control
gives a range with a computed aggregate — `open` is the first bar's open and `close` is the last
bar's close, not first and last closes, which would drop the first session's own move.

A drawing tool takes the click so the chart does not, which is what stops the tools breaking
selection. A change of symbol clears the selection; a change of interval clears it unless the
caller confirms the moment still exists.

## Copilot context contract

`ChartContext.copilotContext()` builds the payload; `validateChartContext()` on the server decides
what to believe. The symbol must resolve in the universe or the whole chart context is dropped;
the company name is overwritten with the universe's; dates must be `YYYY-MM-DD` or ISO; a candle
whose high is below its own low is rejected. A selection that fails validation becomes
`{type:'none'}` rather than a half-filled object — half a candle in a prompt is worse than none,
because the model would reason about it. Full table in
[`chart-context-contract.md`](chart-context-contract.md).

## Historical-news research logic

The search window comes from the selection, never from today: previous close → next session ±24h
for a daily candle, ±2h for intraday, inside-plus-one-day for a range. One line of the prompt
exists for a specific plausible failure — the live quote is still supplied, and is explicitly
labelled as *today, not the selected session*.

The prompt forbids "the shares fell because of X" when all that exists is timing, and closes the
"technical / profit-taking" escape hatch that makes a groundless answer sound complete. Reasoning
in [`chart-copilot-research-method.md`](chart-copilot-research-method.md).

## Source model

Was a list of hostnames — title, link and time all discarded, two Reuters pieces collapsed into
one. Now each source carries title, canonical URL, domain, published time where given, a type, and
a **relation** to the selected session: `before-session`, `during-session`, `after-session`,
`retrospective`. A wire story filed during the session and an explainer written a month later are
different kinds of evidence, and the card says which. Dedupe is by canonical URL with tracking
parameters stripped; regulatory and company material sorts above secondary analysis.

`AI · SOURCED` is no longer printed over an empty list.

## Chart actions

`mark_chart_events` · `compare_selected_period` · `expand_selected_range` · `create_event_alert` ·
`save_research` · `clear_chart_selection`. Each is validated by `/api/copilot/action` first and
applied by the page second, so the chart draws only what the endpoint agreed is drawable. Markers
land on a session the data actually contains or are reported unplaced — a marker two days from
where the news landed is worse than no marker. Comparison series are normalised to the *selected*
session, not to the left edge.

Alerts now go through `Alerts.create()`. The widget used to push a raw object into the same
`localStorage` key, leaving two shapes in one list and skipping the dedupe — §UI-002 one layer up.

## Visual reference matching

Top toolbar, instrument row, left drawing rail, central chart, volume pane, right panel, far-right
utility rail and bottom range bar, in a light theme scoped to `.chart-workspace`. Built from the
written specification in §4; **the reference screenshot named in the brief was not attached**, so
§24.15 is unverified rather than met. That is the one P0 acceptance criterion this release does
not close.

## Mode behaviour

One dataset, three compositions. Simple: three drawing controls, daily bars, and a standing
instruction to click a candle. Standard: hourly bars, indicators, alerts, period selection.
Pro: 15-minute bars, layouts, utility rail. The mode never changes a number.

The panel no longer hides in Simple, and that is a deliberate change of a previous guarantee: the
Copilot lives in it, and hiding it would take from a beginner precisely what this release adds.
The Advanced-tools drawer, "Make it my default", the density slider, `Full interface →` and
`chart_first_session_exit` were all restored after the rewrite dropped them.

## Responsive and accessibility

Docked panel that resizes the chart rather than covering it; below 860px the same markup becomes a
bottom sheet at 55% of the viewport, expandable. The chart is focusable, arrow-navigable, and
announces the selected session — symbol, date, close and direction — through a live label.

## Files created

```
public/chart/chart-context.js          public/chart/chart-toolbar.js
public/chart/chart-data.js             public/chart/chart-panel.js
public/chart/chart-renderer.js         public/chart/chart-page.js
public/chart/chart-selection.js        public/chart/chart-theme.css
public/chart/chart-range-selection.js  tests/browser/chart-test.cjs
public/chart/chart-markers.js          docs/chart-*.md (6)
public/chart/chart-compare.js          docs/historical-market-data.md
```

## Files modified

`public/charts.html` (501 lines → semantic shell) · `public/copilot.js` (public API, reactive
context, source cards, factor rendering) · `src/copilot.js` (selection context, historical rules,
structured sources, factor classification, five new tools) · `src/market.js` (history, cache,
clamping) · `src/server.js` (history endpoint, six validated actions) · `public/alerts.js` (volume
condition, selection context) · `public/features.js` (TUNE-10) · `README.md` ·
`docs/{strategic-feature-registry,strategic-feature-visibility-map,test-strategy}.md`

## Tests added

`tests/browser/chart-test.cjs` — 83 checks across historical data, rendering, selection, range
aggregates, Copilot context, server validation, chart actions, modes, control maturity, empty and
error states, responsive behaviour and regression.

## Test expectations rewritten, not preserved

Four suites asserted the page that was deleted, and were updated rather than protected:

- `data-test` checked `#priceLayer polyline`, `#pxLabel` and a live RSI label — now candles,
  bodies, wicks, volume and the instrument row.
- `home-test` checked "not a chart engine" and "the working surface". The first sentence was true
  while the page drew a line over twenty closes; with real OHLCV candles it would be false
  modesty. It now checks that live and prototype are separated and that delayed data is not
  claimed as a licence.
- `progressive-test` checked `#rangeNews` and its `AI · SOURCED` badge — a box of invented events.
  The `range_news` journey rule survives and now fires on a period the visitor actually selected,
  with real dates in the label.
- `mode-test` and `phase3-test` carried hardcoded feature counts (13 entries, 8 strategic) and old
  selectors.

`home-test` also caught a real defect: the toolbar carried a hardcoded `BTCUSD`, so
`/charts?symbol=ETHUSD` drew Ethereum under a Bitcoin label.

## Known limitations

The reference screenshot was never supplied, so the visual match is asserted against the written
spec and not against an image. Drawing tools draw nothing. Indicators and replay are prototype
controls. Markers do not survive a reload. Saved research is written but has no reader yet. Alerts
still do not fire, and the page says so. Full list in
[`chart-copilot-remaining-backlog.md`](chart-copilot-remaining-backlog.md).
