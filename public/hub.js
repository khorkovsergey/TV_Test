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
    return `<a href="${esc(i.url)}" data-ia="${esc(i.id)}"
        style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--tv-line);color:var(--tv-text)">
        <span style="font-size:13.5px">${esc(i.label)}${i.level === 'pro' ? ' <span class="mono" style="font-size:9px;color:#B48CFF">PRO</span>' : ''}
          ${i.desc ? `<span style="display:block;font-size:11.5px;color:var(--tv-faint)">${esc(i.desc)}</span>` : ''}</span>
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
      return `<div class="tv-card">
        <div class="mono" style="font-size:10px;letter-spacing:.08em;color:#5B8DFF">${esc(g.name.toUpperCase())}</div>
        <div style="display:flex;flex-direction:column;margin-top:10px">
          ${now.map(itemRow).join('')}
          ${later.length ? `<div class="mono" style="font-size:10px;color:var(--tv-ghost);margin-top:12px;padding-top:10px;border-top:1px dashed var(--tv-ink-3)">
              DEEPER — SHOWN FIRST IN ${esc((MODE_LABEL[later[0].level] || '').toUpperCase())} MODE, REACHABLE NOW
            </div>${later.map(itemRow).join('')}` : ''}
        </div>
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
      <div style="font-size:13.5px;color:var(--tv-muted);margin-top:6px;line-height:1.5">${what}</div>
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

  function mount(sectionId, fillModules) {
    const IA = window.IA, P = window.Portal;
    const section = IA.bySection(sectionId);
    if (!section) return;

    const shelf = document.getElementById('shelf');
    const modules = document.getElementById('modules');

    const paint = () => {
      const mode = P?.mode?.() || 'simple';
      if (shelf) renderShelf(shelf, section, mode);
      const badge = document.getElementById('modeBadge');
      if (badge) badge.textContent = (MODE_LABEL[mode] || mode) + ' mode';
      if (modules && fillModules) modules.innerHTML = fillModules(mode);
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

  return { mount, renderShelf, pilotCard, nextStep, itemRow, esc };
})();
