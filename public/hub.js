/* =========================================================================
   Section hub — the page behind each of the six doors.

   The nav panel shows six rows; this is where the rest lives. Everything is
   rendered from the IA, so a destination that moves in the map moves here too,
   and the mode changes what is offered FIRST — items above the visitor's level
   are shown below a divider that says what they are, never removed.
   ========================================================================= */

window.Hub = (function () {

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const STATUS = {
    live:   ['LIVE', 'tag-fact', 'works in this prototype'],
    pilot:  ['PILOT', 'tag-warn', 'a deliberate stub: the flow is real, the depth is not'],
    mapped: ['MAPPED', '', 'exists on the real platform; kept in the map, not built here']
  };

  const MODE_LABEL = { simple: 'Simple', standard: 'Standard', pro: 'Pro' };

  function itemRow(i) {
    const [label, cls, title] = STATUS[i.status];
    /* The one-line "what this is" is teaching copy, so it obeys the preset:
       kept in Simple and Standard, gone in Pro, where the name is enough. */
    return `<a href="${esc(i.url)}" data-ia="${esc(i.id)}"
        style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--tv-line);color:var(--tv-text)">
        <span style="font-size:13.5px">${esc(i.label)}${i.level === 'pro' ? ' <span class="mono" style="font-size:9px;color:#B48CFF">PRO</span>' : ''}
          ${i.desc ? `<span data-explain-level="context" style="display:block;font-size:11.5px;color:var(--tv-faint)">${esc(i.desc)}</span>` : ''}</span>
        <span class="tag ${cls}" title="${esc(title)}" ${cls ? '' : 'style="color:var(--tv-ghost);background:var(--tv-ink-2);border:1px solid var(--tv-ink-3)"'}>${label}</span>
      </a>`;
  }

  /* Everything in the section, split by what the current mode puts first.
     Nothing is hidden: the deeper rows sit under a line that names them. */
  function renderShelf(el, section, mode) {
    const order = window.IA.ORDER;
    const max = order[mode] ?? 0;

    el.innerHTML = section.groups.map(g => {
      const now = g.items.filter(i => (order[i.level] ?? 0) <= max);
      const later = g.items.filter(i => (order[i.level] ?? 0) > max);

      /* §7.1 — the deeper rows fold into "Advanced" instead of standing as a
         wall next to the simple ones. Folded, not removed: one click opens it,
         and they stay in the section, the site map and ⌘K regardless. */
      const advanced = later.length ? `
        <details class="advanced">
          <summary>Advanced — ${later.length} more ${later.length === 1 ? 'tool' : 'tools'},
            shown first in ${esc(MODE_LABEL[later[0].level] || '')} mode</summary>
          <div class="body">${later.map(itemRow).join('')}</div>
        </details>` : '';

      return `<div class="tv-card">
        <div class="mono" style="font-size:10px;letter-spacing:.08em;color:#5B8DFF">${esc(g.name.toUpperCase())}</div>
        <div style="display:flex;flex-direction:column;margin-top:10px">${now.map(itemRow).join('')}</div>
        ${advanced}
      </div>`;
    }).join('');
  }

  /* A pilot module: says what it would hold, what it does hold, and what to do
     instead. §26 — an empty state must offer an action, not report absence. */
  function pilotCard({ title, what, actions = [], note }) {
    return `<div class="tv-card">
      <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
        <p class="title" style="margin:0">${esc(title)}</p>
        <span class="tag tag-warn">PILOT</span>
      </div>
      <div data-explain-level="context" style="font-size:13.5px;color:var(--tv-muted);margin-top:6px;line-height:1.5">${what}</div>
      ${actions.length ? `<div class="row mt-16" style="flex-wrap:wrap;gap:8px">${actions.map(a =>
        `<a class="btn ${a.primary ? 'btn-primary' : 'btn-quiet'}" href="${esc(a.url)}" style="padding:9px 16px">${esc(a.label)}</a>`).join('')}</div>` : ''}
      ${note ? `<div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:11px">${esc(note)}</div>` : ''}
    </div>`;
  }

  /* The next logical step, on every screen (§17). */
  function nextStep(el, { label, url, why }) {
    el.innerHTML = `<div class="tv-card accent">
      <div class="mono" style="font-size:10.5px;color:#5B8DFF;letter-spacing:.08em">NEXT LOGICAL STEP</div>
      <div style="font-size:14.5px;font-weight:700;color:var(--tv-white);margin-top:8px">${esc(label)}</div>
      <div style="font-size:12.5px;color:var(--tv-muted);margin-top:6px;line-height:1.5">${esc(why)}</div>
      <a class="btn btn-primary mt-16" href="${esc(url)}" style="padding:9px 16px">Continue →</a>
    </div>`;
  }

  /* ------------------------------------------------------ module presets

     A hub used to render the same modules in all three modes: `fillModules`
     received the mode and every page ignored it, so Standard and Pro were the
     same page with different padding. Modules now declare a complexity once
     and the policy decides where each one lands — open, folded, or behind
     "More in this section". Nothing is ever dropped.

       complexity 1  everyone opens with it
       complexity 2  Simple folds it, Standard and Pro open with it
       complexity 3  Simple puts it behind More, Standard folds it, Pro opens it
  */
  function modules(mode, list) {
    const M = window.Modes;
    const place = m => {
      if (!M) return 'default';
      return M.visibility(m.present || { complexity: m.complexity || 1 }, mode);
    };
    const open = [], folded = [], more = [];
    for (const m of list) {
      if (!m || !m.html) continue;
      const v = place(m);
      (v === 'always' || v === 'default' ? open : v === 'collapsed' ? folded : more).push(m);
    }

    const fold = (items, summary, cls) => items.length ? `
      <details class="advanced ${cls}">
        <summary>${esc(summary(items))}</summary>
        <div class="body"><div class="stubs">${items.map(i => i.html).join('')}</div></div>
      </details>` : '';

    return `<div class="stubs">${open.map(m => m.html).join('')}</div>
      ${fold(folded, i => `Deeper analysis — ${i.length} more ${i.length === 1 ? 'module' : 'modules'}, open by default in Pro`, 'fold-deep')}
      ${fold(more, i => `More in this section — ${i.length} advanced ${i.length === 1 ? 'module' : 'modules'}`, 'fold-more')}`;
  }

  /* The "how to read this section" paragraph: the guided preset keeps it, the
     others do not. Without it a hub had identical prose in Simple and
     Standard, which made `explanationDepth` a field nothing acted on. */
  const INTRO = {
    overview:  'Start here when you do not yet know what you are looking for. The brief names the three biggest moves and why they happened; the events below say what is scheduled and which instruments it has touched before.',
    research:  'This is where a question becomes an answer. Find an instrument, study what it is doing, then check the idea against history before believing it — the three groups below are those three steps, in order.',
    capital:   'Watching, money and goals in one place. Start with a watchlist even if you own nothing: it is what turns a market page into your market page.',
    trade:     'Practice comes before money here on purpose. Paper trading, replay and a decision journal cost attention rather than capital, and they are where a rule proves itself.',
    learn:     'Six guided lessons on live data, and the vocabulary you need to read everything else. Nothing here assumes you have traded before.',
    community: 'Other people’s ideas, labelled: who wrote it, what type of claim it is, and what their record looks like. An opinion is useful once you can see where it comes from.'
  };

  function paintIntro(section, mode) {
    let el = document.getElementById('hubIntro');
    if (!el) {
      const anchor = document.getElementById('modules') || document.getElementById('shelf');
      if (!anchor || !INTRO[section.id]) return;
      el = document.createElement('div');
      el.id = 'hubIntro';
      el.dataset.explainLevel = 'deep';
      el.style.cssText = 'font-size:13.5px;color:var(--tv-muted);line-height:1.6;max-width:70ch;margin-top:14px';
      anchor.parentNode.insertBefore(el, anchor);
    }
    el.textContent = INTRO[section.id] || '';
    window.Portal?.applyExplain?.(window.Modes?.policy(mode).explanationDepth);
  }

  function mount(sectionId, fillModules) {
    const IA = window.IA, P = window.Portal;
    const section = IA.bySection(sectionId);
    if (!section) return;

    const shelf = document.getElementById('shelf');
    const modules = document.getElementById('modules');

    const paint = () => {
      const mode = P?.mode?.() || 'simple';
      if (shelf) renderShelf(shelf, section, mode);
      paintIntro(section, mode);
      const badge = document.getElementById('modeBadge');
      if (badge) badge.textContent = (MODE_LABEL[mode] || mode) + ' mode';
      if (modules && fillModules) modules.innerHTML = fillModules(mode);
      /* Freshly rendered copy has not been through the explanation layer yet. */
      P?.applyExplain?.(window.Modes?.policy(mode).explanationDepth);
    };

    paint();
    document.addEventListener('ui-mode-changed', paint);

    document.addEventListener('click', e => {
      const a = e.target.closest('#shelf a[data-ia]');
      if (a) {
        P?.track?.('section_item_opened', { section: sectionId, item: a.dataset.ia });
        P?.meaningful?.('section_item', { section: sectionId });
      }
    });

    P?.track?.('section_opened', { section: sectionId, mode: P?.mode?.() });
    return { paint, section };
  }

  return { mount, renderShelf, pilotCard, nextStep, itemRow, modules, esc };
})();
