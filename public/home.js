/* =========================================================================
   Task-based home — A/B assignment, task routes, watchlist stub, analytics.

   The hypothesis is that a home built around user tasks beats a promo home,
   so this file exists to make the comparison measurable: every event carries
   the variant the visitor was served, and the five metrics named in the
   handoff spec fire from here.

   No backend: the pilot keeps the watchlist and the event buffer in
   localStorage. Everything degrades safely — if storage throws (private mode,
   file://) the page still works, the visitor just starts fresh.
   ========================================================================= */

window.Portal = (function () {

  const K_EVENTS  = 'portal_events';     // local ring buffer, inspectable
  const K_WATCH   = 'watchlist';         // shared with the Copilot widget
  const K_VARIANT = 'home_variant';      // mirrored from the cookie the server sets
  const S_ACTIONS = 'portal_actions';    // meaningful actions in this session

  const BOUNCE_MS = 30_000;              // "no interaction within 30s" per spec

  /* -------------------------------------------------------------- storage */

  const ls = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const ss = {
    get(k, fallback) {
      try { const v = sessionStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  function cookie(name) {
    const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ------------------------------------------------------------------ A/B */

  /* The server assigns the variant and serves the matching page; the cookie is
     the source of truth. Mirroring it into localStorage lets the other scripts
     (Academy, Copilot) stamp the same flag without re-reading cookies. */
  function variant() {
    const c = cookie('home_variant');
    if (c === 'task' || c === 'classic') { ls.set(K_VARIANT, c); return c; }
    return ls.get(K_VARIANT, 'task');
  }

  /* ------------------------------------------------------------ analytics */

  const landedAt = Date.now();

  /* Pilot-grade sink: console + a local buffer, so events can be inspected
     without an analytics backend. Swap the body for a real one. */
  function track(event, props) {
    const rec = {
      event, ts: new Date().toISOString(),
      home_variant: variant(),
      ...(props || {})
    };
    console.log('[analytics]', event, rec);
    const buf = ls.get(K_EVENTS, []);
    buf.push(rec);
    ls.set(K_EVENTS, buf.slice(-200));
    return rec;
  }

  const events = () => ls.get(K_EVENTS, []);

  /* ------------------------------------------- meaningful actions & bounce */

  let bounceTimer = null;
  let bounced = false;

  const actionCount = () => ss.get(S_ACTIONS, 0);

  /* One funnel in one place: the first meaningful action gives Time to First
     Meaningful Action, the second gives the Portal Meaningful Continuation
     Rate, and any of them cancels the bounce timer. */
  function meaningful(type, extra) {
    const n = actionCount() + 1;
    ss.set(S_ACTIONS, n);

    if (n === 1) {
      track('first_meaningful_action', { type, ms_since_landing: Date.now() - landedAt, ...(extra || {}) });
    } else if (n === 2) {
      track('continuation', { type, actions: n, ...(extra || {}) });
    }

    if (bounceTimer) { clearTimeout(bounceTimer); bounceTimer = null; }
    bounced = true;      // an engaged visit can no longer be counted as a bounce
  }

  /* Observed from other widgets (Copilot) without logging the event twice. */
  function observe(event) {
    if (event === 'copilot_message_sent') meaningful('copilot_question');
    if (event === 'copilot_action_completed') meaningful('copilot_action');
  }

  function armBounce() {
    bounceTimer = setTimeout(() => {
      if (actionCount() > 0) return;
      bounced = true;
      track('home_bounce', { reason: 'no_interaction_30s', ms: BOUNCE_MS });
    }, BOUNCE_MS);

    // Single-page exit: leaving without ever doing something meaningful.
    window.addEventListener('pagehide', () => {
      if (bounced || actionCount() > 0) return;
      bounced = true;
      track('home_bounce', { reason: 'exit_without_action', ms: Date.now() - landedAt });
    });
  }

  /* -------------------------------------------------------------- routes */

  /* Every task route reports its id — this CTR is the primary metric of the
     hypothesis, so the click is logged before the browser follows the link. */
  function wireRoutes() {
    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.route;
        track('route_click', { route_id: id, label: (el.querySelector('h3')?.textContent || '').trim() });
        meaningful('route_click', { route_id: id });
      });
    });
  }

  /* ------------------------------------------------------------ watchlist */

  const watchlist = () => ls.get(K_WATCH, []);

  function toggleSymbol(symbol) {
    const list = watchlist();
    const i = list.indexOf(symbol);
    if (i === -1) list.push(symbol); else list.splice(i, 1);
    ls.set(K_WATCH, list);
    return list;
  }

  /* Saving is the value action the conversion prompt is allowed to follow —
     the spec forbids asking for a registration before the value exists. */
  function saveWatchlist(source) {
    const list = watchlist();
    if (!list.length) return null;
    track('watchlist_created', { symbols: list, count: list.length, source: source || 'home' });
    meaningful('watchlist_saved', { count: list.length });
    return list;
  }

  function registerClick(source) {
    track('value_cta_register_click', { source: source || 'watchlist', watchlist: watchlist().length });
    meaningful('register_intent');
  }

  /* ---------------------------------------------------------------- boot */

  /* The bounce metric is about the home page, so it only arms there — the file
     itself is loaded everywhere so that the variant flag and the Copilot hook
     are available on every screen. */
  const isHome = () => {
    const p = location.pathname;
    return p === '/' || p.endsWith('/index.html') || p.endsWith('/classic.html');
  };

  function init() {
    variant();          // mirrors the cookie on the very first paint
    wireRoutes();
    if (isHome()) armBounce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    variant, track, events, meaningful, observe,
    watchlist, toggleSymbol, saveWatchlist, registerClick,
    BOUNCE_MS
  };
})();
