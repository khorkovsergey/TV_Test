# Chart workspace — architecture

`/charts` was a 501-line page with a 280-line inline script and an SVG polyline. It is now a
semantic shell plus ten modules, for the same reason `public/money/` exists: the parts that can be
wrong in a way nobody notices are the parts that need to be readable on their own.

## Modules

```
public/chart/
  chart-context.js          the reactive selection store — the single source of "what is being asked about"
  chart-data.js             fetching + the arithmetic of a selection (no DOM)
  chart-renderer.js         SVG candlesticks, volume, scales, crosshair, zoom, pan, hit-testing
  chart-selection.js        candle selection: URL, announcement, one entry point for every path
  chart-range-selection.js  shift-drag and two-click period selection
  chart-markers.js          placing found events on real sessions
  chart-compare.js          comparison series, normalised to the selected session
  chart-toolbar.js          control maturity: functional / prototype / disabled
  chart-panel.js            docked right panel, bottom sheet on narrow screens
  chart-page.js             the controller that wires the above
  chart-theme.css           the light workspace theme, scoped to .chart-workspace
```

Direction of dependency is one-way: `chart-page` knows about everything, the renderer knows about
nothing except the DOM it draws into, and `chart-data`/`chart-context` know about neither.

## Why SVG and not canvas

The brief allows a canvas or WebGL renderer. This one is SVG, deliberately.

jsdom — the environment every acceptance suite in this repository runs in — returns `null` from
`canvas.getContext('2d')`. A canvas renderer would therefore make §24 tests 8 to 23 unverifiable:
nothing could assert that a candle had been drawn, that the right one was highlighted, or that a
click selected the session the visitor pointed at. On a stand whose whole argument is "the claims
in the documentation are reproducible", that is a bad trade for a performance win that a
252-candle chart does not need.

The second reason is the same one that made hit-testing simple. Each bar is a `<g data-index>`
containing a wick `<line>`, a body `<rect>` and a transparent full-height `<rect class="ch-hit">`.
A pointer lands on a session because it landed on an element, not because arithmetic guessed
which session was probably under it — and the same code path serves a browser and an assertion.

What §3.1 forbids is the *line prototype*: one polyline over twenty closes with no timestamps and
nothing selectable. That is gone.

## Geometry

The renderer measures its host and sets `viewBox` to the measured pixel size with
`preserveAspectRatio="none"`, so one SVG unit is one pixel and nothing is distorted. Under jsdom
every element measures 0×0, so it falls back to a deterministic 1200×560 — which is what makes the
geometry, and therefore the tests, mean something.

```
plot width  = W − 64      (right price scale)
plot height = H − 26      (bottom time scale)
volume pane = 20% of the plot height, with a 28px floor
```

## State

`ChartContext` holds symbol, company, exchange, currency, timezone, interval, range, visible
window, indicators, comparisons and — the part that matters — `selection`, which is one of
`{type:'none'}`, `{type:'candle', …}` or `{type:'range', …}`.

Derived numbers (change, percentage change, volume ratio) are computed once when the selection is
made and stored with it. Recomputing them per surface is how the chips and the server end up
disagreeing about the same candle.

The store dispatches both a subscriber callback and a DOM event:

```
chart:candle-selected      chart:range-selected     chart:selection-cleared
chart:visible-range-changed  chart:symbol-changed   chart:interval-changed
```

Nothing keeps the selection in the DOM. A repaint would otherwise change the question the Copilot
is answering, silently.

## Selection lifecycle

Kept through: opening the Copilot, resizing, switching mode, switching panel tab, a reload (the
selected session is in the query string as `?candle=YYYY-MM-DD`).

Dropped on: an explicit Clear, Escape, a change of symbol, and a change of interval unless the
caller confirms the same moment still exists at the new resolution.

## Modes

One dataset, three compositions. Simple has three drawing controls, daily bars and a standing
instruction to click a candle; Standard adds intraday hourly bars, indicators, alerts and period
selection; Pro adds 15-minute bars, layouts and the utility rail. The mode never changes a number,
and both `19b` in the suite and §19 of the brief say so.

## The panel

Docked, not overlaid. `ResearchCopilot.mountInto()` moves the existing panel into the workspace
column and drops its `position:fixed`; the chart gets a narrower area and redraws. Below 860px the
same markup becomes a bottom sheet at 55% of the viewport, expandable — because a 340px column
beside a chart on a phone is a covered chart with extra steps.

The Copilot keeps its dark surface inside the light workspace. It is the same assistant as
everywhere else on the site, and repainting it here would suggest otherwise.

## What the page no longer contains

- the hardcoded `SELECTED RANGE · 21–24 JUL` box, with its invented `CPI release (Reuters 13:31)`
  and `record ETF inflow (Farside 09:10)`. Those dates were literal HTML and moved for no symbol
  and no range. Removing them was not optional once real events could be marked: fictional events
  beside real ones is worse than either.
- the fake `#chartNews` rectangle and circle at fixed coordinates.
- the RSI "series" that was a single horizontal line at the current reading.
