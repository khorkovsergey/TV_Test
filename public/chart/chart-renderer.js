/* =========================================================================
   Candlestick renderer.

   §3.1 replaced a line prototype — one polyline over twenty closes, with no
   timestamps and nothing selectable — with this: one body and one wick per
   bar, a volume histogram, a right price scale, a bottom time scale,
   crosshair, zoom, pan and hit-testing.

   Why SVG rather than canvas. jsdom returns null from getContext('2d'), so a
   canvas renderer would put the whole of §24 tests 8–23 beyond reach: nobody
   could assert that a candle was drawn, let alone that clicking it selected
   the right session. With SVG each bar is an element carrying its own index,
   so the same code path serves a pointer in a browser and an assertion in a
   test, and a click lands on a candle rather than on a computed guess about
   where a candle probably is. Two hundred and fifty rectangles is not a
   performance question.

   The renderer draws and reports. It owns no selection state — that lives in
   ChartContext — and it never fetches.
   ========================================================================= */

window.ChartRenderer = (function () {

  const NS = 'http://www.w3.org/2000/svg';

  /* Light reference theme (§4.2). Dark is a later change; these are named so
     the switch is a table swap rather than a search through the drawing code. */
  const THEME = {
    up: '#089981', down: '#F23645',
    upVol: 'rgba(8,153,129,.45)', downVol: 'rgba(242,54,69,.45)',
    grid: '#EDF0F3', axis: '#D6DCE3',
    text: '#4A5058', faint: '#8A9099',
    crosshair: '#9AA3AE', selection: '#2962FF',
    selectionBand: 'rgba(41,98,255,.09)',
    rangeBand: 'rgba(41,98,255,.13)', outside: 'rgba(120,130,145,.13)'
  };

  const PRICE_W = 64;     // right-hand price scale
  const TIME_H = 26;      // bottom time scale
  const VOL_SHARE = 0.20; // of the plot height
  const PAD = 10;

  /* jsdom reports every element as 0×0. A deterministic fallback keeps the
     geometry — and therefore the tests — meaningful, and a real browser
     overwrites it on the first measure. */
  const FALLBACK_W = 1200, FALLBACK_H = 560;

  const el = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  };

  function create(opts) {
    const host = opts.host;
    const on = opts.on || {};

    const svg = el('svg', {
      class: 'ch-svg', role: 'application', tabindex: '0',
      'aria-label': 'Price chart — use left and right arrows to move between candles'
    });
    const layers = {};
    for (const name of ['grid', 'vol', 'candles', 'compare', 'band', 'markers', 'cross', 'axis', 'hit']) {
      layers[name] = el('g', { class: 'ch-l-' + name });
      svg.appendChild(layers[name]);
    }
    host.appendChild(svg);

    const live = el('desc', {});
    svg.appendChild(live);

    let candles = [];
    let interval = '1d';
    let currency = 'USD';
    let i0 = 0, i1 = 0;              // visible index window, inclusive
    let selectedIndex = null;
    let rangeSel = null;             // { a, b }
    let markers = [];
    let compare = [];                // [{ symbol, values: number[] }]
    let W = FALLBACK_W, H = FALLBACK_H;
    let geom = null;
    let hoverIndex = null;

    function measure() {
      const w = host.clientWidth || host.getBoundingClientRect().width || 0;
      const h = host.clientHeight || host.getBoundingClientRect().height || 0;
      W = Math.max(320, Math.round(w) || FALLBACK_W);
      H = Math.max(220, Math.round(h) || FALLBACK_H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('preserveAspectRatio', 'none');
    }

    /* ---------------------------------------------------------- geometry */

    function computeGeometry() {
      const plotW = W - PRICE_W;
      const plotH = H - TIME_H;
      const volH = Math.max(28, plotH * VOL_SHARE);
      const priceTop = PAD;
      const priceBottom = plotH - volH - 8;
      const volTop = priceBottom + 8;
      const volBottom = plotH;

      const vis = candles.slice(i0, i1 + 1);
      const n = Math.max(1, vis.length);
      const barW = plotW / n;

      let lo = Infinity, hi = -Infinity;
      for (const c of vis) { if (c.low < lo) lo = c.low; if (c.high > hi) hi = c.high; }
      for (const s of compare) {
        for (let i = i0; i <= i1; i++) {
          const v = s.values[i];
          if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
      const pad = (hi - lo) * 0.06 || (hi || 1) * 0.02;
      lo -= pad; hi += pad;

      let volMax = 0;
      for (const c of vis) if (Number.isFinite(c.volume) && c.volume > volMax) volMax = c.volume;

      geom = {
        plotW, plotH, priceTop, priceBottom, volTop, volBottom, barW, lo, hi, volMax, n,
        x: i => (i - i0 + 0.5) * barW,
        y: v => priceBottom - ((v - lo) / (hi - lo || 1)) * (priceBottom - priceTop),
        vy: v => volMax > 0 ? volBottom - (v / volMax) * (volBottom - volTop) : volBottom,
        indexAtX: px => {
          const raw = Math.floor(px / barW) + i0;
          return Math.max(i0, Math.min(i1, raw));
        }
      };
      return geom;
    }

    /* ------------------------------------------------------------ drawing */

    const clear = g => { while (g.firstChild) g.removeChild(g.firstChild); };

    function drawGrid() {
      const g = layers.grid; clear(g);
      g.appendChild(el('rect', { x: 0, y: 0, width: W, height: H, fill: '#FFFFFF' }));
      const steps = 5;
      for (let s = 0; s <= steps; s++) {
        const y = geom.priceTop + (geom.priceBottom - geom.priceTop) * (s / steps);
        g.appendChild(el('line', { x1: 0, y1: y, x2: geom.plotW, y2: y, stroke: THEME.grid, 'stroke-width': 1 }));
      }
      g.appendChild(el('line', {
        x1: 0, y1: geom.volTop - 4, x2: geom.plotW, y2: geom.volTop - 4,
        stroke: THEME.grid, 'stroke-width': 1
      }));
      g.appendChild(el('line', {
        x1: geom.plotW, y1: 0, x2: geom.plotW, y2: geom.plotH, stroke: THEME.axis, 'stroke-width': 1
      }));
      g.appendChild(el('line', {
        x1: 0, y1: geom.plotH, x2: W, y2: geom.plotH, stroke: THEME.axis, 'stroke-width': 1
      }));
    }

    function drawCandles() {
      const g = layers.candles; clear(g);
      const v = layers.vol; clear(v);
      const hit = layers.hit; clear(hit);

      const bodyW = Math.max(1, Math.min(14, geom.barW * 0.64));

      for (let i = i0; i <= i1; i++) {
        const c = candles[i];
        if (!c) continue;
        const up = c.close >= c.open;
        const colour = up ? THEME.up : THEME.down;
        const x = geom.x(i);
        const yO = geom.y(c.open), yC = geom.y(c.close);
        const top = Math.min(yO, yC);
        /* A doji closes where it opened: a zero-height rect renders nothing at
           all, so the body keeps a one-pixel floor and the bar stays visible. */
        const bodyH = Math.max(1, Math.abs(yC - yO));

        const bar = el('g', { class: 'ch-candle', 'data-index': String(i), 'data-time': c.time });
        bar.appendChild(el('line', {
          class: 'ch-wick', x1: x, y1: geom.y(c.high), x2: x, y2: geom.y(c.low),
          stroke: colour, 'stroke-width': 1
        }));
        bar.appendChild(el('rect', {
          class: 'ch-body', x: x - bodyW / 2, y: top, width: bodyW, height: bodyH,
          fill: colour, stroke: colour, 'stroke-width': 1
        }));
        g.appendChild(bar);

        if (Number.isFinite(c.volume) && geom.volMax > 0) {
          v.appendChild(el('rect', {
            class: 'ch-volbar', 'data-index': String(i),
            x: x - bodyW / 2, y: geom.vy(c.volume),
            width: bodyW, height: Math.max(1, geom.volBottom - geom.vy(c.volume)),
            fill: up ? THEME.upVol : THEME.downVol
          }));
        }

        /* One transparent full-height target per bar. It is what makes a click
           land on a session rather than on an interpolated x — and it is what
           lets a test click a candle without a layout engine. */
        hit.appendChild(el('rect', {
          class: 'ch-hit', 'data-index': String(i), 'data-time': c.time,
          x: x - geom.barW / 2, y: 0, width: geom.barW, height: geom.plotH,
          fill: 'transparent'
        }));
      }
    }

    function drawCompare() {
      const g = layers.compare; clear(g);
      const palette = ['#2962FF', '#9C27B0', '#FF9800'];
      compare.forEach((s, si) => {
        const pts = [];
        for (let i = i0; i <= i1; i++) {
          const val = s.values[i];
          if (Number.isFinite(val)) pts.push(`${geom.x(i).toFixed(1)},${geom.y(val).toFixed(1)}`);
        }
        if (pts.length < 2) return;
        g.appendChild(el('polyline', {
          class: 'ch-compare', 'data-symbol': s.symbol, points: pts.join(' '),
          fill: 'none', stroke: palette[si % palette.length], 'stroke-width': 1.6, opacity: '.9'
        }));
      });
    }

    function drawBands() {
      const g = layers.band; clear(g);

      if (rangeSel) {
        const a = Math.max(i0, Math.min(rangeSel.a, rangeSel.b));
        const b = Math.min(i1, Math.max(rangeSel.a, rangeSel.b));
        const x1 = geom.x(a) - geom.barW / 2;
        const x2 = geom.x(b) + geom.barW / 2;
        /* Outside the span is dimmed rather than the span being brightened:
           the selection should read as "this part", not as a highlight pen. */
        g.appendChild(el('rect', { class: 'ch-outside', x: 0, y: 0, width: Math.max(0, x1), height: geom.plotH, fill: THEME.outside }));
        g.appendChild(el('rect', { class: 'ch-outside', x: x2, y: 0, width: Math.max(0, geom.plotW - x2), height: geom.plotH, fill: THEME.outside }));
        g.appendChild(el('rect', { class: 'ch-range-band', x: x1, y: 0, width: Math.max(1, x2 - x1), height: geom.plotH, fill: THEME.rangeBand }));
        for (const [xx, txt] of [[x1, candles[a]?.time], [x2, candles[b]?.time]]) {
          if (!txt) continue;
          g.appendChild(el('line', { x1: xx, y1: 0, x2: xx, y2: geom.plotH, stroke: THEME.selection, 'stroke-width': 1 }));
        }
      }

      if (selectedIndex != null && selectedIndex >= i0 && selectedIndex <= i1) {
        const x = geom.x(selectedIndex);
        const c = candles[selectedIndex];
        g.appendChild(el('rect', {
          class: 'ch-sel-band', x: x - geom.barW / 2, y: 0,
          width: Math.max(2, geom.barW), height: geom.plotH, fill: THEME.selectionBand
        }));
        g.appendChild(el('line', {
          class: 'ch-sel-line', x1: x, y1: 0, x2: x, y2: geom.plotH,
          stroke: THEME.selection, 'stroke-width': 1
        }));
        const bodyW = Math.max(3, Math.min(16, geom.barW * 0.64) + 4);
        g.appendChild(el('rect', {
          class: 'ch-sel-outline',
          x: x - bodyW / 2, y: geom.y(c.high) - 3,
          width: bodyW, height: Math.max(6, geom.y(c.low) - geom.y(c.high) + 6),
          fill: 'none', stroke: THEME.selection, 'stroke-width': 1.4, rx: 2
        }));
      }
    }

    function drawMarkers() {
      const g = layers.markers; clear(g);
      markers.forEach(m => {
        const i = indexOfTime(m.time);
        if (i == null || i < i0 || i > i1) return;
        const x = geom.x(i);
        const y = geom.priceTop + 8 + (m.lane || 0) * 15;
        const node = el('g', {
          class: 'ch-marker', 'data-marker-id': m.id,
          'data-time': m.time, tabindex: '0', role: 'button'
        });
        node.appendChild(el('line', { x1: x, y1: y, x2: x, y2: geom.y(candles[i].high) - 4, stroke: m.colour || '#FF9800', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
        node.appendChild(el('circle', { cx: x, cy: y, r: 6, fill: '#FFFFFF', stroke: m.colour || '#FF9800', 'stroke-width': 2 }));
        const t = el('title', {});
        t.textContent = `${m.title || 'Event'} — ${m.time}`;
        node.appendChild(t);
        g.appendChild(node);
      });
    }

    function drawAxis() {
      const g = layers.axis; clear(g);

      const steps = 5;
      for (let s = 0; s <= steps; s++) {
        const y = geom.priceTop + (geom.priceBottom - geom.priceTop) * (s / steps);
        const value = geom.hi - (geom.hi - geom.lo) * (s / steps);
        const label = el('text', {
          class: 'ch-price-tick', x: geom.plotW + 7, y: y + 4,
          fill: THEME.text, 'font-size': '11', 'font-family': 'Consolas,monospace'
        });
        label.textContent = window.ChartData.price(value, currency);
        g.appendChild(label);
      }

      /* The last close gets its own tag, coloured by the day's direction —
         the one number a visitor looks for before any other. */
      const last = candles[i1];
      if (last) {
        const prev = candles[i1 - 1];
        const up = prev ? last.close >= prev.close : last.close >= last.open;
        const y = geom.y(last.close);
        g.appendChild(el('rect', {
          class: 'ch-last-tag', x: geom.plotW + 1, y: y - 9,
          width: PRICE_W - 2, height: 18, fill: up ? THEME.up : THEME.down, rx: 2
        }));
        const t = el('text', {
          x: geom.plotW + 6, y: y + 4, fill: '#FFFFFF',
          'font-size': '11', 'font-family': 'Consolas,monospace'
        });
        t.textContent = window.ChartData.price(last.close, currency);
        g.appendChild(t);
      }

      const ticks = Math.min(8, geom.n);
      const step = Math.max(1, Math.floor(geom.n / ticks));
      for (let i = i0; i <= i1; i += step) {
        const c = candles[i];
        if (!c) continue;
        const t = el('text', {
          class: 'ch-time-tick', x: geom.x(i), y: geom.plotH + 17,
          fill: THEME.faint, 'font-size': '11', 'font-family': 'Consolas,monospace',
          'text-anchor': 'middle'
        });
        t.textContent = window.ChartData.shortLabel(c.time, interval);
        g.appendChild(t);
      }

      /* The selected session is named on the time scale itself, so the date is
         readable without the panel open (§5.2). */
      if (selectedIndex != null && selectedIndex >= i0 && selectedIndex <= i1) {
        const x = geom.x(selectedIndex);
        const text = window.ChartData.shortLabel(candles[selectedIndex].time, interval);
        const w = Math.max(52, text.length * 7 + 12);
        g.appendChild(el('rect', {
          class: 'ch-sel-date', x: x - w / 2, y: geom.plotH + 3,
          width: w, height: 18, fill: THEME.selection, rx: 2
        }));
        const t = el('text', {
          x, y: geom.plotH + 16, fill: '#FFFFFF', 'font-size': '11',
          'font-family': 'Consolas,monospace', 'text-anchor': 'middle'
        });
        t.textContent = text;
        g.appendChild(t);
      }
    }

    function drawCrosshair() {
      const g = layers.cross; clear(g);
      if (hoverIndex == null || hoverIndex < i0 || hoverIndex > i1) return;
      const x = geom.x(hoverIndex);
      g.appendChild(el('line', {
        class: 'ch-crosshair', x1: x, y1: 0, x2: x, y2: geom.plotH,
        stroke: THEME.crosshair, 'stroke-width': 1, 'stroke-dasharray': '3 3'
      }));
    }

    function draw() {
      if (!candles.length) return;
      measure();
      computeGeometry();
      drawGrid();
      drawCandles();
      drawCompare();
      drawBands();
      drawMarkers();
      drawAxis();
      drawCrosshair();
      if (on.visibleRange) on.visibleRange(candles[i0]?.time, candles[i1]?.time, i0, i1);
    }

    /* ------------------------------------------------------------- lookups */

    function indexOfTime(time) {
      if (time == null) return null;
      const i = candles.findIndex(c => c.time === time);
      return i === -1 ? null : i;
    }

    /* ------------------------------------------------------- interactions */

    const indexFromEvent = e => {
      const target = e.target && e.target.closest ? e.target.closest('[data-index]') : null;
      if (target) return Number(target.getAttribute('data-index'));
      /* No element under the pointer: fall back to arithmetic on the offset.
         `getBoundingClientRect` is zero-sized under jsdom, which is exactly
         why the transparent hit rects above exist. */
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return null;
      const px = ((e.clientX - rect.left) / rect.width) * W;
      if (px > geom.plotW) return null;
      return geom.indexAtX(px);
    };

    let dragging = null;

    svg.addEventListener('mousemove', e => {
      const i = indexFromEvent(e);
      if (i == null) return;
      if (dragging && dragging.mode === 'range') {
        dragging.b = i;
        rangeSel = { a: dragging.a, b: i };
        draw();
        return;
      }
      if (i !== hoverIndex) {
        hoverIndex = i;
        drawCrosshair();
        if (on.hover) on.hover(i, candles[i]);
      }
    });

    svg.addEventListener('mouseleave', () => {
      hoverIndex = null;
      drawCrosshair();
      if (on.hover) on.hover(null, null);
    });

    svg.addEventListener('mousedown', e => {
      const i = indexFromEvent(e);
      if (i == null) return;
      if (e.shiftKey) { dragging = { mode: 'range', a: i, b: i }; e.preventDefault(); }
      else dragging = { mode: 'maybe-pan', a: i, startX: e.clientX, moved: false };
    });

    svg.addEventListener('mouseup', e => {
      if (dragging && dragging.mode === 'range') {
        const i = indexFromEvent(e) ?? dragging.b;
        const a = Math.min(dragging.a, i), b = Math.max(dragging.a, i);
        dragging = null;
        if (b > a && on.rangeSelect) on.rangeSelect(a, b);
        return;
      }
      dragging = null;
    });

    svg.addEventListener('click', e => {
      const marker = e.target.closest && e.target.closest('[data-marker-id]');
      if (marker) {
        if (on.markerClick) on.markerClick(marker.getAttribute('data-marker-id'));
        return;
      }
      const i = indexFromEvent(e);
      if (i == null) return;
      if (on.select) on.select(i, candles[i], e);
    });

    svg.addEventListener('wheel', e => {
      if (!candles.length) return;
      e.preventDefault();
      const centre = indexFromEvent(e) ?? Math.round((i0 + i1) / 2);
      const span = i1 - i0 + 1;
      const next = Math.max(12, Math.min(candles.length, Math.round(span * (e.deltaY > 0 ? 1.25 : 0.8))));
      const ratio = span > 0 ? (centre - i0) / span : 0.5;
      let start = Math.round(centre - next * ratio);
      start = Math.max(0, Math.min(candles.length - next, start));
      i0 = start; i1 = start + next - 1;
      draw();
    }, { passive: false });

    svg.addEventListener('keydown', e => {
      if (!candles.length) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const step = e.key === 'ArrowLeft' ? -1 : 1;
        const base = selectedIndex != null ? selectedIndex : (hoverIndex != null ? hoverIndex : i1);
        const next = Math.max(0, Math.min(candles.length - 1, base + step));
        if (next < i0 || next > i1) {
          const span = i1 - i0;
          i0 = Math.max(0, Math.min(candles.length - 1 - span, next - Math.floor(span / 2)));
          i1 = i0 + span;
        }
        if (on.select) on.select(next, candles[next], e);
      } else if (e.key === 'Escape') {
        if (on.escape) on.escape();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const i = selectedIndex != null ? selectedIndex : (hoverIndex != null ? hoverIndex : i1);
        if (on.enter) on.enter(i, candles[i]);
      }
    });

    /* ---------------------------------------------------------------- api */

    function setData(next) {
      candles = Array.isArray(next.candles) ? next.candles : [];
      interval = next.interval || interval;
      currency = next.currency || currency;
      compare = [];
      const span = Math.min(candles.length, next.initialBars || 120);
      i0 = Math.max(0, candles.length - span);
      i1 = Math.max(0, candles.length - 1);
      selectedIndex = null;
      rangeSel = null;
      draw();
    }

    function announce(text) { live.textContent = text; svg.setAttribute('aria-label', text); }

    return {
      svg,
      setData,
      draw,
      redraw: draw,
      fitContent() { i0 = 0; i1 = Math.max(0, candles.length - 1); draw(); },
      setVisible(a, b) {
        i0 = Math.max(0, Math.min(a, b));
        i1 = Math.min(candles.length - 1, Math.max(a, b));
        draw();
      },
      visible: () => ({ from: i0, to: i1 }),
      select(i) { selectedIndex = i; rangeSel = null; draw(); },
      clearSelection() { selectedIndex = null; rangeSel = null; draw(); },
      selectRange(a, b) { rangeSel = { a, b }; selectedIndex = null; draw(); },
      selected: () => selectedIndex,
      setMarkers(list) { markers = Array.isArray(list) ? list : []; draw(); },
      markers: () => markers,
      setCompare(list) { compare = Array.isArray(list) ? list : []; draw(); },
      compareSeries: () => compare,
      candles: () => candles,
      indexOfTime,
      announce,
      focus() { try { svg.focus(); } catch {} },
      THEME
    };
  }

  return { create, THEME };
})();
