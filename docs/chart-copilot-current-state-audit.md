# Chart Copilot Initial Audit

State of `/charts` and the Copilot **before** this change set. Written first, from the source,
so the claims below can be checked against the diff.

## Current chart renderer

`public/charts.html:107-128` — a hand-written `<svg viewBox="0 0 820 460">` with:

- five hardcoded horizontal grid lines at y = 76, 152, 228, 304, 380;
- one `<polyline>` plus one `<polygon>` fill, built in `drawSymbol()` from `d.series`;
- a `<text>` label with the symbol and last price;
- a `#proOverlay` group holding a 5-period average line and an RSI line drawn as a **single
  horizontal line** at the current reading — not a series;
- a `#chartNews` group: one `<rect>` at a fixed `x=358 width=140` and one `<circle>` at
  `cx=438 cy=257`. Both are decoration. They do not correspond to any date.

There is no renderer module. The drawing code is 60 lines inside a 280-line inline `<script>`.

## Current historical-data depth

`src/market.js:182` — `series: closes.slice(-20)`.

That is the whole history the client can see: **20 closing prices, no timestamps**. The fetch
(`src/market.js:24`) is fixed at `range=1mo&interval=1d`, and the response drops open, high, low
and per-bar volume — `fetchOne` reads only `indicators.quote[0].close`.

`/api/symbol/:symbol` returns that same 20-number array. There is no history endpoint.

## Current candle model

There is none. A "candle" does not exist anywhere in the codebase — no type, no object, no
timestamp. The client has an array of numbers whose index is its only identity.

Consequence: the page cannot name a day. `#rangeNews` (`charts.html:131-140`) hardcodes
`SELECTED RANGE · 21–24 JUL`, `CPI release (Reuters 13:31)` and `record ETF inflow
(Farside 09:10)` as literal HTML. Those dates are not computed from anything and do not change
when the symbol or the range changes.

## Current selection behaviour

None. There is no hover handler, no click handler, no crosshair, no tooltip and no selected
state on the chart. The only pointer interaction in the work area is `#explainMove`, which calls
`document.querySelector('.cp-fab')?.click()` — it opens the Copilot with no chart context at all.

## Current selected-period behaviour

`#rangeNews` is shown for Standard and Pro and hidden for Simple (`charts.html:331`). Its content
is static. `range` comes from `?range=` or `localStorage.chart_range` and is only ever rendered
into a label string (`charts.html:187`); nothing re-fetches or re-draws when it changes.

## Current Copilot context

`public/copilot.js:10-30` — `getContext()` returns `page`, `url`, `mode`, `symbol`, `chartRange`,
`journey`. It is called **twice**: once at init to paint the chips (line 111), and once per
`send()` (line 226).

Confirmed problems:

- the chips are painted once at init (`copilot.js:131-133`) and never repaint — nothing calls
  back into them;
- `symbol` and `chartRange` are read from `localStorage`, not from the chart. If the visitor
  opened `/charts?symbol=NVDA` in a second tab, the panel reports whatever the last tab stored;
- there is no notion of a selected candle, a selected range, an interval, a timezone or a
  visible range;
- the panel opens only from the global `.cp-fab`. There is no programmatic API — no `open()`,
  no `updateContext()`, nothing another page module can call;
- the panel is `position:fixed` and 380px wide over the page (`copilot.js:55`). On `/charts` it
  covers the right-hand side of the chart rather than docking beside it.

Server side, `src/copilot.js:127-136` puts `Active symbol` and `Chart range` into the context
block. `quoteLine()` (line 94) then injects **today's** quote. For a question about a historical
session, the only dated fact the model receives is the wrong one.

## Current source format

`src/copilot.js:229-244` — `sourcesOf()` reduces every web-search result to a **hostname string**
and dedupes by hostname, keeping at most five. The title is read into the map value and then
discarded by `[...seen.keys()]`. Published time, URL and result order are lost.

`public/copilot.js:190` renders that as `sources: reuters.com · bloomberg.com`. Nothing is
clickable, nothing is dated, and there is no way to tell a piece published during the session from
a retrospective written a month later.

