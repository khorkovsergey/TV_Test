# Chart Research Copilot — remaining backlog

P0 is delivered. This is what the brief asks for that is **not** built, stated plainly rather than
implied as present.

## P0 items completed

Historical OHLCV endpoint with interval/range validation and its own cache · real candlestick
renderer with bodies, wicks, volume, price scale, time scale, crosshair, zoom, pan and fit ·
`ChartContext` store · single-candle selection by pointer, keyboard and URL · `ResearchCopilot`
public API · reactive context chips · server-side validation of the chart context · search window
derived from the selection · structured sources with title, URL, published time and relation ·
docked panel that resizes the chart instead of covering it · light reference theme with top
toolbar, left rail, right panel, far rail and bottom range bar · 83-check suite.

Beyond P0, from P1: range selection, event markers, comparison series, saved research, event and
volume alerts, and the mobile bottom sheet.

## P0 items not completed

**Visual comparison against the reference screenshot (§24.15).** The screenshot named in the brief
was not attached to the message. The layout was built from the written specification in §4, which
gives the regions and their pixel bands, and the structure is asserted by test — but no test
compares a render against the supplied image, and none can until the image exists. This is the one
P0 acceptance criterion that is unverified rather than met.

**Dark theme for the workspace (§4.2 explicitly defers it).** The chart is light while the rest of
the portal is dark. That is the brief's instruction, and it is also a visible seam.

## P1

**Drawing tools still draw nothing.** They take the click so the chart does not — which stops
them breaking selection — and they say so in the bottom bar. They do not draw a line.

**Indicators.** The old page had a fake SMA and a "RSI" that was one horizontal line at the
current reading. Both are gone rather than reimplemented. The indicator library is a prototype
control.

**Compare is Copilot-driven only.** `compare_selected_period` works and normalises to the selected
session; the `+ Compare` toolbar button is a prototype. There is no UI to remove a comparison
series once added.

**Markers do not survive a reload.** They live in memory. The selection is in the URL; the markers
are not.

**Saved research has no reader.** `saved_chart_research` is written and the confirmation points at
Research → Saved research, but that surface does not list these items yet.

**Alerts still do not fire.** Unchanged and stated on the page: nothing watches the market.

**Academy integration.** The chart now emits everything a "read a candle" lesson would need. The
track is not wired.

**Onboarding for the feature.** `/new` and the showcase list it; there is no first-run coach mark
on the chart itself.

## P2

Intraday precision beyond 15m · earnings and transcript sources · SEC and regulatory connectors ·
multi-symbol selection · AI-generated Pine annotations · exported research report · voice
questions · automatic anomaly detection.

## Carried over from the previous phase

Mobile bottom navigation for the site as a whole is still not built — the chart has its own
responsive treatment, but the header still scrolls horizontally at narrow widths. The permanent
prototype strip, the six-column footer and the 13 dead fragment targets in `ia.js` are unchanged.

The remaining six monolith pages still carry large inline scripts. `/charts` has now left that
list: `public/chart/` follows the same pattern as `public/money/`. A real CSP still needs the
other six.

## Owner actions

**`DATABASE_URL` still does not reach the Railway service.** Unchanged, and unrelated to this
feature — the chart holds no server-side state.

**The stand is public and carries brand assets it does not own.** Still open.
