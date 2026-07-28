# Economy — MVP

Route `/economy`. Files `public/economy.html`, `public/economy.js`. Surface `economy` in
`mode-surfaces.js`. State adapter registered.

## What the domain is for

```
Which event happened?
How did the indicator change?
Which markets and instruments did it touch?
```

Three questions. It refuses to answer a fourth, and refuses to answer these three with numbers it
does not have.

## The nine modules

| module | maturity | source | what it actually is |
|---|---|---|---|
| Economy Brief | **LIVE** | market layer | `US10Y`, `VIX`, `DXY`, `GOLD` — real quotes, same layer as every other page, same honest failure when the provider is down |
| Upcoming Economic Events | **PILOT** | two fixed entries | FOMC and US CPI, dated, each naming the instruments historically sensitive to it. Selecting one changes the three modules below |
| Rates and Inflation | **PARTLY LIVE** | US10Y live; policy rates and CPI not connected | the ten-year yield is a market price, so it is real. The policy rate and the inflation print are published numbers with no feed here, so they are named rather than guessed |
| Why Markets Moved | **PILOT** | stated, not modelled | event → factor → market, with an explicit line saying the relationship is stated and not measured |
| Affected Markets | **PILOT** | classes named per event | opens Market filtered to that class |
| Affected Symbols | **LIVE** | market layer | real quotes for the instruments the selected event names |
| Historical Reaction | **LIVE** | OHLCV history endpoint | **genuinely computed** — one month of real candles for the named instrument: change, high, low, session count |
| Earnings Calendar | **MAPPED** | — | needs a corporate-actions feed |
| Mapped areas | **MAPPED** | — | six more, folded (open by default in Professional) |

## What is real, stated plainly

Two modules read live quotes. One reads real OHLCV history and computes from it. When either
endpoint fails, the module says so and shows nothing — there is no fallback narrative, because
without the candles there is nothing honest to say about a reaction.

## What is mapped, and why it is visible

```
Countries · Macro Indicators · GDP · Employment
Yield Curves · Dividends · IPO Calendar · Country Compare
```

Each has an anchor the menu links to and a card saying what it would contain and which feed it
needs. They are shown rather than omitted so the shape of the domain can be reviewed. They are
shown as `MAPPED` rather than filled with plausible numbers because inventing macro data would make
every other number on the page unreadable as evidence — a reviewer who catches one invented figure
is right to distrust all of them.

## Module contract

Every module states four things, in the same place, in the same order: **what it is · how mature it
is · where the numbers came from · when**. A module that cannot say all four does not get to look
like one that can.

## Composition by mode

| | leads with | reasoning |
|---|---|---|
| Simple | the event, then what it means | a beginner needs the "so what" before the numbers |
| Standard | the brief, then the calendar | the daily read |
| Professional | the calendar and the record | at this level the narrative modules are below the data |

Same nine modules in all three. The nodes are **moved**, not re-rendered, so a loaded quote does not
re-fetch on a mode switch.

## State adapter

Captures the selected event, whether the mapped fold is open, and the scroll position. A
recomposition that reset the selected event would silently change what the three impact modules are
about, which is the kind of state loss that is hard to notice and easy to be wrong about.

## Journey

```
Event → plain-language explanation → affected markets → affected symbols
      → chart reaction → Follow / Alert
```

The last step reuses the existing alert layer; the chart step opens the real chart with the real
symbol, where the Chart Research Copilot can be asked about a specific candle.
