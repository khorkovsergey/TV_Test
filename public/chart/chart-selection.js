/* =========================================================================
   Candle selection (§5).

   The bridge between a pointer landing on a bar and the context store knowing
   which session the visitor is asking about. It also owns the two things that
   are easy to forget once the highlight looks right: the URL, so a selected
   day survives a reload and can be sent to somebody, and the announcement, so
   the selection exists for a screen reader and not only for the eye.
   ========================================================================= */

window.ChartSelection = (function () {

  const C = () => window.ChartContext;
  const D = () => window.ChartData;

  function announce(renderer, stats, interval) {
    const c = stats.candle;
    const dir = Number.isFinite(stats.changePct)
      ? (stats.changePct >= 0 ? 'up' : 'down') + ' ' + Math.abs(stats.changePct).toFixed(2) + ' percent'
      : 'change unknown';
    const text = `Selected ${C().get().companyName || C().get().symbol} `
      + `${interval === '1d' ? 'daily' : interval} candle for ${D().label(c.time, interval)}, `
      + `close ${D().price(c.close)}, ${dir}.`;
    renderer.announce(text);
    return text;
  }

  /* The selected session goes into the query string, not into localStorage.
     A chart link that carries its own selection can be pasted to somebody
     else; a localStorage key is a note to yourself that also leaks into every
     other tab. */
  function writeUrl(time) {
    try {
      const u = new URL(location.href);
      if (time) u.searchParams.set('candle', time); else u.searchParams.delete('candle');
      history.replaceState(null, '', u.toString());
    } catch {}
  }

  function readUrl() {
    try { return new URLSearchParams(location.search).get('candle'); } catch { return null; }
  }

  /* One entry point for every way a candle can be chosen: click, arrow key,
     a restored URL. They must all end in the same state, or the keyboard path
     quietly becomes a second, thinner implementation. */
  function selectIndex(renderer, candles, index, opts) {
    const stats = D().candleStats(candles, index);
    if (!stats) return null;

    renderer.select(index);
    C().selectCandle(stats.candle, stats);
    writeUrl(stats.candle.time);
    announce(renderer, stats, C().get().interval);

    if (!opts || opts.track !== false) {
      window.Portal?.track?.('chart_candle_selected', {
        symbol: C().get().symbol,
        interval: C().get().interval,
        time: stats.candle.time,
        source: (opts && opts.source) || 'pointer'
      });
    }
    return stats;
  }

  function clear(renderer) {
    renderer.clearSelection();
    C().clearSelection();
    writeUrl(null);
    renderer.announce('Selection cleared.');
    window.Portal?.track?.('chart_selection_cleared', { symbol: C().get().symbol });
  }

  /* Restoring from the URL is deliberately silent about failure: a link to a
     session that is not in the loaded window is a normal thing to click, and
     the page offers to load more data rather than reporting an error. */
  function restoreFromUrl(renderer, candles) {
    const wanted = readUrl();
    if (!wanted) return null;
    const i = candles.findIndex(c => c.time === wanted);
    if (i === -1) return { missing: wanted };
    return { stats: selectIndex(renderer, candles, i, { source: 'url', track: false }), index: i };
  }

  return { selectIndex, clear, restoreFromUrl, readUrl, writeUrl, announce };
})();
