/* =========================================================================
   Range selection (§6).

   Shift-drag on the chart, or the "Select period" control for anyone who will
   never discover a modifier key. The aggregate is computed in ChartData, not
   here — this module owns the interaction and the wording, and deliberately
   owns neither the arithmetic nor the storage.
   ========================================================================= */

window.ChartRangeSelection = (function () {

  const C = () => window.ChartContext;
  const D = () => window.ChartData;

  let pickMode = false;
  let firstIndex = null;

  const isPicking = () => pickMode;

  function apply(renderer, candles, a, b) {
    const stats = D().rangeStats(candles, a, b);
    if (!stats) return null;

    renderer.selectRange(stats.fromIndex, stats.toIndex);
    C().selectRange(stats);

    try {
      const u = new URL(location.href);
      u.searchParams.delete('candle');
      u.searchParams.set('from', stats.from);
      u.searchParams.set('to', stats.to);
      history.replaceState(null, '', u.toString());
    } catch {}

    renderer.announce(
      `Selected ${stats.candleCount} candles, ${D().label(stats.from)} to ${D().label(stats.to)}, `
      + `${D().pct(stats.percentChange)}.`);

    window.Portal?.track?.('chart_range_selected', {
      symbol: C().get().symbol, interval: C().get().interval,
      from: stats.from, to: stats.to, candles: stats.candleCount
    });
    return stats;
  }

  /* Two clicks, for the same result as a shift-drag. Discoverability is the
     whole point of the toolbar control — the modifier stays for people who
     already know it. */
  function beginPick(onState) {
    pickMode = true;
    firstIndex = null;
    if (onState) onState('Pick the first candle of the period');
  }

  function cancelPick(onState) {
    pickMode = false;
    firstIndex = null;
    if (onState) onState(null);
  }

  function handlePickClick(renderer, candles, index, onState) {
    if (!pickMode) return null;
    if (firstIndex == null) {
      firstIndex = index;
      renderer.selectRange(index, index);
      if (onState) onState('Now pick the last candle');
      return null;
    }
    const stats = apply(renderer, candles, firstIndex, index);
    pickMode = false;
    firstIndex = null;
    if (onState) onState(null);
    return stats;
  }

  function restoreFromUrl(renderer, candles) {
    let from, to;
    try {
      const p = new URLSearchParams(location.search);
      from = p.get('from'); to = p.get('to');
    } catch { return null; }
    if (!from || !to) return null;
    const a = candles.findIndex(c => c.time === from);
    const b = candles.findIndex(c => c.time === to);
    if (a === -1 || b === -1) return null;
    return apply(renderer, candles, a, b);
  }

  /* §6 — the openers offered once a period is selected. They are questions a
     person actually asks about a span, not about a day. */
  const PROMPTS = [
    'What happened in this period?',
    'Which news lined up with the fall?',
    'Show me the most important events.',
    'Why did the share move differently from its sector?',
    'Where did the recovery start?'
  ];

  return { apply, beginPick, cancelPick, handlePickClick, isPicking, restoreFromUrl, PROMPTS };
})();
