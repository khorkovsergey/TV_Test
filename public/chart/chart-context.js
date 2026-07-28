/* =========================================================================
   Chart context store.

   §7. The selection is the context. Before this, "what the user is looking at"
   lived in three places at once — a `localStorage` key, a label string in the
   toolbar, and nothing at all for the selected moment, because there was no
   selected moment. The Copilot then read the localStorage key and answered
   about today.

   One object owns it now, and every other module reads from here rather than
   from the DOM. Storing the selected candle in the DOM was the specific
   mistake this file exists to prevent: a repaint would have silently changed
   the question the Copilot was answering.
   ========================================================================= */

window.ChartContext = (function () {

  const listeners = new Set();

  let state = {
    symbol: 'BTCUSD',
    companyName: null,
    exchange: null,
    currency: 'USD',
    timezone: 'UTC',
    interval: '1d',
    chartRange: '1mo',
    visibleFrom: null,
    visibleTo: null,
    selection: { type: 'none' },
    indicators: [],
    compareSymbols: [],
    theme: 'light'
  };

  const get = () => state;

  function emit(name, detail) {
    for (const fn of listeners) {
      try { fn(state, name, detail); } catch (err) { console.error('[chart-context]', err); }
    }
    document.dispatchEvent(new CustomEvent(name, { detail: { state, ...detail } }));
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function patch(next, eventName, detail) {
    state = { ...state, ...next };
    emit(eventName, detail || {});
    return state;
  }

  /* ------------------------------------------------------------ selection */

  /* The derived numbers are computed once, here, so the chips, the panel and
     the server all read the same change percentage. Computing them per surface
     is how two places end up disagreeing about the same candle. */
  function selectCandle(candle, extra) {
    if (!candle || !Number.isFinite(candle.close)) return state;
    const e = extra || {};
    const prev = Number.isFinite(e.previousClose) ? e.previousClose : null;
    const change = prev != null ? candle.close - prev : null;
    const changePct = prev != null && prev !== 0 ? (candle.close / prev - 1) * 100 : null;
    const avgVol = Number.isFinite(e.averageVolume) ? e.averageVolume : null;
    const volumeRatio = (avgVol && avgVol > 0 && Number.isFinite(candle.volume))
      ? candle.volume / avgVol : null;

    return patch({
      selection: {
        type: 'candle',
        candle,
        previousClose: prev,
        change,
        changePct,
        averageVolume: avgVol,
        volumeRatio
      }
    }, 'chart:candle-selected', { candle });
  }

  function selectRange(range) {
    if (!range || !range.from || !range.to) return state;
    return patch({ selection: { type: 'range', range } }, 'chart:range-selected', { range });
  }

  function clearSelection() {
    if (state.selection.type === 'none') return state;
    return patch({ selection: { type: 'none' } }, 'chart:selection-cleared', {});
  }

  const setVisibleRange = (from, to) =>
    patch({ visibleFrom: from, visibleTo: to }, 'chart:visible-range-changed', { from, to });

  function setSymbol(symbol, meta) {
    const up = String(symbol || '').toUpperCase();
    if (!up) return state;
    /* A different instrument invalidates the selection outright — the same
       date on another symbol is a different question. */
    const changed = up !== state.symbol;
    return patch({
      symbol: up,
      companyName: meta?.companyName ?? (changed ? null : state.companyName),
      exchange: meta?.exchange ?? (changed ? null : state.exchange),
      currency: meta?.currency ?? state.currency,
      timezone: meta?.timezone ?? state.timezone,
      selection: changed ? { type: 'none' } : state.selection
    }, 'chart:symbol-changed', { symbol: up, previousSymbol: state.symbol });
  }

  function setInterval(interval, opts) {
    if (!interval || interval === state.interval) return state;
    /* The selection survives an interval change only when the caller has
       confirmed the same moment still exists at the new resolution. */
    const keep = opts && opts.selectionStillValid;
    return patch({
      interval,
      selection: keep ? state.selection : { type: 'none' }
    }, 'chart:interval-changed', { interval });
  }

  const setChartRange = range => patch({ chartRange: range }, 'chart:visible-range-changed', { range });
  const setCompare = list => patch({ compareSymbols: Array.isArray(list) ? list : [] },
    'chart:visible-range-changed', {});
  const setIndicators = list => patch({ indicators: Array.isArray(list) ? list : [] },
    'chart:visible-range-changed', {});

  /* ------------------------------------------------------- for the server */

  /* Exactly the shape `POST /api/copilot` validates (§11). Built here so the
     wire format has one definition and the panel cannot drift from it. */
  function copilotContext() {
    const s = state.selection;
    let selection = { type: 'none' };

    if (s.type === 'candle') {
      const c = s.candle;
      selection = {
        type: 'candle',
        time: c.time,
        open: c.open, high: c.high, low: c.low, close: c.close,
        volume: c.volume,
        previousClose: s.previousClose ?? undefined,
        change: s.change ?? undefined,
        changePct: s.changePct ?? undefined,
        averageVolume: s.averageVolume ?? undefined,
        volumeRatio: s.volumeRatio ?? undefined
      };
    } else if (s.type === 'range') {
      const r = s.range;
      selection = {
        type: 'range',
        from: r.from, to: r.to, candleCount: r.candleCount,
        open: r.open, close: r.close, changePct: r.percentChange,
        high: r.high, low: r.low,
        totalVolume: r.totalVolume ?? undefined,
        averageVolume: r.averageVolume ?? undefined
      };
    }

    return {
      page: 'chart_workspace',
      symbol: state.symbol,
      companyName: state.companyName || undefined,
      exchange: state.exchange || undefined,
      currency: state.currency,
      timezone: state.timezone,
      interval: state.interval,
      chartRange: state.chartRange,
      visibleRange: (state.visibleFrom && state.visibleTo)
        ? { from: state.visibleFrom, to: state.visibleTo } : undefined,
      selection
    };
  }

  /* A one-line description of the selection, used by the chips, the panel
     header and the screen-reader announcement so all three agree. */
  function describeSelection() {
    const s = state.selection;
    if (s.type === 'candle') {
      const pct = Number.isFinite(s.changePct)
        ? `${s.changePct >= 0 ? '+' : '−'}${Math.abs(s.changePct).toFixed(2)}%` : '';
      return `${state.symbol} · ${s.candle.time}${pct ? ' · ' + pct : ''}`;
    }
    if (s.type === 'range') {
      const pct = Number.isFinite(s.range.percentChange)
        ? `${s.range.percentChange >= 0 ? '+' : '−'}${Math.abs(s.range.percentChange).toFixed(2)}%` : '';
      return `${state.symbol} · ${s.range.from} → ${s.range.to}${pct ? ' · ' + pct : ''}`;
    }
    return `${state.symbol} · no candle selected`;
  }

  return {
    get, subscribe,
    selectCandle, selectRange, clearSelection,
    setVisibleRange, setSymbol, setInterval, setChartRange, setCompare, setIndicators,
    copilotContext, describeSelection
  };
})();