## Current chart actions

`ACTION_IDS` (`src/server.js:675`) = `create_alert`, `open_chart`, `compare`, `add_watchlist`.

- `open_chart` and `compare` **navigate** — they leave the page and reload `/charts`. Any chart
  state is lost.
- `create_alert` returns a confirmation string but does not touch `public/alerts.js`; the widget
  writes its own raw object into `localStorage.alerts` (`public/copilot.js:277-281`), bypassing
  `Alerts.create()` and its dedupe, id and `state` fields. Two alert shapes now exist in one key.
- There is no action that draws anything on the chart, and no action that saves research.

## Current mode behaviour

`applyMode()` (`charts.html:292-334`) is genuinely functional: it toggles `[data-min]` elements,
the tool rail, the side panel, the Pro overlay, `#rangeNews`, density and the hint bar. This part
does not need rebuilding — it needs to keep working once the page becomes modular.

## Inline scripts/styles to extract

`charts.html` is 501 lines: a 280-line inline `<script>` (lines 165-444) and inline `style=`
attributes on 14 elements. Chart-specific CSS currently lives in `portal.css` (`.work-shell`,
`.toolrail`, `.px`, `.side`, `.wl-row`). This is one of the seven monolith pages named in
`docs/phase-5-remaining-backlog.md` as still blocking a real CSP.

## P0 implementation plan

1. `GET /api/market/history/:symbol` with real OHLCV, interval/range validation and its own cache.
2. An SVG candlestick renderer — body, wicks, volume histogram, price scale, time scale,
   crosshair, zoom, pan.
3. `public/chart/chart-context.js` — the reactive selection store.
4. Candle selection: pointer, keyboard, visual state, announcement.
5. `window.ResearchCopilot` — `open`, `updateContext`, `startNewThread`, `focusInput`.
6. Context chips driven by the store, repainted on every selection change.
7. Server-side validation of the chart context; historical-session rules in the system prompt.
8. Structured sources with title, URL, published time and `relation`.
9. Docked panel that resizes the chart instead of covering it.
10. Tests.

**Renderer technology.** Canvas is unavailable to the test harness: jsdom 25 returns `null` from
`getContext('2d')`, so a canvas renderer would make mandatory tests 8–23 unverifiable. The
renderer is therefore SVG, with one `<rect>` body and one `<line>` wick per candle — real candles
that can also be hit-tested and asserted against. §3.1 forbids the *line prototype*, not SVG.

## Files to change

| File | Change |
|---|---|
| `src/market.js` | history fetch, history cache, interval/range validation |
| `src/server.js` | `/api/market/history/:symbol`, chart context validation, new action ids |
| `src/copilot.js` | selection context, historical-search rules, structured sources, factors |
| `src/routes.js` | nothing — `/charts` is already canonical |
| `public/charts.html` | reduced to a semantic shell |
| `public/chart/*` | new: renderer, data, context, selection, range, markers, compare, toolbar, panel, page, theme |
| `public/copilot.js` | public API, reactive context, source cards, chart actions |
| `public/alerts.js` | event and volume-anomaly alerts carrying chart selection |
| `public/features.js` | `TUNE-10` |
| `tests/browser/chart-test.cjs` | new suite |

## Risks

- **The free endpoint may not return the requested range.** Yahoo silently clamps some
  interval/range pairs. The response must report the interval and range it actually got, not the
  ones that were asked for.
- **Intraday history for a 49-instrument universe is heavier than the 60s snapshot.** The history
  cache has to be keyed and bounded separately, or a few open tabs on `1h`/`15m` will hit the
  provider hard enough to get rate-limited.
- **The current `#rangeNews` copy is fictional.** Deleting it is required, not optional — leaving
  it while adding real selection would put invented events beside real ones.
- **`localStorage.alerts` already holds two shapes.** Anything reading it must tolerate the raw
  objects the Copilot wrote.
- **Mode tests assert the current page.** `mode-test.cjs` fingerprints `/charts`; rebuilding the
  page changes the fingerprint, and those expectations have to be rewritten rather than protected.
