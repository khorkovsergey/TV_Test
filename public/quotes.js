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
  let inflight = null;

  async function snapshot(force) {
    if (!force && cached && Date.now() - cached.at < TTL) return cached.data;
    if (!inflight) {
      inflight = fetch('/api/markets')
        .then(r => r.json())
        .then(data => { cached = { at: Date.now(), data }; return data; })
        .finally(() => { inflight = null; });
    }
    return inflight;
  }

  async function symbol(sym) {
    const r = await fetch('/api/symbol/' + encodeURIComponent(sym));
    if (!r.ok) throw new Error((await r.json()).error || 'Symbol not found');
    return r.json();
  }

  const movers = limit => fetch('/api/markets/movers?limit=' + (limit || 6)).then(r => r.json());

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
