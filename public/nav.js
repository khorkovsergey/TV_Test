/* =========================================================================
   The global app shell — one navigation for beginners and professionals.

   Six doors: Overview · Research · Capital · Trade · Learn · Community.
   Always available beside them: search, the Copilot, the Simple/Standard/Pro
   switch and the profile.

   Two rules this file exists to keep:

   1. Mode changes what is offered first, never what is reachable. A menu shows
      more rows in Standard and Pro, but every destination stays in the section
      hub, in the site map and in ⌘K. §7.4: the full interface is never locked.
   2. A menu is a map, not an index — at most six rows and a way to see the
      rest. The command palette is what makes that safe: it searches every
      destination, every instrument and a set of actions.
   ========================================================================= */

(function () {
  'use strict';

  const IA = window.IA;
  if (!IA) return;

  const P = () => window.Portal;
  const track = (event, props) => {
    if (P()?.track) P().track(event, props);
    else console.log('[analytics]', event, props || {});
  };

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STATUS = {
    live:   { label: '',       title: 'Working in this prototype' },
    pilot:  { label: 'PILOT',  title: 'A deliberate stub: the flow is real, the depth is not' },
    mapped: { label: 'MAPPED', title: 'Exists on the real platform; kept in the map, not built here' }
  };

  /* Labels and hints come from the mode policy — the header must not be able
     to call a mode something the rest of the product does not. */
  const MODES = (window.Modes ? window.Modes.LIST.map(id => {
    const p = window.Modes.policy(id);
    return { id, label: p.label, hint: p.hint };
  }) : [
    { id: 'simple',   label: 'Simple',   hint: 'fewer panels, terms explained, one main action' },
    { id: 'standard', label: 'Standard', hint: 'full asset hub, screeners, fundamentals, saved layouts' },
    { id: 'pro',      label: 'Pro',      hint: 'density, multi-chart, Pine, strategy tester, shortcuts' }
  ]);

  /* ------------------------------------------------------------- styles */

  const css = `
  /* The whole label is the target — a 10px caret was a needle to thread. */
  .nav-door{position:relative;display:inline-flex;align-items:center}
  .nav-door > a{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px}
  .nav-door > a:hover{background:var(--tv-ink-2);color:#fff}
  .nav-door.open > a{background:var(--tv-ink-2);color:#fff}
  /* The caret is decoration, so it lives in CSS: it must not end up inside the
     link's text for a screen reader or a test to read back. */
  .nav-door > a::after{content:"▾";font-size:9px;line-height:1;color:var(--tv-faint);transition:transform .15s ease;display:inline-block}
  .nav-door.open > a::after{transform:rotate(180deg);color:#fff}
  .nav-panel{position:absolute;top:calc(100% + 10px);left:-10px;min-width:340px;background:var(--tv-ink);border:1px solid var(--tv-ink-3);
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
  .portal-nav .search .kbd{margin-left:auto;font-family:var(--tv-mono);font-size:10px;color:var(--tv-ghost);
    border:1px solid var(--tv-ink-3);border-radius:4px;padding:1px 5px}
  .portal-nav .avatar{cursor:pointer}

  .mode-switch{display:inline-flex;gap:2px;background:var(--tv-ink);border:1px solid var(--tv-ink-3);border-radius:var(--tv-r-pill);padding:3px}
  .mode-switch button{font-family:var(--tv-font);font-size:12px;font-weight:700;padding:5px 11px;border-radius:var(--tv-r-pill);
    color:var(--tv-muted);background:none;border:none;cursor:pointer;white-space:nowrap}
  .mode-switch button.on{background:var(--tv-blue);color:#fff}
  .mode-toast{position:fixed;right:18px;bottom:86px;z-index:9400;max-width:330px;background:var(--tv-ink);border:1px solid var(--tv-blue-line);
    border-radius:12px;padding:14px 16px;box-shadow:0 14px 40px rgba(0,0,0,.55)}
  .mode-toast b{color:#fff;display:block;margin-bottom:5px;font-size:13.5px}
  .mode-toast span{font-size:12.5px;color:var(--tv-muted);line-height:1.5}
  .mode-toast button{margin-top:10px}

  .cmd-back{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9600;display:flex;justify-content:center;align-items:flex-start;padding-top:12vh}
  .cmd{width:660px;max-width:94vw;background:var(--tv-ink);border:1px solid var(--tv-ink-3);border-radius:14px;overflow:hidden;
    box-shadow:0 24px 70px rgba(0,0,0,.7);display:flex;flex-direction:column;max-height:74vh}
  .cmd input{background:none;border:none;border-bottom:1px solid var(--tv-ink-3);border-radius:0;padding:16px 18px;
    font-size:16px;color:#fff;width:100%;outline:none}
  .cmd .list{overflow-y:auto;padding:8px}
  .cmd .row{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;cursor:pointer;color:var(--tv-text);font-size:13.5px}
  .cmd .row.on{background:var(--tv-blue-dim);outline:1px solid var(--tv-blue-line)}
  .cmd .row .where{font-family:var(--tv-mono);font-size:10px;color:var(--tv-ghost);flex:0 0 auto;width:82px}
  .cmd .row .lbl{font-weight:700;color:#fff}
  .cmd .row .d{font-size:11.5px;color:var(--tv-faint);flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cmd .hint{border-top:1px solid var(--tv-ink-3);padding:9px 14px;font-family:var(--tv-mono);font-size:10.5px;color:var(--tv-ghost);display:flex;gap:14px;flex-wrap:wrap}
  .cmd .empty{padding:26px 18px;color:var(--tv-faint);font-size:13.5px}
  .cmd .grp{font-family:var(--tv-mono);font-size:9.5px;color:#5B8DFF;letter-spacing:.08em;padding:10px 12px 4px}

  @media (max-width:900px){
    .portal-nav .menu{gap:10px;font-size:14px}
    .nav-panel{position:fixed;left:8px;right:8px;top:auto;min-width:0}
    .mode-switch button{padding:5px 8px;font-size:11px}
  }
  @media (prefers-reduced-motion:reduce){.cmd,.nav-panel,.mode-toast{transition:none}}`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const h = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };

  /* Which modifier this visitor's keyboard actually has. Both shortcuts stay
     bound either way — only the label changes. */
  const isApple = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  const shortcutLabel = () => (isApple() ? 'Cmd K' : 'Ctrl K');

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
      d.querySelector('a[aria-expanded], .avatar')?.setAttribute('aria-expanded', 'false');
    });
  }

  const panels = [];

  /* §7.1 — a navigation category never disappears with the mode. The level
     decides what the menu opens with; everything else moves under "More
     tools", one click away, in every mode. Before this, Simple silently
     deleted forty-four destinations and gave no sign they existed. */
  function paintPanel(entry) {
    const { section, panel } = entry;
    const mode = P()?.mode?.() || 'simple';
    const NAV = window.Navigation;

    /* §6.1 — no PILOT, no MAPPED, no PRO in a normal menu. Those are
       implementation states; a visitor reading a menu is choosing a task, and
       internal maturity competes with that. The full status map lives in
       Showcase and on the site map. */
    const { rows, more } = NAV
      ? NAV.menu(section.id, mode)
      : IA.menuSplit(section, mode, 6);

    const row = i => `<a href="${esc(i.url)}" data-ia="${esc(i.id || i.label)}">
          <span>${esc(i.label)}</span>
          <span class="d">${esc(i.desc || i.group || '')}</span></a>`;

    panel.innerHTML = `<div class="tl">${esc(section.question)}</div>
      ${rows.map(row).join('')}
      ${more.length ? `<details class="more-tools">
        <summary>More in ${esc(section.label)} <span class="n">${more.length}</span></summary>
        ${more.map(row).join('')}
      </details>` : ''}
      <div class="all"><a href="${esc(section.url)}">Open ${esc(section.label)} →</a></div>`;

    panel.querySelector('.more-tools')?.addEventListener('toggle', e => {
      if (e.target.open) track('temporary_advanced_opened',
        { surface: 'nav_menu', menu: section.id, mode, items: more.length });
      else track('temporary_advanced_closed', { surface: 'nav_menu', menu: section.id, mode });
    });
  }

  function repaintPanels() { panels.forEach(paintPanel); }

  function buildPanels() {
    const menu = document.querySelector('.portal-nav .menu');
    if (!menu) return;

    /* §P0-A — the menus read the USER navigation registry now. `ia.js` stays
       the product inventory and keeps powering the palette, the site map and
       the showcase; it stopped being what an ordinary visitor reads. */
    const NAV = window.Navigation;
    for (const section of (NAV ? NAV.SECTIONS : IA.SECTIONS)) {
      const link = [...menu.querySelectorAll('a')].find(a => a.textContent.trim() === section.label);
      if (!link) continue;

      /* Clicking the section name opens its menu — the label is the target, not
         a caret beside it. The element stays an <a href> so that a modified
         click (⌘, ctrl, middle, shift) still opens the hub, in a new tab if
         that is what was asked for, and so that the route survives without
         JavaScript. Inside the panel, "See everything in X" is the plain way
         to the hub. */
      const wrap = document.createElement('span');
      wrap.className = 'nav-door';
      link.parentNode.insertBefore(wrap, link);
      wrap.appendChild(link);

      link.setAttribute('aria-expanded', 'false');
      link.setAttribute('aria-haspopup', 'true');

      const panel = h(`<div class="nav-panel" role="group" aria-label="${esc(section.label)}"></div>`);
      wrap.appendChild(panel);

      const entry = { section, panel };
      panels.push(entry);
      paintPanel(entry);

      link.addEventListener('click', e => {
        // Let the browser do its job when the visitor asked for a new tab.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
        e.preventDefault(); e.stopPropagation();
        const open = wrap.classList.contains('open');
        closeAll();
        if (!open) {
          wrap.classList.add('open');
          link.setAttribute('aria-expanded', 'true');
          track('nav_menu_opened', { menu: section.id, mode: P()?.mode?.() });
        }
      });
      panel.addEventListener('click', e => {
        const a = e.target.closest('a[data-ia]');
        if (a) track('nav_menu_item', { menu: section.id, item: a.dataset.ia });
      });
    }
    document.addEventListener('click', closeAll);
  }

  /* --------------------------------------------------------- mode switch */

  function buildModeSwitch() {
    const right = document.querySelector('.portal-nav .right');
    if (!right || right.querySelector('.mode-switch')) return;

    /* A radio group, not three toggle buttons: exactly one is chosen, arrow
       keys move between them, and the state is announced as text rather than
       as a colour (§12, accessibility). */
    const sw = h(`<span class="mode-switch" role="radiogroup" aria-label="Interface complexity">
      ${MODES.map(m => `<button type="button" role="radio" data-mode="${m.id}" aria-checked="false"
        title="${esc(m.label)} — ${esc(m.hint)}">${m.label}</button>`).join('')}
      <button type="button" class="mode-cmp" data-cmp="1" aria-haspopup="dialog"
        title="What changes when you switch — and what does not">?</button>
    </span>`);
    right.insertBefore(sw, right.firstChild);

    const buttons = () => [...sw.querySelectorAll('[data-mode]')];

    const paint = () => {
      const cur = P()?.mode?.() || 'simple';
      buttons().forEach(b => {
        const on = b.dataset.mode === cur;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
        /* Only the selected radio is in the tab order; arrows move inside. */
        b.tabIndex = on ? 0 : -1;
      });
      /* Portal owns what goes on <body> — density and explanation depth ride
         along with the mode, and the header must not set only one of three. */
      P()?.applyBodyMode ? P().applyBodyMode() : (document.body.dataset.uiMode = cur);
    };

    function switchTo(to, source) {
      const from = P()?.mode?.() || 'simple';
      if (from === to || !to) return;
      P()?.setMode?.(to, source || 'switch');
      paint();
      repaintPanels();
      document.dispatchEvent(new CustomEvent('ui-mode-changed', { detail: { from, to } }));
      /* Moving up is the moment to say what just appeared — §7.4 asks for a
         short explanation, not a celebration. */
      if (IA.ORDER[to] > IA.ORDER[from]) explainMode(to);
    }

    sw.addEventListener('click', e => {
      if (e.target.closest('[data-cmp]')) { openCompare(); return; }
      const b = e.target.closest('[data-mode]');
      if (b) switchTo(b.dataset.mode, 'switch');
    });

    sw.addEventListener('keydown', e => {
      if (!e.target.closest('[data-mode]')) return;
      const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
                : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const ids = MODES.map(m => m.id);
      const cur = P()?.mode?.() || 'simple';
      const next = ids[(ids.indexOf(cur) + dir + ids.length) % ids.length];
      switchTo(next, 'keyboard');
      buttons().find(b => b.dataset.mode === next)?.focus();
    });

    paint();
    document.addEventListener('ui-mode-changed', paint);
  }

  /* §5.2 — say what the switch does before it is used. The two lists come
     from modes.js so the promise in the dialog and the rule in the code are
     literally the same strings. */
  function openCompare() {
    if (document.querySelector('.mode-cmp-back')) return;
    const M = window.Modes;
    if (!M) return;
    const cur = P()?.mode?.() || 'simple';

    const back = h(`<div class="mode-cmp-back" role="dialog" aria-modal="true" aria-label="Compare modes"></div>`);
    const box = h(`<div class="mode-cmp-box">
      <div class="hd"><b>Simple · Standard · Pro</b>
        <button type="button" class="x" aria-label="Close">✕</button></div>
      <p class="lead">One product, one set of routes, one account. The mode is a
        preset for how much is shown by default — nothing more.</p>
      <div class="cols">
        ${M.LIST.map(id => {
          const p = M.policy(id);
          return `<div class="col ${id === cur ? 'on' : ''}">
            <b>${esc(p.label)}${id === cur ? ' <span class="cur">your mode</span>' : ''}</b>
            <span class="ru">${esc(p.description)}</span>
            <span class="tg">${esc(p.tagline)}</span>
            <ul>
              <li>density: ${esc(p.density)}</li>
              <li>explanation: ${esc(p.explanationDepth)}</li>
              <li>up to ${p.maxPrimaryActions} primary actions</li>
              <li>chart preset: ${esc(p.chartPreset)}</li>
              <li>tables: ${esc(p.tableDensity)}</li>
            </ul>
            <button type="button" class="btn ${id === cur ? 'btn-quiet' : 'btn-primary'}" data-pick="${id}"
              ${id === cur ? 'disabled' : ''}>${id === cur ? 'Current' : 'Switch to ' + esc(p.label)}</button>
          </div>`;
        }).join('')}
      </div>
      <div class="two">
        <div><span class="h">Switching changes</span><ul>${M.CHANGES.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
        <div><span class="h">Switching never changes</span><ul>${M.KEEPS.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      </div>
    </div>`);
    back.appendChild(box);
    document.body.appendChild(back);
    track('mode_comparison_opened', { mode: cur, route: location.pathname });

    const close = (why) => {
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (why === 'cancel') track('mode_change_cancelled', { mode: P()?.mode?.() });
    };
    function onKey(e) { if (e.key === 'Escape') close('cancel'); }
    document.addEventListener('keydown', onKey);

    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('.x')) return close('cancel');
      const pick = e.target.closest('[data-pick]');
      if (!pick) return;
      const to = pick.dataset.pick, from = P()?.mode?.() || 'simple';
      P()?.setMode?.(to, 'comparison');
      repaintPanels();
      document.dispatchEvent(new CustomEvent('ui-mode-changed', { detail: { from, to } }));
      close();
    });

    box.querySelector('.x').focus();
  }

  function explainMode(to) {
    document.querySelector('.mode-toast')?.remove();
    const m = MODES.find(x => x.id === to);
    const toast = h(`<div class="mode-toast" role="status">
      <b>${esc(m.label)} mode is on</b>
      <span>What appeared: ${esc(m.hint)}. Nothing was taken away — the switch moves both ways.</span>
      <button type="button" class="btn btn-quiet" style="padding:5px 12px;font-size:12px">Got it</button>
    </div>`);
    document.body.appendChild(toast);
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    setTimeout(() => toast.remove(), 9000);
  }

  /* ---------------------------------------------------- command palette */

  let instruments = [];
  let instrumentsTried = false;
  let onInstruments = null;

  async function loadInstruments() {
    if (instrumentsTried) return;
    instrumentsTried = true;
    const map = items => items.map(i => ({
      id: 'sym-' + i.symbol, label: i.symbol, desc: i.name,
      url: '/symbols/' + encodeURIComponent(i.symbol),
      status: 'live', level: 'simple', door: 'Asset', group: i.cls,
      keywords: `${i.symbol} ${i.name} ${i.cls}`
    }));
    try {
      const r = await fetch('/api/markets', { signal: AbortSignal.timeout(2500) });
      instruments = map(((await r.json()).items || []).filter(i => i.ok));
    } catch {
      try {
        const r = await fetch('/assets/quotes-sample.json', { signal: AbortSignal.timeout(2500) });
        instruments = map((await r.json()).items || []);
      } catch { /* the palette still finds every page */ }
    }
    if (onInstruments) onInstruments();
  }

  /* Actions are the difference between a search box and a command palette:
     things you can do, not only places you can go. */
  function actions() {
    const sym = (() => { try { return localStorage.getItem('active_symbol') || 'BTCUSD'; } catch { return 'BTCUSD'; } })();
    const list = [
      { id: 'act-open', label: `Open ${sym}`, desc: 'asset hub', url: '/symbols/' + encodeURIComponent(sym), keywords: 'open asset symbol ' + sym },
      { id: 'act-chart', label: `Open ${sym} on the chart`, desc: 'workspace', url: '/charts?symbol=' + encodeURIComponent(sym), keywords: 'chart open ' + sym },
      { id: 'act-watch', label: `Add ${sym} to a watchlist`, desc: 'saves on this device', run: () => {
          P()?.toggleSymbol?.(sym); P()?.saveWatchlist?.('command_palette');
        }, keywords: 'add watchlist follow ' + sym },
      { id: 'act-alert', label: 'Create an alert', desc: 'from the chart', url: '/charts?symbol=' + encodeURIComponent(sym), keywords: 'alert create notify' },
      { id: 'act-screener', label: 'Open the screener', desc: 'ask the market a question', url: '/screeners', keywords: 'screener filter scan' },
      { id: 'act-paper', label: 'Go to paper trading', desc: 'practice without money', url: '/trade#practice', keywords: 'paper trading practice' },
      { id: 'act-events', label: 'Show the nearest events', desc: 'what is scheduled', url: '/overview#events', keywords: 'events calendar nearest upcoming' },
      { id: 'act-compare', label: 'Compare instruments', desc: 'side by side', url: '/markets', keywords: 'compare instruments side by side' }
    ];
    for (const m of MODES) {
      list.push({
        id: 'act-mode-' + m.id, label: `Switch to ${m.label} mode`, desc: m.hint,
        run: () => { P()?.setMode?.(m.id, 'palette'); document.dispatchEvent(new CustomEvent('ui-mode-changed', { detail: { to: m.id } })); repaintPanels(); },
        keywords: 'mode switch ' + m.id
      });
    }
    return list.map(a => ({ ...a, status: 'live', level: 'simple', door: 'Action', group: 'Actions' }));
  }

  /* §8 — the strategic features are searchable by their own name, by the
     problem they solve and by the words a person would actually type
     ("who can help me", "explain this rating"). A feature nobody can find
     is a feature that does not exist. */
  function featureItems() {
    const Fx = window.Features;
    if (!Fx) return [];
    return Fx.ALL.map(f => ({
      id: 'feat-' + f.id, label: f.shortName, desc: f.problem,
      url: f.route, status: (f.maturity === 'live' || f.maturity === 'beta') ? 'live' : 'mapped',
      level: 'simple', door: 'Feature', group: 'Product innovations',
      keywords: `${f.id} ${f.name} ${f.shortName} ${f.problem} ${f.solution} ${f.audience} ${f.searchTerms || ''}`
    }));
  }

  function score(item, q) {
    const label = item.label.toLowerCase();
    const hay = `${label} ${(item.desc || '').toLowerCase()} ${(item.keywords || '').toLowerCase()} ${(item.door || '').toLowerCase()}`;
    if (!q) return 0;
    if (label === q) return 100;
    if (label.startsWith(q)) return 80;
    if (label.includes(q)) return 60;
    if (hay.includes(q)) return 30;
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
      <input type="text" placeholder="Search or run an action — asset, page, “add AAPL to watchlist”" aria-label="Search everything" autocomplete="off">
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
      const pool = actions().concat(featureItems(), IA.allItems(), instruments);

      results = (q
        ? pool.map(i => ({ i, s: score(i, q) })).filter(x => x.s >= 0)
            .sort((a, b) => b.s - a.s || a.i.label.length - b.i.label.length).map(x => x.i)
        : actions().slice(0, 6).concat(featureItems().slice(0, 4),
            IA.allItems().filter(i => i.status === 'live' && i.door !== 'Company').slice(0, 12))
      ).slice(0, 40);

      cursor = 0;
      box.querySelector('#cmdCount').textContent = q ? `${results.length} of ${pool.length}` : `${pool.length} destinations and actions`;

      if (!results.length) {
        list.innerHTML = `<div class="empty">Nothing matches “${esc(input.value)}”.
          Everything the portal has is on the <a href="/sitemap">site map</a>.</div>`;
        return;
      }
      list.innerHTML = (q ? '' : '<div class="grp">ACTIONS AND WORKING PAGES</div>') +
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
      P()?.meaningful?.('command_palette', { item: item.id });
      close();
      if (item.run) { item.run(); return; }
      if (item.url) location.href = item.url;
    }

    function close() {
      back.remove(); palette = null; onInstruments = null;
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

  function wireSearch() {
    const box = document.querySelector('.portal-nav .search');
    if (!box) return;
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', 'Search everything. Keyboard shortcut: Control or Command K');
    /* The ⌘ glyph is missing from Consolas — the first font in the mono stack —
       so it rendered as a tofu box on Windows. The shortcut is named after the
       key the visitor actually has: Ctrl on Windows and Linux, Cmd elsewhere. */
    if (!box.querySelector('.kbd')) box.appendChild(h('<span class="kbd">' + shortcutLabel() + '</span>'));
    box.addEventListener('click', () => openPalette());
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPalette(); }
    });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) { e.preventDefault(); openPalette(); }
    });
  }

  /* ---------------------------------------------------------- my space */

  function wireAvatar() {
    const avatar = document.querySelector('.portal-nav .avatar');
    if (!avatar || avatar.closest('.nav-door')) return;
    const door = IA.MY_SPACE;

    const wrap = document.createElement('span');
    wrap.className = 'nav-door';
    avatar.parentNode.insertBefore(wrap, avatar);
    wrap.appendChild(avatar);

    avatar.setAttribute('role', 'button');
    avatar.setAttribute('tabindex', '0');
    avatar.setAttribute('aria-expanded', 'false');
    avatar.setAttribute('aria-label', 'My space');

    /* §3.3 — watchlists, alerts and saved research are things you KEEP, not a
       topic to browse. They belong to the workspace behind the profile, not
       at the top of a section about money. No status badges here either: the
       profile menu is not an implementation report. */
    const NAV = window.Navigation;
    const items = NAV ? NAV.WORKSPACE.items : door.groups[0].items;
    const title = NAV ? 'Everything you have kept here' : door.question;
    const panel = h(`<div class="nav-panel" role="group" aria-label="My workspace" style="left:auto;right:-6px;min-width:300px">
      <div class="tl">${esc(title)}</div>
      ${items.map(i => `<a href="${esc(i.url)}" data-ia="${esc(i.id || i.label)}">
        <span>${esc(i.label)}</span><span class="d">${esc(i.desc || '')}</span></a>`).join('')}
    </div>`);
    wrap.appendChild(panel);

    const toggle = e => {
      e.preventDefault(); e.stopPropagation();
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

  /* §12 — showcase mode is a reviewer's aid: it turns on the case notes that
     say which hypothesis a block is testing. It is off by default, it is
     obviously a demo control, and it never changes what the product does. */
  function mountShowcase() {
    const Fx = window.Features;
    if (!Fx || document.querySelector('.sc-fab')) return;
    const on = Fx.isShowcase();
    if (on) document.body.classList.add('showcase');
    const b = h(`<button type="button" class="sc-fab ${on ? 'on' : ''}" aria-pressed="${on}"
      title="Show the case note under each block — which hypothesis it tests and which metric would judge it">
      <span class="dot"></span><span class="lbl">${on ? 'Case notes on' : 'Case notes'}</span></button>`);
    b.addEventListener('click', () => {
      const next = !document.body.classList.contains('showcase');
      Fx.setShowcase(next);
      document.body.classList.toggle('showcase', next);
      b.classList.toggle('on', next);
      b.setAttribute('aria-pressed', String(next));
      b.querySelector('.lbl').textContent = next ? 'Case notes on' : 'Case notes';
      P()?.track?.('showcase_toggled', { on: next, route: location.pathname });
    });
    document.body.appendChild(b);
  }

  /* The counter next to NEW comes from the registry — a hard-coded 8 in twenty
     files is a promise that goes stale the first time a feature is added. */
  function paintNewCount() {
    const Fx = window.Features;
    const el = document.getElementById('newCount');
    if (Fx && el) el.textContent = String(Fx.strategic().length);
  }

  /* §UI-006 — this was a <span>: unreachable by keyboard, invisible to a
     screen reader as a control, and it did nothing when clicked. It is a
     button now, and it says what it is rather than implying an account
     system that does not exist. */
  function wireSignIn() {
    const b = document.getElementById('signIn');
    if (!b || b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', () => {
      track('sign_in_clicked', { route: location.pathname });
      if (document.querySelector('.signin-note')) return;
      const note = h(`<div class="signin-note" role="status">
        <b>Accounts are not connected here</b>
        <span>This is a case-study prototype. Watchlists, alerts, saved screens, Academy progress
          and your wealth profile are stored in this browser and stay on this device — which is why
          nothing asks you to register before it is useful.</span>
        <button type="button" class="btn btn-quiet">Got it</button></div>`);
      document.body.appendChild(note);
      note.querySelector('button').addEventListener('click', () => note.remove());
      setTimeout(() => note.remove(), 12000);
    });
  }

  function init() {
    buildPanels();
    buildModeSwitch();
    wireSearch();
    wireAvatar();
    mountShowcase();
    paintNewCount();
    wireSignIn();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
    document.addEventListener('ui-mode-changed', repaintPanels);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.PortalNav = { openPalette, repaintPanels, MODES };
})();
