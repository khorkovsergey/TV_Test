# Chart context contract

What the browser sends, what the server accepts, and what it refuses. The shape is defined once —
in `ChartContext.copilotContext()` — so the chips, the request and the validation cannot drift.

## The wire format

```ts
type CopilotChartContext = {
  page: "chart_workspace";
  symbol: string;
  companyName?: string;
  exchange?: string;
  currency: string;          // ISO 4217
  timezone: string;          // IANA, the exchange's own
  interval: "1d" | "1h" | "15m";
  chartRange: string;
  visibleRange?: { from: string; to: string };
  selection:
    | { type: "candle"; time; open; high; low; close; volume?;
        previousClose?; change?; changePct?; averageVolume?; volumeRatio? }
    | { type: "range"; from; to; candleCount; open; close; changePct; high; low;
        totalVolume?; averageVolume? }
    | { type: "none" };
};
```

## Validation

`validateChartContext()` in `src/copilot.js`. Everything here arrives from a browser and is
treated accordingly.

| Field | Rule |
|---|---|
| `symbol` | Must resolve in the instrument universe. If it does not, the whole chart context is dropped — not "partially trusted". |
| `companyName` | **Overwritten** with the universe's name. What the page sent is a display string it happened to have; it is not authoritative. |
| `time`, `from`, `to` | `YYYY-MM-DD` or a parseable ISO instant. Nothing else. A free-text date would go straight into a search query. |
| `open/high/low/close` | Finite numbers, and `high ≥ low`, `high ≥ max(open, close)`, `low ≤ min(open, close)`. A high below its own low is not a candle. |
| `candleCount` | 1 to 20 000. |
| `from ≤ to` | Enforced. A reversed range is rejected, not silently swapped. |
| `interval` | One of three values. |
| `currency` | Three uppercase letters or `USD`. |
| `timezone` | A string of at most 64 characters or `UTC`. |
| `exchange` | Truncated to 60 characters. |

A selection that fails validation becomes `{type:'none'}` rather than a partly-filled object.
Half a candle in the prompt is worse than no candle: the model would reason about it.

## What the model is told

When a candle is selected, the context block carries the session, its OHLC, the change against the
previous close, the volume and the volume ratio — plus one line that exists specifically to stop
a plausible mistake:

> The live quote below is TODAY and is NOT the selected session. Do not quote it as the price on
> the selected date.

The live quote is still injected, because a question can be about both. Without that sentence the
two dated numbers sit next to each other with nothing distinguishing them.

## Search window

Derived from the selection, never from today (§13).

| Selection | Window |
|---|---|
| Daily candle | Previous market close → next market session, plus anything important within ±24 hours of the session |
| Intraday candle | ±2 hours around the timestamp, plus pre-market and post-market for that session |
| Multi-day range | Inside the range, plus the day before it starts; retrospective pieces listed separately |
| Nothing selected | No window. The model is told to ask which day is meant rather than assume today. |

## Actions

`POST /api/copilot/action` validates chart actions before the page applies them. The page draws
what the endpoint agreed is drawable, so a malformed marker never reaches the chart.

| Action | Validation |
|---|---|
| `mark_chart_events` | Each event needs a parseable date and a title; at most 12; the count dropped is returned so the UI can say so |
| `compare_selected_period` | Symbols must be in the universe; at most 3 |
| `create_event_alert` | Known symbol; `kind` is `event` or `volume`; a description is required |
| `expand_selected_range` | `from` and `to` must be parseable dates |
| `save_research`, `clear_chart_selection` | Accepted; the state they touch is entirely client-side |

The client applies a chart action only after the endpoint has returned `ok`, and reports success
only after the page has actually done it.
