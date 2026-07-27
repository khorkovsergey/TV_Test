/* =========================================================================
   Navigation — five doors, small panels, and one way to reach everything.

   The rule this file implements: a menu is a map, not an index. Each door
   opens at most five rows and a link to the section page that holds the rest.
   Nothing is hidden by mode — depth is marked and sorted lower, because a
   person who cannot see that a tool exists cannot grow into it.

   What makes a five-item nav safe is the command palette: ⌘K (or clicking the
   search field, which until now was decoration) searches every destination in
   the IA plus every instrument in the market universe. If it exists, you can
   type its name and be there.
   ========================================================================= */

(function () {
  'use strict';

  const IA = window.IA;
  if (!IA) return;

  const track = (event, props) => {
    if (window.Portal?.track) window.Portal.track(event, props);
    else console.log('[analytics]', event, props || {});
  };

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STATUS = {
    live:   { label: '',        title: 'Working in this prototype' },
    pilot:  { label: 'PILOT',   title: 'A deliberate stub: the flow is real, the depth is not' },
    mapped: { label: 'MAPPED',  title: 'Exists on the real platform; kept in the map, not built here' }
  };

  /* ------------------------------------------------------------- styles */

  const css = `
  .nav-door{position:relative;display:inline-flex;align-items:center;gap:2px}
  .nav-caret{background:none;border:none;color:var(--tv-faint);cursor:pointer;font-size:10px;line-height:1;padding:6px 4px;border-radius:5px;font-family:var(--tv-font)}
  .nav-caret:hover,.nav-door.open .nav-caret{color:#fff;background:var(--tv-ink-2)}
  .nav-panel{position:absolute;top:calc(100% + 10px);left:-10px;min-width:330px;background:var(--tv-ink);border:1px solid var(--tv-ink-3);
    border-radius:12px;padding:10px;display:none;z-index:9500;box-shadow:0 18px 50px rgba(0,0,0,.6)}
  .nav-door.open .nav-panel{display:block}
  .nav-panel .tl{font-size:12px;color:var(--tv-faint);padding:4px 10px 8px;line-height:1.4}
  .nav-panel a{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 10px;border-radius:8px;
    font-size:13.5px;font-weight:400;color:var(--tv-text)}
  .nav-panel a:hover{background:var(--tv-ink-2);color:#fff}
  .nav-panel a .d{font-size:11px;color:var(--tv-faint);text-align:right}
  .nav-panel .all{margin-top:6px;border-top:1px solid var(--tv-line);padding-top:8px}
  .nav-panel .all a{color:var(--tv-blue);font-weight:700}
  .st{font-family:var(--tv-mono);font-size:8.5px;letter-spacing:.06em;border-radius:4px;padding:1px 5px;white-space:nowrap}
  .st-pilot{color:var(--tv-orange);background:var(--tv-orange-dim);border:1px solid #4a3510}
  .st-mapped{color:var(--tv-ghost);background:var(--tv-ink-2);border:1px solid var(--tv-ink-3)}
  .st-pro{color:#B48CFF;background:#221340;border:1px solid #3C2A66}

  .portal-nav .search{cursor:pointer;position:relative}
  .portal-nav .search:hover{border:1px solid var(--tv-ink-3);color:var(--tv-text)}
  .portal-nav .search .kbd{margin-left:auto;font-family:var(--tv-mono);font-size:10px;color:var(--tv-ghost);
    border:1px solid var(--tv-ink-3);border-radius:4px;padding:1px 5px}
  .portal-nav .avatar{cursor:pointer}

  .cmd-back{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9600;display:flex;justify-content:center;align-items:flex-start;padding-top:12vh}
  .cmd{width:640px;max-width:94vw;background:var(--tv-ink);border:1px solid var(--tv-ink-3);border-radius:14px;overflow:hidden;
    box-shadow:0 24px 70px rgba(0,0,0,.7);display:flex;flex-direction:column;max-height:74vh}
  .cmd input{background:none;border:none;border-bottom:1px solid var(--tv-ink-3);border-radius:0;padding:16px 18px;
    font-size:16px;color:#fff;width:100%;outline:none}
  .cmd .list{overflow-y:auto;padding:8px}
  .cmd .row{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;cursor:pointer;color:var(--tv-text);font-size:13.5px}
  .cmd .row.on{background:var(--tv-blue-dim);outline:1px solid var(--tv-blue-line)}
  .cmd .row .where{font-family:var(--tv-mono);font-size:10px;color:var(--tv-ghost);flex:0 0 auto}
  .cmd .row .lbl{font-weight:700;color:#fff}
  .cmd .row .d{font-size:11.5px;color:var(--tv-faint);flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cmd .hint{border-top:1px solid var(--tv-ink-3);padding:9px 14px;font-family:var(--tv-mono);font-size:10.5px;color:var(--tv-ghost);
    display:flex;gap:14px;flex-wrap:wrap}
  .cmd .empty{padding:26px 18px;color:var(--tv-faint);font-size:13.5px}
  .cmd .grp{font-family:var(--tv-mono);font-size:9.5px;color:#5B8DFF;letter-spacing:.08em;padding:10px 12px 4px}
  @media (prefers-reduced-motion:reduce){.cmd,.nav-panel{transition:none}}`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const h = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

  const badge = it => {
    const bits = [];
    if (it.status !== 'live') bits.push(`<span class="st st-${it.status}" title="${esc(STATUS[it.status].title)}">${STATUS[it.status].label}</span>`);
    if (it.level === 'pro') bits.push('<span class="st st-pro" title="Depth — shown to everyone, always">PRO</span>');
    return bits.join(' ');
  };

  /* ------------------------------------------------------- door panels */

  function closeAll() {
    document.querySelectorAll('.nav-door.open').forEach(d => {
      d.classList.remove('open');
      d.querySelector('.nav-caret')?.setAttribute('aria-expanded', 'false');
    });
  }

  function buildPanels() {
    const menu = document.querySelector('.portal-nav .menu');
    if (!menu) return;

    for (const door of IA.PANEL_DOORS) {
      const link = [...menu.querySelectorAll('a')].find(a => a.textContent.trim() === door.label);
      if (!link) continue;

      /* The label stays a link — a disclosure button sits beside it. Turning
         the label itself into a toggle would take away the one-click route to
         the section, which is the destination most people actually want. */
      const wrap = document.createElement('span');
      wrap.className = 'nav-door';
      link.parentNode.insertBefore(wrap, link);
      wrap.appendChild(link);

      const caret = h(`<button class="nav-caret" aria-expanded="false" aria-label="Open the ${esc(door.label)} menu">▾</button>`);
      wrap.appendChild(caret);

      const rows = IA.menuRows(door, 5);
      const panel = h(`<div class="nav-panel" role="group" aria-label="${esc(door.label)}">
        <div class="tl">${esc(door.tagline)}</div>
        ${rows.map(i => `<a href="${esc(i.url)}" data-ia="${esc(i.id)}">
            <span>${esc(i.label)} ${badge(i)}</span>
            <span class="d">${esc(i.desc || i.group)}</span></a>`).join('')}
        <div class="all"><a href="${esc(door.url)}">See everything in ${esc(door.label)} →</a></div>
      </div>`);
      wrap.appendChild(panel);

      caret.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const open = wrap.classList.contains('open');
        closeAll();
        if (!open) {
          wrap.classList.add('open');
          caret.setAttribute('aria-expanded', 'true');
          track('nav_menu_opened', { menu: door.id, rows: rows.length });
        }
      });

      panel.addEventListener('click', e => {
        const a = e.target.closest('a[data-ia]');
        if (a) track('nav_menu_item', { menu: door.id, item: a.dataset.ia });
      });
    }

    document.addEventListener('click', closeAll);
  }

  /* ---------------------------------------------------- command palette */

  let instruments = [];
  let instrumentsTried = false;
  let onInstruments = null;      // the open palette, waiting to redraw

  /* Instruments join the palette the first time it opens. They arrive after
     the first keystrokes, so whatever is on screen redraws when they land —
     otherwise typing a ticker in the first second finds nothing. A failure
     here is silent on purpose: the palette must still find every page. */
  async function loadInstruments() {
    if (instrumentsTried) return;
    instrumentsTried = true;
    try {
      const r = await fetch('/api/markets', { signal: AbortSignal.timeout(2500) });
      const d = await r.json();
      instruments = (d.items || []).filter(i => i.ok).map(i => ({
        id: 'sym-' + i.symbol, label: i.symbol, desc: i.name,
        url: '/symbol.html?symbol=' + encodeURIComponent(i.symbol),
        status: 'live', level: 'core', door: 'Instrument', group: i.cls,
        keywords: `${i.symbol} ${i.name} ${i.cls}`
      }));
    } catch {
      try {
        const r = await fetch('/assets/quotes-sample.json', { signal: AbortSignal.timeout(2500) });
        const d = await r.json();
        instruments = (d.items || []).map(i => ({
          id: 'sym-' + i.symbol, label: i.symbol, desc: i.name,
          url: '/symbol.html?symbol=' + encodeURIComponent(i.symbol),
          status: 'live', level: 'core', door: 'Instrument', group: i.cls,
          keywords: `${i.symbol} ${i.name} ${i.cls}`
        }));
      } catch { /* the palette still lists every page */ }
    }
    if (onInstruments) onInstruments();
  }

  function score(item, q) {
    const label = item.label.toLowerCase();
    const hay = `${label} ${(item.desc || '').toLowerCase()} ${(item.keywords || '').toLowerCase()} ${(item.door || '').toLowerCase()}`;
    if (!q) return 0;
    if (label === q) return 100;
    if (label.startsWith(q)) return 80;
    if (label.includes(q)) return 60;
    if (hay.includes(q)) return 30;
    // every letter in order — catches "yldcrv" for "Yield curves"
    let i = 0;
    for (const ch of hay) if (ch === q[i]) i++;
    return i === q.length ? 10 : -1;
  }

  let palette = null;

  function openPalette(prefill) {
    if (palette) return;
    loadInstruments();

    const back = h('<div class="cmd-back" role="dialog" aria-modal="true" aria-label="Search everything"></div>');
    const box = h(`<div class="cmd">
      <input type="text" placeholder="Search anything — a page, a tool, an instrument" aria-label="Search everything" autocomplete="off">
      <div class="list"></div>
      <div class="hint"><span>↑↓ move</span><span>↵ open</span><span>esc close</span><span id="cmdCount"></span></div>
    </div>`);
    back.appendChild(box);
    document.body.appendChild(back);
    palette = back;

    const input = box.querySelector('input');
    const list = box.querySelector('.list');
    let results = [], cursor = 0;

    function render() {
      const q = input.value.trim().toLowerCase();
      const pool = IA.allItems().concat(instruments);

      results = (q
        ? pool.map(i => ({ i, s: score(i, q) })).filter(x => x.s >= 0)
            .sort((a, b) => b.s - a.s || a.i.label.length - b.i.label.length).map(x => x.i)
        : pool.filter(i => i.status === 'live' && i.door !== 'Footer')
      ).slice(0, 40);

      cursor = 0;
      box.querySelector('#cmdCount').textContent =
        q ? `${results.length} of ${pool.length}` : `${pool.length} destinations`;

      if (!results.length) {
        list.innerHTML = `<div class="empty">Nothing matches “${esc(input.value)}”.
          Every destination of the portal is on the <a href="/directory.html">site map</a>.</div>`;
        return;
      }

      list.innerHTML = (q ? '' : '<div class="grp">WORKING IN THIS PROTOTYPE</div>') +
        results.map((i, n) => `<div class="row ${n === 0 ? 'on' : ''}" data-n="${n}">
          <span class="where">${esc(i.door)}</span>
          <span class="lbl">${esc(i.label)} ${badge(i)}</span>
          <span class="d">${esc(i.desc || i.group || '')}</span>
        </div>`).join('');
    }

    function move(delta) {
      const rows = [...list.querySelectorAll('.row')];
      if (!rows.length) return;
      rows[cursor]?.classList.remove('on');
      cursor = (cursor + delta + rows.length) % rows.length;
      rows[cursor].classList.add('on');
      rows[cursor].scrollIntoView({ block: 'nearest' });
    }

    function go(n) {
      const item = results[n];
      if (!item) return;
      track('command_palette_selected', { item: item.id, query: input.value.trim(), door: item.door });
      window.Portal?.meaningful?.('command_palette', { item: item.id });
      close();
      location.href = item.url;
    }

    function close() {
      back.remove();
      palette = null;
      onInstruments = null;
      document.removeEventListener('keydown', onKey, true);
    }

    onInstruments = () => { if (palette === back) render(); };

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(cursor); }
    }

    let typed = 0;
    input.addEventListener('input', () => {
      render();
      if (++typed === 1 || typed % 5 === 0) track('command_palette_search', { query: input.value.trim().slice(0, 40) });
    });
    list.addEventListener('click', e => {
      const row = e.target.closest('.row');
      if (row) go(Number(row.dataset.n));
    });
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey, true);

    if (prefill) input.value = prefill;
    render();
    input.focus();
    track('command_palette_opened', { page: location.pathname, prefill: Boolean(prefill) });
  }

  /* ------------------------------------------------------ the search box */

  function wireSearch() {
    const box = document.querySelector('.portal-nav .search');
    if (!box) return;
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', 'Search everything. Keyboard shortcut: Control or Command K');
    if (!box.querySelector('.kbd')) box.appendChild(h('<span class="kbd">⌘K</span>'));
    box.addEventListener('click', () => openPalette());
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPalette(); }
    });

    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      // "/" is the other muscle memory, but not while typing into a field
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) {
        e.preventDefault(); openPalette();
      }
    });
  }

  /* ---------------------------------------------------------- my space */

  function wireAvatar() {
    const avatar = document.querySelector('.portal-nav .avatar');
    if (!avatar) return;
    const door = IA.DOORS.find(d => d.id === 'my');
    if (!door) return;

    const wrap = document.createElement('span');
    wrap.className = 'nav-door';
    avatar.parentNode.insertBefore(wrap, avatar);
    wrap.appendChild(avatar);

    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('aria-expanded', 'false');
    avatar.setAttribute('aria-label', 'My space');

    const items = door.groups[0].items;
    const panel = h(`<div class="nav-panel" role="group" aria-label="My space" style="left:auto;right:-6px;min-width:290px">
      <div class="tl">${esc(door.tagline)}</div>
      ${items.map(i => `<a href="${esc(i.url)}" data-ia="${esc(i.id)}">
          <span>${esc(i.label)} ${badge(i)}</span>
          <span class="d">${esc(i.desc || '')}</span></a>`).join('')}
      <div class="all"><a href="/directory.html">Full site map →</a></div>
    </div>`);
    wrap.appendChild(panel);

    const toggle = e => {
      e.preventDefault();
      e.stopPropagation();
      const open = wrap.classList.contains('open');
      closeAll();
      if (!open) {
        wrap.classList.add('open');
        avatar.setAttribute('aria-expanded', 'true');
        track('my_space_opened', { page: location.pathname });
      }
    };
    avatar.addEventListener('click', toggle);
    avatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
  }

  /* -------------------------------------------------------------- boot */

  function init() {
    buildPanels();
    wireSearch();
    wireAvatar();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.PortalNav = { openPalette };
})();
