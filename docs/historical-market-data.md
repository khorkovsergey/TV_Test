# Historical market data

`GET /api/market/history/:symbol?interval=1d&range=3mo`

Separate from `/api/markets` because it answers a different question at a different cost. The
snapshot is one shared object refreshed every sixty seconds for the whole universe; this is per
symbol, per interval, per range, and it is what the chart draws candles from.

## Response

```jsonc
{
  "ok": true,
  "symbol": "NVDA",
  "name": "NVIDIA",
  "exchange": "NasdaqGS",
  "currency": "USD",
  "timezone": "America/New_York",
  "interval": "1d",
  "range": "3mo",
  "source": "Yahoo Finance (free, delayed)",
  "delayed": true,
  "asOf": "2026-07-28T07:06:48.794Z",
  "count": 62,
  "candles": [
    { "time": "2026-04-28", "epoch": 1777383000,
      "open": 209.49, "high": 214.73, "low": 208.20, "close": 213.17, "volume": 180275400 }
  ]
}
```

## Supported pairs

| interval | ranges |
|---|---|
| `1d` | 1mo · 3mo · 6mo · 1y · 5y |
| `1h` | 1mo · 3mo · 6mo |
| `15m` | 1mo |

The provider silently clamps some pairs — ask for five years of 15-minute bars and sixty days come
back without a word. The ceiling is therefore applied before the request, the response reports the
interval and range that were actually fetched, and the range buttons the page cannot honour are
disabled with the reason in their tooltip. A label that says `5Y` over sixty days of data is a
small lie that costs nothing to avoid.

## Rules

**A gap stays a gap.** Only a bar with an unusable timestamp or a non-finite OHLC is dropped, and
nothing is interpolated across a halt or a holiday. A candle that never traded is a candle
somebody will ask the Copilot about.

**A missing volume does not delete a bar.** The free feed returns `null` volume for whole classes
of instrument. Those bars keep their prices and leave `volume` undefined — a hole in the volume
series is honest, a hole punched in the price series to hide it is not.

**The session date is the exchange's.** `time` for a daily bar is the trading date in the
exchange's own timezone, formatted through `Intl.DateTimeFormat('en-CA', { timeZone })`. Doing
this in UTC puts a New York session on the wrong calendar day for anyone east of London — and the
Copilot would then search the wrong date, which is the one failure this whole feature exists to
prevent.

**Averages skip bars with no volume.** `averageVolume` is computed over the bars that reported
one. Treating nulls as zero would report every bar as a volume spike.

**Stale beats empty, and stale says so.** On a fetch failure with a warm cache the response is the
cached data plus `stale: true`, `staleReason` and `ageMs`, and the instrument row prints
`STALE — kept from the last good fetch`. With no cache it is a 502 and the chart shows its
"historical candles are unavailable" state with a retry. Nothing is drawn rather than invented.

## Cache

Keyed on `symbol|interval|range`, five minutes, at most 60 keys with oldest-first eviction. The
snapshot cache is untouched: a burst of chart tabs on `15m` must not be able to evict the quote
layer the rest of the portal runs on.

## What this is not

Delayed bars from a free public endpoint. Real prices, not a simulation — and not a market-data
licence. The page says exactly that, and so does this document.
