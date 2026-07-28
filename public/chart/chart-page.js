/* =========================================================================
   Chart workspace controller.

   Everything that used to be a 280-line inline script in `charts.html` lives
   here, and the parts that were doing two jobs at once have been separated:
   the renderer draws, ChartContext remembers, ChartData calculates, and this
   file decides what happens when somebody clicks something.

   The rule the whole page is built around (§29): selection is context. A
   person points at the moment they do not understand, and the answer comes
   back to that moment.
   ========================================================================= */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const P = window.Portal;
  const D = window.ChartData;
  const C = window.ChartContext;

  const params = new URLSearchParams(location.search);
  const lsRaw = (k, f) => { try { const v = localStorage.getItem(k); return v === null ? f : v; } catch { return f; } };
  const lsJson = (k, f) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? f; } catch { return f; } };

  const symbol = (params.get('symbol') || lsRaw('active_symbol', '') || 'BTCUSD').toUpperCase();
  /* `range` used to mean two different things — a timeframe label and a
     history depth. They are now separate: `interval` is the bar size and
     `range` is how far back. An old `?range=1D` link means daily bars. */
  const LEGACY_RANGE = { '1D': ['1d', '3mo'], '1W': ['1d', '1y'], '1H': ['1h', '1mo'], '15': ['15m', '1mo'] };
  const legacy = LEGACY_RANGE[(params.get('range') || lsRaw('chart_range', '') || '').toUpperCase()];
  let interval = params.get('interval') || (legacy ? legacy[0] : '1d');
  let range = params.get('historyRange') || (legacy ? legacy[1] : '3mo');

  let renderer = null;
  let panel = null;
  let candles = [];
  let meta = null;
  let hoverStats = null;

  try { localStorage.setItem('active_symbol', symbol); } catch {}

  /* ------------------------------------------------------------- states */

  /* §BUG-CHART-001 — `hidden` alone is not enough here. Its `display:none`
     comes from the browser's own stylesheet, so any author rule carrying a
     `display` beats it: the loading overlay stayed on top of a fully drawn
     chart. `chart-theme.css` now neutralises `[hidden]` inside the workspace,
     and this sets the inline style as well, so the behaviour does not depend
     on one stylesheet having loaded. */
  function toggle(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  }

  function showState(html) {
    const box = $('chartState');
    box.innerHTML = html;
    toggle(box, true);
  }
  const hideState = () => toggle($('chartState'), false);

  /* ---------------------------------------------------------- the header */

  function paintOhlc(stats) {
    const row = $('ohlcRow');
    if (!meta) return;
    const s = stats || (candles.length ? D.candleStats(candles, candles.length - 1) : null);
    if (!s) return;
    const c = s.candle;
    const cls = Number.isFinite(s.changePct) ? (s.changePct >= 0 ? 'up' : 'down') : '';

    row.innerHTML =
      `<span class="name">${esc(meta.name || meta.symbol)}</span>` +
      `<span>${esc(meta.symbol)} · ${esc(interval)}</span>` +
      `<span class="src">${esc(meta.exchange || meta.source || '')}</span>` +
      `<span>O <b>${D.price(c.open)}</b></span>` +
      `<span>H <b>${D.price(c.high)}</b></span>` +
      `<span>L <b>${D.price(c.low)}</b></span>` +
      `<span>C <b>${D.price(c.close)}</b></span>` +
      `<span class="${cls}">${Number.isFinite(s.change) ? (s.change >= 0 ? '+' : '−') + D.price(Math.abs(s.change)) : '—'} ` +
      `${D.pct(s.changePct)}</span>` +
      `<span>Vol <b>${D.volume(c.volume)}</b></span>` +
      `<span class="src">${esc(D.label(c.time, interval))}</span>` +
      (meta.stale ? '<span class="sample">STALE — kept from the last good fetch</span>' : '');
  }

  const esc = s => String(s ?? '').replace(/[&<>"]/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function paintTooltip(index) {
    const box = $('chartTooltip');
    if (index == null) { toggle(box, false); return; }
    const s = D.candleStats(candles, index);
    if (!s) { toggle(box, false); return; }
    const c = s.candle;
    toggle(box, true);
    box.innerHTML =
      `${esc(D.label(c.time, interval))}<br>` +
      `O ${D.price(c.open)}  H ${D.price(c.high)}<br>` +
      `L ${D.price(c.low)}  C ${D.price(c.close)}<br>` +
      `${D.pct(s.changePct)} · Vol ${D.volume(c.volume)}`;
  }

  /* ----------------------------------------------------------- selection */

  function onSelect(index, candle, ev) {
    /* §5.2 — with a drawing tool active a click is a drawing action, and
       hijacking it for the Copilot would make the tool unusable. */
    if (activeTool && activeTool !== 'cursor') return;

    if (window.ChartRangeSelection.isPicking()) {
      const stats = window.ChartRangeSelection.handlePickClick(renderer, candles, index, setPickHint);
      if (stats) openCopilotForRange(stats);
      return;
    }

    const stats = window.ChartSelection.selectIndex(renderer, candles, index, {
      source: ev && ev.type === 'keydown' ? 'keyboard' : 'pointer'
    });
    if (!stats) return;
    paintOhlc(stats);
    paintSelLabel(stats);
    openCopilotForCandle(stats);
  }

  function paintSelLabel(stats) {
    const box = $('selLabel');
    if (!stats) { toggle(box, false); return; }
    toggle(box, true);
    box.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = `${D.shortLabel(stats.candle.time, interval)} · ${D.pct(stats.changePct)}`;
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Clear selection');
    x.textContent = '✕';
    x.addEventListener('click', clearSelection);
    box.appendChild(text); box.appendChild(x);
  }

  function clearSelection() {
    window.ChartSelection.clear(renderer);
    toggle($('selLabel'), false);
    paintOhlc(null);
    window.ResearchCopilot?.updateContext(C.copilotContext());
  }

  function openCopilotForCandle(stats) {
    panel.show('copilot', 'candle');
    P?.track?.('chart_copilot_opened_from_candle', {
      symbol: C.get().symbol, interval, time: stats.candle.time
    });
    window.ResearchCopilot?.open({
      contextPatch: copilotPatch(),
      prefill: 'What happened on this day and why did the price move?',
      autoSend: false,
      reason: 'candle'
    });
  }

  function openCopilotForRange(stats) {
    panel.show('copilot', 'range');
    /* The journey rule that used to be attached to a hardcoded "21–24 Jul"
       box, now attached to a period the visitor actually chose. */
    P?.pushJourney?.({
      from: 'chart', to: 'news', rule: 'range_news',
      label: `Range news ${stats.from} → ${stats.to}`
    });
    window.ResearchCopilot?.open({
      contextPatch: copilotPatch(),
      prefill: 'What happened in this period?',
      autoSend: false,
      reason: 'range'
    });
  }

  /* The one place the panel's context is built, so the chips, the request and
     the server validation all describe the same thing. */
  function copilotPatch() {
    const ctx = C.copilotContext();
    return {
      page: 'chart_workspace',
      symbol: ctx.symbol,
      companyName: ctx.companyName,
      exchange: ctx.exchange,
      currency: ctx.currency,
      timezone: ctx.timezone,
      interval: ctx.interval,
      chartRange: ctx.chartRange,
      visibleRange: ctx.visibleRange,
      chartSelection: ctx.selection,
      selection: ctx.selection
    };
  }

  /* ------------------------------------------------------------ drawing tools */

  let activeTool = 'cursor';

  function wireTools() {
    const rail = $('toolRail');
    rail.addEventListener('click', e => {
      const b = e.target.closest('[data-tool]');
      if (!b || b.classList.contains('locked')) return;
      activeTool = b.dataset.tool;
      rail.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
      toggle($('toolNote'), activeTool !== 'cursor');
      if (activeTool !== 'cursor') {
        $('toolNote').textContent =
          `${b.title} is a prototype drawing control: it takes the click so the chart does not, `
          + 'and it draws nothing. Switch back to the cursor to select candles again.';
      }
      P?.featureFirstUse?.('tool_' + activeTool);
    });
  }

  /* --------------------------------------------------------------- data */

  async function load() {
    showState('<div class="cw-skeleton"></div><div class="t">Loading '
      + esc(symbol) + ' ' + esc(interval) + ' candles…</div>');

    let data;
    try {
      data = await D.load(symbol, interval, range);
    } catch (err) {
      showState(
        '<div class="t">Historical candles are unavailable.</div>' +
        '<div class="s">' + esc(String(err.message || err)) +
        '. Nothing is drawn rather than invented — a chart of made-up candles is worse than no chart.</div>' +
        '<div class="row"><button type="button" class="cw-btn on" id="retryBtn">Retry</button>' +
        '<button type="button" class="cw-btn" id="sampleBtn">Use the clearly labelled sample chart</button></div>' +
        '<div class="s">The sample is one real NVIDIA daily series, captured once and frozen. It is '
        + 'labelled on every screen that shows it and it is never the default.</div>');
      $('retryBtn')?.addEventListener('click', load);
      $('sampleBtn')?.addEventListener('click', loadSample);
      return;
    }

    candles = data.candles || [];
    meta = data;
    /* The toolbar carried a hardcoded BTCUSD: opening /charts?symbol=ETHUSD
       drew Ethereum under a Bitcoin label. */
    $('symbolBtn').textContent = data.symbol;
    $('symbolBtn').title = data.name || data.symbol;
    document.title = `${data.symbol} — chart workspace`;
    if (!candles.length) {
      showState('<div class="t">No candles came back for this instrument.</div>');
      return;
    }
    hideState();

    C.setSymbol(data.symbol, {
      companyName: data.name, exchange: data.exchange,
      currency: data.currency, timezone: data.timezone
    });
    C.setInterval(interval, { selectionStillValid: false });
    C.setChartRange(data.range);

    renderer.setData({ candles, interval, currency: data.currency, initialBars: 120 });
    paintOhlc(null);
    paintDetails();

    /* A link can carry its own selection; restoring it is what makes the URL
       worth writing (§26). */
    const restored = window.ChartSelection.restoreFromUrl(renderer, candles);
    if (restored && restored.missing) {
      toggle($('loadMoreNote'), true);
      $('loadMoreNote').textContent =
        `${restored.missing} is outside the loaded window.`;
    } else if (restored && restored.stats) {
      paintOhlc(restored.stats);
      paintSelLabel(restored.stats);
      panel.show('copilot', 'url');
    } else {
      window.ChartRangeSelection.restoreFromUrl(renderer, candles);
    }
    window.ResearchCopilot?.updateContext(copilotPatch());

    P?.track?.('chart_workspace_opened', {
      symbol, interval, range: data.range, candles: candles.length, mode: P?.mode?.()
    });
  }

  /* §22/§3.2 — the bundled fallback. It is a real series, frozen, and it is
     only ever reached by pressing a button that says what it is. The label
     then stays on screen for as long as it is being shown: a sample that
     announces itself once and then looks like live data is worse than none. */
  async function loadSample() {
    let data;
    try {
      const res = await fetch('/assets/chart-sample-nvda.json');
      data = await res.json();
    } catch (err) {
      showState('<div class="t">The bundled sample could not be loaded either.</div>');
      return;
    }
    candles = data.candles || [];
    meta = { ...data, delayed: true, stale: false };
    hideState();

    $('symbolBtn').textContent = data.symbol + ' · SAMPLE';
    C.setSymbol(data.symbol, {
      companyName: data.name, exchange: data.exchange,
      currency: data.currency, timezone: data.timezone
    });
    interval = data.interval;
    renderer.setData({ candles, interval, currency: data.currency, initialBars: 120 });
    paintOhlc(null);
    paintDetails();

    const banner = $('sampleBanner');
    toggle(banner, true);
    banner.textContent = 'SAMPLE · NOT LIVE — a frozen NVIDIA series captured '
      + String(data.captured_at || '').slice(0, 10)
      + '. Prices are real but not current, and the Copilot will answer about the dates shown.';
    P?.track?.('chart_sample_loaded', { symbol: data.symbol });
  }

  function paintDetails() {
    if (!meta) return;
    $('detailsPane').innerHTML =
      '<div class="cw-details"><b>' + esc(meta.name) + '</b> (' + esc(meta.symbol) + ')' +
      '<dl>' +
      '<dt>exchange</dt><dd>' + esc(meta.exchange || '—') + '</dd>' +
      '<dt>currency</dt><dd>' + esc(meta.currency) + '</dd>' +
      '<dt>timezone</dt><dd>' + esc(meta.timezone) + '</dd>' +
      '<dt>interval</dt><dd>' + esc(meta.interval) + '</dd>' +
      '<dt>range</dt><dd>' + esc(meta.range) + '</dd>' +
      '<dt>candles</dt><dd>' + candles.length + '</dd>' +
      '<dt>source</dt><dd>' + esc(meta.source) + '</dd>' +
      '<dt>delayed</dt><dd>' + (meta.delayed ? 'yes' : 'no') + '</dd>' +
      '</dl>' +
      '<p style="margin-top:12px">These are delayed bars from a free public endpoint. ' +
      'They are real prices, not a simulation — and they are not a market-data licence.</p></div>';
  }

  async function paintWatchlist() {
    const Q = window.Quotes;
    const pane = $('watchPane');
    try {
      const snap = await Q.snapshot();
      const by = new Map(snap.items.map(i => [i.symbol, i]));
      const want = (P?.watchlist?.() || []).filter(x => by.has(x));
      const rows = (want.length ? want : ['SPX', 'BTCUSD', 'ETHUSD', 'EURUSD'])
        .map(x => by.get(x)).filter(Boolean);
      /* When the live source did not answer, these prices come from the
         snapshot bundled with the build. Showing them unlabelled beside a
         live chart would be the exact dishonesty this stand argues against. */
      const sampleNote = snap.isSample
        ? '<div class="cw-details" style="color:#B26A00">SAMPLE · NOT LIVE — the quote source did not '
          + 'answer, so these are the prices bundled with this build'
          + (snap.asOf ? ' (captured ' + esc(String(snap.asOf).slice(0, 10)) + ')' : '') + '.</div>'
        : '';
      pane.innerHTML = sampleNote + rows.map(i =>
        `<div class="cw-wl-row"><a href="/symbols/${encodeURIComponent(i.symbol)}">${esc(i.symbol)}</a>
         <span class="${(i.changePct ?? 0) >= 0 ? 'up' : 'down'}">${Q.price(i.price, i)} ${Q.pct(i.changePct)}</span></div>`
      ).join('') + (want.length ? ''
        : '<div class="cw-details">Your list is empty — these four are benchmarks, not a suggestion.</div>');
      /* The panel opens on Watchlist, but a visitor who selected a candle is
         looking at Copilot — so the marker also goes where the chart is. */
      const banner = $('sampleBanner');
      toggle(banner, snap.isSample);
      if (snap.isSample) {
        banner.textContent = 'SAMPLE · NOT LIVE — watchlist quotes come from the bundled snapshot; '
          + 'the candles above are live history.';
      }
    } catch {
      pane.innerHTML = '<div class="cw-details">Quotes are unavailable right now.</div>';
    }
  }

  /* ------------------------------------------------------ chart actions */

  /* §17. The answer comes back to the chart. Each of these is applied only
     after the server has agreed the payload is usable. */
  document.addEventListener('copilot:chart-action', ev => {
    const { id, payload, answer } = ev.detail;
    try {
      if (id === 'mark_chart_events') {
        const { placed, unplaced } = window.ChartMarkers.add(payload.events, candles, interval);
        renderer.setMarkers(window.ChartMarkers.list());
        P?.track?.('chart_event_markers_added', { placed: placed.length, unplaced: unplaced.length });
        ev.detail.result = {
          confirm: unplaced.length
            ? `${placed.length} marked, ${unplaced.length} outside the loaded window`
            : `${placed.length} marked on the chart`
        };
        return;
      }

      if (id === 'compare_selected_period') {
        addComparisons(payload.symbols);
        ev.detail.result = { confirm: 'Adding ' + payload.symbols.join(', ') + '…' };
        return;
      }

      if (id === 'create_event_alert') {
        const alert = window.Alerts.create({
          symbol: payload.symbol,
          condition: payload.kind === 'volume' ? 'volume' : 'event',
          value: payload.value ?? null,
          note: payload.description,
          context: C.describeSelection()
        });
        /* Success is not claimed before the store has it (§17.3). */
        ev.detail.result = alert
          ? { confirm: 'Alert saved — nothing watches the market for you' }
          : { error: 'The alert could not be saved on this device' };
        if (alert) P?.track?.('chart_event_alert_created', { symbol: payload.symbol, kind: payload.kind });
        return;
      }

      if (id === 'save_research') {
        const saved = saveResearch(answer);
        ev.detail.result = saved
          ? { confirm: 'Saved — find it under Research → Saved research' }
          : { error: 'Nothing to save yet' };
        return;
      }

      if (id === 'clear_chart_selection') {
        clearSelection();
        ev.detail.result = { confirm: 'Selection cleared' };
        return;
      }

      if (id === 'expand_selected_range') {
        const a = candles.findIndex(c => c.time === payload.from);
        const b = candles.findIndex(c => c.time === payload.to);
        if (a === -1 || b === -1) { ev.detail.result = { error: 'That period is outside the loaded data' }; return; }
        const stats = window.ChartRangeSelection.apply(renderer, candles, a, b);
        window.ResearchCopilot?.updateContext(copilotPatch());
        ev.detail.result = stats ? { confirm: 'Range widened' } : { error: 'Could not widen the range' };
      }
    } catch (err) {
      ev.detail.result = { error: String(err.message || err) };
    }
  });

  async function addComparisons(symbols) {
    const ctx = C.get();
    const anchor = renderer.selected() != null ? renderer.selected() : candles.length - 1;
    const series = renderer.compareSeries().slice();
    const failed = [];
    for (const s of (symbols || []).slice(0, 3)) {
      const out = await window.ChartCompare.add(s, ctx, candles, anchor);
      if (out.ok) series.push({ symbol: out.symbol, values: out.values });
      else failed.push(out.error);
    }
    renderer.setCompare(series);
    C.setCompare(series.map(s => s.symbol));
    const note = $('compareNote');
    toggle(note, Boolean(series.length || failed.length));
    note.textContent = [
      series.length ? 'Comparing: ' + series.map(s => s.symbol).join(', ')
        + ' — lined up at the selected session, not at the left edge.' : '',
      failed.join(' ')
    ].filter(Boolean).join(' ');
    P?.track?.('chart_period_compared', { symbols: series.map(s => s.symbol), failed: failed.length });
  }

  function saveResearch(answer) {
    if (!answer || !answer.text) return null;
    const ctx = C.copilotContext();
    const item = {
      id: 'cr_' + Math.random().toString(36).slice(2, 10),
      symbol: ctx.symbol,
      interval: ctx.interval,
      selection: ctx.selection,
      question: answer.question || '',
      answer: answer.text,
      sources: (answer.sources || []).filter(s => s && typeof s === 'object')
        .map(s => ({ title: s.title, url: s.url, publishedAt: s.publishedAt || null })),
      eventMarkers: window.ChartMarkers.list().map(m => m.id),
      createdAt: new Date().toISOString()
    };
    try {
      const all = JSON.parse(localStorage.getItem('saved_chart_research') || '[]');
      all.push(item);
      localStorage.setItem('saved_chart_research', JSON.stringify(all.slice(-50)));
    } catch { return null; }
    P?.track?.('chart_research_saved', { symbol: ctx.symbol, selection: ctx.selection.type });
    return item;
  }

  document.addEventListener('copilot:clear-selection', clearSelection);

  /* --------------------------------------------------------------- modes */

  /* Three presets over one chart and one dataset. What changes is how much of
     the workspace is present — never the numbers (§19). */
  /* §4.3/§7.5 — temporary disclosure. Showing advanced controls once must not
     promote the visitor to another mode behind their back, so this flag is
     page-local and never written to the preference. */
  let drawerOpen = false;

  function applyMode(m, source) {
    const mode = P.setMode(m, source);
    /* The page follows the global switcher and says so, rather than offering a
       second one beside it. */
    const follows = $('modeFollows');
    if (follows) {
      const label = window.Modes ? window.Modes.policy(mode).label : mode;
      follows.textContent = 'View follows: ' + label;
      follows.title = 'Change it in the header — it applies everywhere.';
    }

    let below = 0;
    document.querySelectorAll('[data-min]').forEach(el => {
      const allowed = P.allows(mode, el.dataset.min);
      const visible = allowed || drawerOpen;
      if (el.classList.contains('cw-tool')) el.classList.toggle('locked', !visible);
      else { el.hidden = !visible; el.style.display = visible ? '' : 'none'; }
      if (!allowed) below++;
    });

    const drawer = $('advDrawer');
    if (drawer) {
      toggle(drawer, below > 0 || drawerOpen);
      /* The count lives in its own span: rewriting the whole button label
         would delete it, and the next repaint would have nowhere to write. */
      $('advLabel').textContent = drawerOpen ? 'Back to the ' + mode + ' preset' : 'Advanced tools';
      $('advCount').textContent = below;
      toggle($('advCount'), !drawerOpen);
    }

    const CAPTION = {
      simple: 'click a candle · plain-language answer',
      standard: 'candle and period · factors and comparison',
      pro: 'intraday, multiple comparisons, exportable context'
    };
    $('modeCaption').textContent = CAPTION[mode];
    $('toolCap').textContent = mode === 'simple' ? '3 of 9' : mode === 'standard' ? '6 of 9' : '9 of 9';
    document.body.dataset.uiMode = mode;
    toggle($('simpleHint'), mode === 'simple');

    if (renderer) renderer.draw();
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    /* The markup declares which elements start hidden; boot applies that
       through the same path everything else uses. Without this the initial
       state and the runtime state are set two different ways, and only one of
       them survives a stylesheet that gives the element a `display` — which is
       exactly how §BUG-CHART-001 got shipped. */
    document.querySelectorAll('#workspace [hidden]').forEach(el => toggle(el, false));

    renderer = window.ChartRenderer.create({
      host: $('chartPlot'),
      on: {
        hover(i) {
          hoverStats = i == null ? null : D.candleStats(candles, i);
          paintTooltip(i);
          paintOhlc(hoverStats || (renderer.selected() != null
            ? D.candleStats(candles, renderer.selected()) : null));
          if (i != null) P?.track?.('chart_candle_hovered', { index: i });
        },
        select: onSelect,
        enter: onSelect,
        escape: clearSelection,
        rangeSelect(a, b) {
          const stats = window.ChartRangeSelection.apply(renderer, candles, a, b);
          if (stats) openCopilotForRange(stats);
        },
        markerClick(id) {
          const m = window.ChartMarkers.byId(id);
          if (m && m.url) window.open(m.url, '_blank', 'noopener');
        },
        visibleRange(from, to) { C.setVisibleRange(from, to); }
      }
    });

    panel = window.ChartPanel.create({
      root: $('sidePanel'),
      onResize() { if (renderer) renderer.draw(); }
    });
    panel.paint();

    /* Every control in the workspace declares a maturity, including the ones
       on the far rail — a disabled button that was never decorated is exactly
       the "active-looking button with no reaction" §4.3 forbids. */
    window.ChartToolbar.wire($('workspace'), $('maturityNote'));
    wireTools();

    /* The Copilot docks into the panel column instead of covering the chart.
       Docked, it has no visible state of its own — the tab does — so it is
       given the way to reveal itself. Without that every route in (the header
       button, the floating button, a programmatic open) did nothing at all. */
    const mount = () => {
      window.ResearchCopilot?.mountInto($('copilotPane'), () => {
        panel.show('copilot', 'copilot-api');
      });
    };
    if (window.ResearchCopilot) mount();
    else document.addEventListener('copilot-ready', mount, { once: true });

    /* The header button exists on every page and was wired on every page but
       this one — the rewrite dropped it. */
    $('askCopilot')?.addEventListener('click', () => {
      panel.show('copilot', 'header');
      window.ResearchCopilot?.open({ contextPatch: copilotPatch(), reason: 'header' });
    });

    $('advDrawer')?.addEventListener('click', e => {
      if (!e.target.closest('button')) return;
      drawerOpen = !drawerOpen;
      applyMode(P.mode(), 'drawer');
      P?.track?.(drawerOpen ? 'temporary_advanced_opened' : 'temporary_advanced_closed',
        { surface: 'chart', mode: P.mode() });
    });

    /* The explicit promotion — never automatic. */
    $('makeDefault')?.addEventListener('click', () => {
      const to = P.mode() === 'simple' ? 'standard' : 'pro';
      P.setMode(to, 'make_default');
      drawerOpen = false;
      applyMode(to, 'make_default');
      document.dispatchEvent(new CustomEvent('ui-mode-changed', { detail: { to } }));
      P?.track?.('make_mode_default_clicked', { to, surface: 'chart' });
    });
    document.addEventListener('ui-mode-changed', () => applyMode(P.mode(), 'sync'));

    $('intervalBar').addEventListener('click', e => {
      const b = e.target.closest('[data-interval]');
      if (!b) return;
      interval = b.dataset.interval;
      range = D.normalise(interval, range).range;
      /* §29.3 — the chart's own state adapter. Symbol, interval, range, the
       visible window, the selection, the markers, the comparisons and the
       panel tab all have to survive a mode switch: this is the surface where
       losing any of them would be most obviously wrong. */
    window.ModeOrchestrator?.registerStateAdapter('chart', {
      capture: () => ({
        visible: renderer ? renderer.visible() : null,
        selected: renderer ? renderer.selected() : null,
        selection: C.get().selection,
        markers: window.ChartMarkers.list().length,
        compare: renderer ? renderer.compareSeries().map(s2 => s2.symbol) : [],
        tab: panel ? panel.active() : null
      }),
      restore(own) {
        if (!own || !renderer) return;
        if (own.visible) renderer.setVisible(own.visible.from, own.visible.to);
        if (own.selected != null && candles[own.selected]) renderer.select(own.selected);
        if (own.tab) panel.show(own.tab, 'reflow');
      }
    });

    paintRangeBar();
      load();
    });
    $('rangeBar').addEventListener('click', e => {
      const b = e.target.closest('[data-range]');
      if (!b) return;
      range = b.dataset.range;
      /* §29.3 — the chart's own state adapter. Symbol, interval, range, the
       visible window, the selection, the markers, the comparisons and the
       panel tab all have to survive a mode switch: this is the surface where
       losing any of them would be most obviously wrong. */
    window.ModeOrchestrator?.registerStateAdapter('chart', {
      capture: () => ({
        visible: renderer ? renderer.visible() : null,
        selected: renderer ? renderer.selected() : null,
        selection: C.get().selection,
        markers: window.ChartMarkers.list().length,
        compare: renderer ? renderer.compareSeries().map(s2 => s2.symbol) : [],
        tab: panel ? panel.active() : null
      }),
      restore(own) {
        if (!own || !renderer) return;
        if (own.visible) renderer.setVisible(own.visible.from, own.visible.to);
        if (own.selected != null && candles[own.selected]) renderer.select(own.selected);
        if (own.tab) panel.show(own.tab, 'reflow');
      }
    });

    paintRangeBar();
      load();
    });

    /* The escape hatch, and it works in both directions. */
    $('fullBtn').addEventListener('click', () => { drawerOpen = false; applyMode('pro', 'full_button'); });

    $('density').addEventListener('input', e => {
      const v = P.setDensity(e.target.value);
      $('workspace').dataset.density = v;
      P?.featureFirstUse?.('density');
    });
    $('density').addEventListener('change', e =>
      P?.track?.('density_changed', { density: P.setDensity(e.target.value), mode: P.mode() }));

    /* Any progressive control reports its first use — that is the measure of
       whether the ramp actually leads anywhere. */
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-feature]');
      if (!el || el.classList.contains('locked')) return;
      P?.featureFirstUse?.(el.dataset.feature);
    });

    $('fitBtn').addEventListener('click', () => renderer.fitContent());
    $('pickRangeBtn').addEventListener('click', () => {
      if (window.ChartRangeSelection.isPicking()) window.ChartRangeSelection.cancelPick(setPickHint);
      else window.ChartRangeSelection.beginPick(setPickHint);
    });
    $('clearSelBtn').addEventListener('click', clearSelection);
    $('sheetExpand')?.addEventListener('click', () =>
      $('sidePanel').classList.toggle('tall'));

    window.addEventListener('resize', () => renderer.draw());

    /* §29.3 — the chart's own state adapter. Symbol, interval, range, the
       visible window, the selection, the markers, the comparisons and the
       panel tab all have to survive a mode switch: this is the surface where
       losing any of them would be most obviously wrong. */
    window.ModeOrchestrator?.registerStateAdapter('chart', {
      capture: () => ({
        visible: renderer ? renderer.visible() : null,
        selected: renderer ? renderer.selected() : null,
        selection: C.get().selection,
        markers: window.ChartMarkers.list().length,
        compare: renderer ? renderer.compareSeries().map(s2 => s2.symbol) : [],
        tab: panel ? panel.active() : null
      }),
      restore(own) {
        if (!own || !renderer) return;
        if (own.visible) renderer.setVisible(own.visible.from, own.visible.to);
        if (own.selected != null && candles[own.selected]) renderer.select(own.selected);
        if (own.tab) panel.show(own.tab, 'reflow');
      }
    });

    paintRangeBar();

    /* A visitor who has never chosen a mode is being assigned one — worth one
       event, so the funnel knows which mode the session started in. */
    const hadMode = lsRaw('ui_mode', null) !== null;
    applyMode(P.mode(), 'default');
    if (!hadMode) P?.track?.('mode_switch', { from: null, to: P.mode(), mode: P.mode(), source: 'default' });

    $('workspace').dataset.density = P.density();
    $('density').value = P.density();

    paintWatchlist();
    load();

    /* "Новичок не потерялся": did the first chart session end in the mode it
       started in, and how long did it last. */
    const openedAt = Date.now();
    const startMode = P.mode();
    let firstSession = false;
    try {
      firstSession = !sessionStorage.getItem('chart_seen');
      sessionStorage.setItem('chart_seen', '1');
    } catch {}
    window.addEventListener('pagehide', () => {
      P?.track?.('chart_first_session_exit', {
        mode: P.mode(), started_in: startMode, first_session: firstSession,
        ms_on_page: Date.now() - openedAt
      });
    });
  }

  function setPickHint(text) {
    const el = $('pickHint');
    toggle(el, Boolean(text));
    el.textContent = text || '';
    $('pickRangeBtn').classList.toggle('on', Boolean(text));
  }

  function paintRangeBar() {
    document.querySelectorAll('#intervalBar [data-interval]').forEach(b =>
      b.classList.toggle('on', b.dataset.interval === interval));
    document.querySelectorAll('#rangeBar [data-range]').forEach(b => {
      const allowed = D.normalise(interval, b.dataset.range).range === b.dataset.range;
      b.classList.toggle('on', b.dataset.range === range);
      b.disabled = !allowed;
      b.title = allowed ? '' : `${b.dataset.range} of ${interval} bars is more than the free source returns`;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
