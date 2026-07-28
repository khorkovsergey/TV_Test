/* =========================================================================
   Chart data — fetching, and the arithmetic that goes with a selection.

   Kept apart from the renderer for the same reason `money/model.js` is kept
   apart from `money/page.js`: these are the numbers that can be wrong in a way
   nobody notices on screen. A wrong candle body is visible; a wrong volume
   ratio is not.
   ========================================================================= */

window.ChartData = (function () {

  const INTERVALS = ['1d', '1h', '15m'];
  const RANGES = ['1mo', '3mo', '6mo', '1y', '5y'];

  /* The provider clamps these pairs; asking anyway wastes a round trip and
     gets a range the label would then misreport. */
  const MAX_RANGE_FOR = { '1d': '5y', '1h': '6mo', '15m': '1mo' };
  const RANGE_ORDER = { '1mo': 0, '3mo': 1, '6mo': 2, '1y': 3, '5y': 4 };

  function normalise(interval, range) {
    const i = INTERVALS.includes(interval) ? interval : '1d';
    let r = RANGES.includes(range) ? range : '1mo';
    if (RANGE_ORDER[r] > RANGE_ORDER[MAX_RANGE_FOR[i]]) r = MAX_RANGE_FOR[i];
    return { interval: i, range: r };
  }

  async function load(symbol, interval, range) {
    const q = normalise(interval, range);
    const url = `/api/market/history/${encodeURIComponent(symbol)}?interval=${q.interval}&range=${q.range}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const err = new Error(data.error || `history unavailable (HTTP ${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ------------------------------------------------------------ arithmetic */

  const at = (candles, i) => (i >= 0 && i < candles.length) ? candles[i] : null;

  const previousClose = (candles, i) => {
    const p = at(candles, i - 1);
    return p ? p.close : null;
  };

  /* Averaged over the bars that actually reported a volume. A free feed
     returns null volume for whole classes of instrument, and treating those
     nulls as zero would report every bar as a volume spike. */
  function averageVolume(candles, endIndex, window) {
    const n = window || 30;
    const from = Math.max(0, endIndex - n);
    const vals = candles.slice(from, endIndex).map(c => c.volume).filter(Number.isFinite);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function candleStats(candles, index) {
    const c = at(candles, index);
    if (!c) return null;
    const prev = previousClose(candles, index);
    const avgVol = averageVolume(candles, index, 30);
    return {
      candle: c,
      previousClose: prev,
      change: prev != null ? c.close - prev : null,
      changePct: (prev != null && prev !== 0) ? (c.close / prev - 1) * 100 : null,
      averageVolume: avgVol,
      volumeRatio: (avgVol && avgVol > 0 && Number.isFinite(c.volume)) ? c.volume / avgVol : null
    };
  }

  /* §6. The aggregate for a selected span. `open` is the first candle's open
     and `close` is the last candle's close — not the first and last close,
     which would quietly drop the first session's own move. */
  function rangeStats(candles, fromIndex, toIndex) {
    const a = Math.max(0, Math.min(fromIndex, toIndex));
    const b = Math.min(candles.length - 1, Math.max(fromIndex, toIndex));
    const slice = candles.slice(a, b + 1);
    if (!slice.length) return null;

    const open = slice[0].open;
    const close = slice[slice.length - 1].close;
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    const vols = slice.map(c => c.volume).filter(Number.isFinite);

    /* Maximum drawdown inside the span: the deepest fall from a running peak.
       Measured on lows against the highest high seen so far, because a
       close-to-close reading understates what the period actually did. */
    let peak = slice[0].high, maxDrawdown = 0;
    for (const c of slice) {
      if (c.high > peak) peak = c.high;
      if (peak > 0) {
        const dd = (c.low / peak - 1) * 100;
        if (dd < maxDrawdown) maxDrawdown = dd;
      }
    }

    return {
      from: slice[0].time,
      to: slice[slice.length - 1].time,
      fromIndex: a,
      toIndex: b,
      candleCount: slice.length,
      open, close,
      absoluteChange: close - open,
      percentChange: open !== 0 ? (close / open - 1) * 100 : null,
      high, low,
      totalVolume: vols.length ? vols.reduce((x, y) => x + y, 0) : undefined,
      averageVolume: vols.length ? vols.reduce((x, y) => x + y, 0) / vols.length : undefined,
      maxDrawdown
    };
  }

  /* ------------------------------------------------------------ formatting */

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Dates arrive as `YYYY-MM-DD` for daily bars and as an ISO instant for
     intraday. Parsing the daily form with `new Date()` would apply the
     browser's timezone and can move the label a day; it is split by hand. */
  function label(time, interval) {
    const s = String(time || '');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return (interval === '1d') ? day
      : `${day} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const shortLabel = (time, interval) => label(time, interval).replace(/ \d{4}$/, '');

  function price(v, currency) {
    if (!Number.isFinite(v)) return '—';
    const digits = Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 2 : 4;
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function volume(v) {
    if (!Number.isFinite(v)) return '—';
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return String(Math.round(v));
  }

  const pct = v => Number.isFinite(v)
    ? `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}%` : '—';

  return {
    INTERVALS, RANGES, normalise, load,
    candleStats, rangeStats, averageVolume, previousClose,
    label, shortLabel, price, volume, pct
  };
})();
