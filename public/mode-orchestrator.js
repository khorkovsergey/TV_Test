/* =========================================================================
   Mode orchestrator (§9).

   The matrix says what a surface opens with. This moves the DOM to match, and
   — the part that actually matters — does it without the visitor losing what
   they were in the middle of.

   Three rules the implementation is built around:

   1. **Move, never clone.** A cloned module loses its listeners, its canvas,
      its scroll position and any state a page controller holds a reference to.
      `appendChild` on an existing node relocates it; that is the whole trick.

   2. **Never `display:none` a module to reposition it.** Twice this week a
      `hidden` attribute lost to an author `display` rule and something stayed
      on screen that the code believed was gone. Placement is expressed by
      where a node *is*, not by a property fighting a stylesheet.

   3. **Capture before, restore after.** Focus, selection range, scroll and the
      active tab are read before the first move and reapplied after the last.
      A mode switch in the middle of typing must not eat the sentence.
   ========================================================================= */

window.ModeOrchestrator = (function () {

  /* `CSS.escape` is not in jsdom and is not in older browsers either, so the
     selector escaping is done here. Ids in this codebase are plain, but a
     lookup that throws would silently skip the restore — and a restore that
     silently does nothing is how a mode switch eats a half-typed sentence. */
  function sel(value) {
    const v = String(value);
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(v);
    return v.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  const adapters = new Map();       // surface -> { capture, reflow, restore }
  const lastComposition = new Map();

  const M = () => window.Modes;
  const S = () => window.ModeSurfaces;
  const mode = () => (window.Portal && window.Portal.mode) ? window.Portal.mode() : 'simple';

  const get = (surface, m) => S() ? S().get(surface, m || mode()) : null;

  /* ------------------------------------------------------------ capture */

  /* What a person would notice losing. Deliberately small: anything larger
     invites the orchestrator to become a state manager, which it must not. */
  function captureFocus(root) {
    const el = document.activeElement;
    if (!el || !root.contains(el)) return null;
    const snap = { id: el.id || null, name: el.getAttribute('name') || null, value: undefined };
    if ('value' in el) {
      snap.value = el.value;
      try {
        snap.selectionStart = el.selectionStart;
        snap.selectionEnd = el.selectionEnd;
      } catch { /* not a text input */ }
    }
    /* An element without an id or a name cannot be found again after a move;
       say so rather than restoring focus to the wrong field. */
    snap.findable = Boolean(snap.id || snap.name);
    return snap;
  }

  function restoreFocus(root, snap) {
    if (!snap || !snap.findable) return false;
    const el = snap.id ? root.querySelector('#' + sel(snap.id))
                       : root.querySelector('[name="' + sel(snap.name) + '"]');
    if (!el) return false;
    try {
      el.focus();
      if (snap.value !== undefined && 'value' in el && el.value !== snap.value) el.value = snap.value;
      if (snap.selectionStart != null && el.setSelectionRange) {
        el.setSelectionRange(snap.selectionStart, snap.selectionEnd);
      }
    } catch { return false; }
    return true;
  }

  /* Form values are captured for every named field, not only the focused one:
     a reflow that moves a fieldset between placements must not empty it. */
  function captureFields(root) {
    const out = [];
    root.querySelectorAll('input, select, textarea').forEach(el => {
      const key = el.id || el.getAttribute('name');
      if (!key) return;
      out.push({
        key,
        value: (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value,
        checkbox: el.type === 'checkbox' || el.type === 'radio'
      });
    });
    return out;
  }

  function restoreFields(root, fields) {
    let restored = 0;
    for (const f of fields) {
      const el = root.querySelector('#' + sel(f.key))
              || root.querySelector('[name="' + sel(f.key) + '"]');
      if (!el) continue;
      if (f.checkbox) el.checked = f.value;
      else if (el.value !== f.value) el.value = f.value;
      restored++;
    }
    return restored;
  }

  function capture(surface, root) {
    const adapter = adapters.get(surface);
    const own = adapter && adapter.capture ? adapter.capture() : null;
    return {
      surface,
      focus: captureFocus(root),
      fields: captureFields(root),
      scrollY: window.scrollY || 0,
      own
    };
  }

  /* ------------------------------------------------------------- reflow */

  /* Modules declare themselves with `data-module-id`; the containers they can
     be moved into declare `data-placement`. A surface that has not opted in
     simply has no containers, and `apply` becomes a no-op — which is how this
     lands page by page instead of all at once. */
  function containersOf(root) {
    const map = {};
    root.querySelectorAll('[data-placement]').forEach(el => {
      map[el.dataset.placement] = el;
    });
    return map;
  }

  function modulesOf(root) {
    const map = new Map();
    root.querySelectorAll('[data-module-id]').forEach(el => {
      if (!map.has(el.dataset.moduleId)) map.set(el.dataset.moduleId, el);
    });
    return map;
  }

  function apply(surface, root, opts) {
    const el = root || document;
    const comp = get(surface);
    if (!comp) return null;

    const containers = containersOf(el);
    const modules = modulesOf(el);
    if (!Object.keys(containers).length || !modules.size) {
      /* Nothing declared on this page yet. Still report the composition so a
         page can read `primaryActions` without adopting the DOM contract. */
      lastComposition.set(surface, comp);
      emit(surface, comp, { moved: 0, adopted: false });
      return comp;
    }

    const snap = (opts && opts.snapshot) || capture(surface, el);
    let moved = 0;

    /* Ordering: append in `moduleOrder`, so each container ends up holding its
       modules in the order the matrix asked for. Appending an existing node
       moves it — no clone, no lost listener. */
    for (const id of comp.moduleOrder) {
      const node = modules.get(id);
      if (!node) continue;
      const placement = comp.modulePlacement[id] || 'secondary';
      const target = containers[placement] || containers.primary || containers.secondary;
      if (!target) continue;
      if (node.parentElement !== target || node.nextElementSibling !== null) {
        target.appendChild(node);
        moved++;
      }
      node.dataset.placement = placement;
    }

    /* A module the matrix did not mention keeps its place rather than being
       dropped somewhere arbitrary. */
    modules.forEach((node, id) => {
      if (!comp.moduleOrder.includes(id)) node.dataset.placement = node.dataset.placement || 'secondary';
    });

    const adapter = adapters.get(surface);
    if (adapter && adapter.reflow) adapter.reflow(comp);

    restoreFields(el, snap.fields);
    restoreFocus(el, snap.focus);
    if (adapter && adapter.restore) adapter.restore(snap.own, comp);
    if (snap.scrollY) window.scrollTo(0, snap.scrollY);

    lastComposition.set(surface, comp);
    emit(surface, comp, { moved, adopted: true });
    return comp;
  }

  function reflow(surface, from, to, root) {
    const el = root || document;
    const snapshot = capture(surface, el);
    const comp = apply(surface, el, { snapshot });
    window.Portal?.track?.('mode_surface_reflow', {
      surface, from, to, objective: comp && comp.objective
    });
    return comp;
  }

  function emit(surface, composition, detail) {
    document.dispatchEvent(new CustomEvent('mode-surface-applied', {
      detail: { surface, mode: mode(), composition, ...detail }
    }));
  }

  /* ---------------------------------------------------------------- api */

  const primaryActions = surface => (get(surface) || {}).primaryActions || [];
  const overflowActions = surface => (get(surface) || {}).overflowActions || [];
  const tabs = surface => {
    const c = get(surface) || {};
    return { primary: c.primaryTabs || [], overflow: c.overflowTabs || [] };
  };
  const formProfile = surface => {
    const c = get(surface);
    return (c && c.formProfile) || (M() ? M().policy(mode()).formProfile : 'grouped');
  };
  const copilotProfile = surface => {
    const c = surface ? get(surface) : null;
    return (c && c.copilotProfile) || (M() ? M().policy(mode()).copilotProfile : 'researcher');
  };
  const objective = surface => (get(surface) || {}).objective || '';

  function registerStateAdapter(surface, adapter) {
    if (!surface || !adapter) return;
    adapters.set(surface, adapter);
  }

  /* Exposed so a test can read what was actually composed rather than
     re-deriving it from the matrix and hoping the page agreed. */
  const composition = surface => lastComposition.get(surface) || get(surface);

  /* One listener, so a page only has to call `apply` once at boot. */
  document.addEventListener('ui-mode-changed', e => {
    const to = mode();
    for (const surface of lastComposition.keys()) {
      reflow(surface, (e.detail && e.detail.from) || null, to);
    }
  });

  return {
    get, apply, reflow, capture,
    primaryActions, overflowActions, tabs, formProfile, copilotProfile, objective,
    registerStateAdapter, composition,
    /* for tests and for a page that wants to restore by hand */
    _captureFocus: captureFocus, _restoreFocus: restoreFocus,
    _captureFields: captureFields, _restoreFields: restoreFields
  };
})();
