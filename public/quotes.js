/* =========================================================================
   Quotes — the browser side of the market layer.

   One fetch of /api/markets serves every surface on the page, and the same
   formatting rules apply everywhere: a price is shown with the precision the
   instrument actually trades at, a change is always signed, and a number that
   could not be fetched renders as a dash rather than a zero.
   ========================================================================= */

window.Quotes = (function () {

  let cached = null;         // { at, data }
  const TTL = 30_000;
  const BUDGET_MS = 3_000;   // никто не смотрит на «Loading…» дольше трёх секунд
  let inflight = null;
  let samplePromise = null;

  /* A frozen snapshot shipped with the build. It exists so that a slow or
     unreachable quote source degrades into numbers that are honestly labelled
     SAMPLE, instead of a page that sits on "Loading…" indefinitely. */
  function sample() {
    if (!samplePromise) {
      samplePromise = fetch('/assets/quotes-sample.json')
        .then(r => r.json())
        .then(d => ({
          ...d,
          asOf: d.captured_at,
          age_ms: Date.now() - new Date(d.captured_at).getTime(),
          stale: false,
          isSample: true,
          ok_count: d.items.length,
          failed: []
        }))
        .catch(() => null);
    }
    return samplePromise;
  }

  /* The live call and a three-second stopwatch race each other. Whoever wins,
     the page renders; a late live answer still lands in the cache for the next
     surface that asks. */
  function withBudget(live, fallback) {
    return new Promise((resolve, reject) => {
      let settled = false;
      /* A null from the fallback is a real answer ("nothing to show"), not a
         missing one — resolving on truthiness alone would leave the caller
         waiting forever, which is the exact failure this whole file exists to
         prevent. */
      const finish = fn => v => { if (!settled) { settled = true; fn(v); } };
      const toFallback = () => fallback().then(finish(resolve), finish(reject));

      const timer = setTimeout(() => { if (!settled) toFallback(); }, BUDGET_MS);

      live.then(
        v => { clearTimeout(timer); finish(resolve)(v); },
        err => {
          clearTimeout(timer);
          // A definitive answer from the server (an unknown symbol) is not a
          // timeout: pass it through instead of covering it with sample data.
          if (err && err.fatal) finish(reject)(err);
          else toFallback();
        });
    });
  }

  async function snapshot(force) {
    if (!force && cached && Date.now() - cached.at < TTL) return cached.data;
    if (!inflight) {
      inflight = fetch('/api/markets')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(data => { cached = { at: Date.now(), data }; return data; })
        .finally(() => { inflight = null; });
    }
    const data = await withBudget(inflight, sample);
    if (!data) throw new Error('quotes unavailable and no bundled fallback');
    return data;
  }

  /* One instrument, with the same budget. The bundled snapshot has no computed
     technicals, so a sample answer says so rather than showing empty boxes. */
  async function symbol(sym) {
    const live = fetch('/api/symbol/' + encodeURIComponent(sym))
      .then(async r => {
        const body = await r.json();
        if (!r.ok) {
          const err = new Error(body.error || 'Symbol not found');
          err.fatal = true;      // the server knows: this ticker does not exist here
          throw err;
        }
        return body;
      });

    return withBudget(
      live,
      async () => {
        const s = await sample();
        const item = s?.items.find(i => i.symbol === String(sym).toUpperCase());
        if (!item) return null;
        return {
          ...item, isSample: true, asOf: s.captured_at, source: s.source, note: s.note,
          technicals: null,
          peers: s.items.filter(i => i.cls === item.cls && i.symbol !== item.symbol)
            .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0)).slice(0, 5)
        };
      }
    ).then(v => {
      if (!v) throw new Error('quotes unavailable and this symbol is not in the bundled snapshot');
      return v;
    });
  }

  async function movers(limit) {
    const n = limit || 6;
    const live = fetch('/api/markets/movers?limit=' + n)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });

    return withBudget(live, async () => {
      const s = await sample();
      if (!s) return null;
      const live2 = s.items.filter(i => Number.isFinite(i.changePct));
      const by = dir => [...live2].sort((a, b) => dir * (a.changePct - b.changePct)).slice(0, n);
      return {
        asOf: s.captured_at, source: s.source, stale: false, isSample: true,
        gainers: by(-1), losers: by(1),
        biggest_moves: [...live2].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, n)
      };
    });
  }

  /* ------------------------------------------------------------ formatting */

  /* Precision follows the instrument, not a global rule: 65,090.26 for bitcoin
     and 0.07256 for dogecoin are both "the price" and both have to read right. */
  function price(v, item) {
    if (!Number.isFinite(v)) return '—';
    if (item?.isYield) return v.toFixed(3) + '%';
    const abs = Math.abs(v);
    const digits = abs >= 1000 ? 2 : abs >= 100 ? 2 : abs >= 1 ? (item?.cls === 'forex' ? 4 : 2) : abs >= 0.01 ? 4 : 6;
    return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function pct(v, withSign = true) {
    if (!Number.isFinite(v)) return '—';
    const s = v.toFixed(2) + '%';
    return withSign && v > 0 ? '+' + s : s;
  }

  function change(v, item) {
    if (!Number.isFinite(v)) return '—';
    const s = price(Math.abs(v), item);
    return (v > 0 ? '+' : v < 0 ? '−' : '') + s;
  }

  function volume(v) {
    if (!Number.isFinite(v) || v === 0) return '—';
    const u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (const [n, s] of u) if (v >= n) return (v / n).toFixed(v / n >= 100 ? 0 : 1) + s;
    return String(v);
  }

  const cls = v => Number.isFinite(v) ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';

  function ago(iso) {
    if (!iso) return 'unknown';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
  }

  /* --------------------------------------------------------------- drawing */

  /* A month of daily closes as a 64x20 sparkline. Flat or missing series draw
     nothing rather than a misleading straight line at zero. */
  function spark(series, w = 64, h = 20) {
    if (!Array.isArray(series) || series.length < 2) return '';
    const lo = Math.min(...series), hi = Math.max(...series);
    const span = hi - lo || 1;
    const pts = series.map((v, i) =>
      `${(i / (series.length - 1) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`).join(' ');
    const up = series.at(-1) >= series[0];
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="${up ? '#089981' : '#F23645'}" stroke-width="1.5"/></svg>`;
  }

  /* Where the price sits inside its 52-week range — the one number that turns
     "is this high?" from a feeling into a fact. */
  function rangeBar(item) {
    const { price: p, wk52Low: lo, wk52High: hi } = item;
    if (![p, lo, hi].every(Number.isFinite) || hi <= lo) return '';
    const at = Math.min(100, Math.max(0, ((p - lo) / (hi - lo)) * 100));
    return `<span class="rangebar" title="${at.toFixed(0)}% of the 52-week range"><i style="left:${at}%"></i></span>`;
  }

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ----------------------------------------------------------- disclosure */

  /* Every surface that shows a number also shows where it came from and how
     old it is. If instruments failed to load, that is stated too — the count
     of missing rows is part of the truth about the data. */
  function sourceLine(snap) {
    if (!snap) return '';
    const failed = (snap.failed || []).length;

    /* The tag is the whole point: a visitor must be able to tell at a glance
       whether the numbers in front of them came from the market a minute ago
       or from a snapshot frozen into the build. */
    if (snap.isSample) {
      return `<span class="tag tag-warn">SAMPLE · NOT LIVE</span>
        <span class="mono src">the live quote source did not answer in time — showing the snapshot
        bundled with this build, taken ${esc(new Date(snap.asOf).toUTCString().slice(5, 22))} UTC</span>`;
    }

    const bits = [
      `<span class="tag tag-fact">FACT · MARKET DATA</span>`,
      `<span class="mono src">${esc(snap.source || 'unknown source')} · updated ${ago(snap.asOf)}</span>`
    ];
    if (snap.stale) bits.push(`<span class="tag tag-warn">STALE — refresh failed, showing the last good snapshot</span>`);
    if (failed) bits.push(`<span class="tag tag-warn">${failed} instrument${failed > 1 ? 's' : ''} unavailable</span>`);
    return bits.join(' ');
  }

  return { snapshot, symbol, movers, price, pct, change, volume, cls, ago, spark, rangeBar, sourceLine, esc };
})();
