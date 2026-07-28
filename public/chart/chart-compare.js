/* =========================================================================
   Comparison series (§17.2).

   "Was this the whole market or just this company?" is the question the
   selection makes askable, and a second line is the shortest honest answer.

   Two rules:

   · Series are normalised to the *selected* session, not to the left edge of
     the screen. Normalising to the visible start answers a different question
     and makes the selected day look arbitrary.
   · A comparison instrument whose history does not cover the selected session
     is refused rather than stretched. Two lines that start on different days
     invite a comparison that was never measured.
   ========================================================================= */

window.ChartCompare = (function () {

  const D = () => window.ChartData;

  const loaded = new Map();       // symbol -> candles

  async function fetchSeries(symbol, interval, range) {
    if (loaded.has(symbol)) return loaded.get(symbol);
    const data = await D().load(symbol, interval, range);
    loaded.set(symbol, data.candles);
    return data.candles;
  }

  /* Values are expressed in the base instrument's price units so both lines
     share one scale: the comparison keeps its own percentage path but is
     drawn as "what the base would have been worth on this path". */
  function project(baseCandles, otherCandles, anchorIndex) {
    const byTime = new Map(otherCandles.map(c => [String(c.time).slice(0, 10), c]));
    const anchorDay = String(baseCandles[anchorIndex]?.time || '').slice(0, 10);
    const anchorOther = byTime.get(anchorDay);
    if (!anchorOther || !anchorOther.close) return null;

    const anchorBase = baseCandles[anchorIndex].close;
    const values = baseCandles.map(c => {
      const o = byTime.get(String(c.time).slice(0, 10));
      if (!o || !Number.isFinite(o.close)) return null;
      return anchorBase * (o.close / anchorOther.close);
    });
    return values;
  }

  async function add(symbol, ctx, baseCandles, anchorIndex) {
    const sym = String(symbol || '').toUpperCase();
    if (!sym) return { ok: false, error: 'no symbol' };
    const anchor = Number.isInteger(anchorIndex) ? anchorIndex : baseCandles.length - 1;

    let other;
    try {
      other = await fetchSeries(sym, ctx.interval, ctx.chartRange);
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
    const values = project(baseCandles, other, anchor);
    if (!values) {
      return {
        ok: false,
        error: `${sym} has no data for ${baseCandles[anchor]?.time} — nothing to line it up against`
      };
    }
    return { ok: true, symbol: sym, values, anchor };
  }

  /* The relative reading over the selected period, which is the number the
     question was really about. */
  function relative(baseCandles, values, fromIndex, toIndex) {
    const b0 = baseCandles[fromIndex]?.close, b1 = baseCandles[toIndex]?.close;
    const o0 = values[fromIndex], o1 = values[toIndex];
    if (![b0, b1, o0, o1].every(Number.isFinite) || b0 === 0 || o0 === 0) return null;
    const basePct = (b1 / b0 - 1) * 100;
    const otherPct = (o1 / o0 - 1) * 100;
    return { basePct, otherPct, spread: basePct - otherPct };
  }

  function reset() { loaded.clear(); }

  return { add, project, relative, reset };
})();
