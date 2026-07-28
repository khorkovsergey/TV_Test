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

  /* --------------------------------------------- progressive complexity */

  const K_MODE     = 'ui_mode';           // shared with Academy and the Copilot
  const K_DENSITY  = 'chart_density';
  const K_FEATURES = 'features_used';

  /* The mode model itself lives in modes.js — one policy, three presets.
     Portal keeps the verbs (mode / setMode / allows) because every page
     already calls them, but it no longer owns a second copy of the rules. */
  const M = () => window.Modes;
  const MODES = ['simple', 'standard', 'pro'];
  const ORDER = { simple: 0, standard: 1, pro: 2 };

  const canonical = v => (M() ? M().migrate(v) : null);

  function mode() {
    if (M()) return M().current();
    let v; try { v = localStorage.getItem(K_MODE); } catch { v = null; }
    v = typeof v === 'string' ? v.replace(/^"|"$/g, '') : null;
    return MODES.includes(v) ? v : 'simple';
  }

  function setMode(input, source) {
    const next = canonical(input);
    if (!next) return mode();
    const from = mode();
    if (M()) M().savePrefs({ mode: next, source: source || 'manual', selectedAt: new Date().toISOString() });
    else { try { localStorage.setItem(K_MODE, next); } catch {} }
    applyBodyMode();
    if (from !== next) {
      const props = { from, to: next, mode: next, source: source || 'pill',
                      route: location.pathname, policy: M()?.policy(next).density };
      track('mode_switch', props);
      track('mode_changed', props);
      // Mirrored so the Academy funnel sees the same switch it always has.
      if (window.Academy?.track) window.Academy.track('mode_switch', props);
    }
    return next;
  }

  const allows = (m, min) => (ORDER[m] ?? 0) >= (ORDER[min] ?? 0);

  /* The policy for the current mode, so a page asks "how dense, how many
     primary actions, how much explanation" instead of testing for a string. */
  const policy = m => (M() ? M().policy(m || mode()) : { id: mode(), maxPrimaryActions: 3, density: 'comfortable' });

  function density() {
    let v;
    try { v = Number(localStorage.getItem(K_DENSITY)); } catch { v = NaN; }
    return v >= 1 && v <= 3 ? v : 2;
  }
  function setDensity(n) {
    const v = Math.min(3, Math.max(1, Number(n) || 2));
    try { localStorage.setItem(K_DENSITY, String(v)); } catch {}
    return v;
  }

  /* First use of a progressive feature, once per feature per browser: the
     hypothesis is about discovery, so the second click carries no information. */
  function featureFirstUse(feature) {
    const used = ls.get(K_FEATURES, []);
    if (used.includes(feature)) return false;
    used.push(feature);
    ls.set(K_FEATURES, used);
    track('feature_first_use', { feature, mode: mode() });
    return true;
  }

  /* --------------------------------------------------------------- journey */

  const K_JOURNEY = 'research_journey';        // labels only — the Copilot reads this
  const K_JMETA   = 'research_journey_meta';   // structured twin for the rule map

  /* The graph from the spec. Recommendations follow it rather than popularity:
     what you looked at decides what is worth looking at next. */
  const RULES = {
    symbol:    [{ rule: 'peers',        to: 'peers',       label: 'Peers: BTC vs ETH vs SOL' },
                { rule: 'next_event',   to: 'event',       label: 'Next event: FOMC' }],
    peers:     [{ rule: 'sector',       to: 'sector',      label: 'Sector: crypto heatmap' }],
    sector:    [{ rule: 'etf',          to: 'etf',         label: 'ETFs holding BTC' }],
    etf:       [{ rule: 'next_event',   to: 'event',       label: 'Next event: FOMC' }],
    economy:   [{ rule: 'affected',     to: 'symbol',      label: 'Instruments this touches' }],
    news:      [{ rule: 'related',      to: 'symbol',      label: 'Related assets' }],
    market:    [{ rule: 'reasons',      to: 'symbol',      label: 'Reasons for the move' }],
    portfolio: [{ rule: 'holdings',     to: 'event',       label: 'Events touching holdings' }],
    chart:     [{ rule: 'range_news',   to: 'news',        label: 'News of the selected range' }],
    event:     [{ rule: 'affected',     to: 'symbol',      label: 'Instruments this touches' }]
  };

  const journey = () => ls.get(K_JOURNEY, []);
  const journeyMeta = () => ls.get(K_JMETA, []);

  /* One step of research. The label list stays a plain array of strings because
     the Copilot sends it to the model as context; the structured twin is what
     drives the recommendation. */
  function pushJourney(step) {
    const label = String(step.label || step.to || '').slice(0, 60);
    if (!label) return null;

    const labels = journey();
    labels.push(label);
    ls.set(K_JOURNEY, labels.slice(-20));

    const meta = journeyMeta();
    meta.push({ label, kind: step.to || 'symbol', rule: step.rule || null, ts: new Date().toISOString() });
    ls.set(K_JMETA, meta.slice(-20));

    track('journey_step', { from: step.from || lastKind(), to: step.to || null, rule: step.rule || null, label });
    meaningful('journey_step', { rule: step.rule || null });
    return label;
  }

  function lastKind() {
    const meta = journeyMeta();
    return meta.length ? meta[meta.length - 1].kind : null;
  }

  /* What to offer next, given where the visitor just was. */
  function suggestNext(fromKind) {
    const kind = fromKind || lastKind() || 'symbol';
    const options = RULES[kind] || RULES.symbol;
    const seen = new Set(journeyMeta().map(m => m.rule));
    return options.find(o => !seen.has(o.rule)) || options[0];
  }

  /* ---------------------------------------------------------------- boot */

  /* The bounce metric is about the home page, so it only arms there — the file
     itself is loaded everywhere so that the variant flag and the Copilot hook
     are available on every screen. */
  const isHome = () => {
    const p = location.pathname;
    return p === '/' || p.endsWith('/index.html') || p.endsWith('/classic.html');
  };

  /* The mode has to be on <body> before anything is painted: the density rules
     in portal.css hang off it, so a page without its own mode script still
     changes when the visitor switches. */
  function applyBodyMode() {
    if (!document.body) return;
    const m = mode();
    document.body.dataset.uiMode = m;
    /* Density and explanation depth are the preset's own properties, so they
       belong on <body> too — a page then styles by policy instead of writing
       its own "if simple" rule in CSS. */
    const p = policy(m);
    document.body.dataset.density = p.density;
    document.body.dataset.explain = p.explanationDepth;
    applyExplain(p.explanationDepth);
  }

  /* The explanation layer, applied rather than merely declared.

     It started as two CSS rules, which meant a page could claim an explanation
     depth while every mode carried exactly the same words — the stylesheet was
     the only thing that knew, and nothing could check it. Now the depth is
     applied to the elements themselves, so it survives a missing stylesheet
     and can be asserted.

     What this never touches: trust labels, sources, timestamps, delays and
     disclaimers. Those carry no data-explain-level and stay in every mode. */
  const DEPTH = { guided: 2, contextual: 1, minimal: 0 };
  const LEVEL = { context: 1, deep: 2 };

  function applyExplain(depth) {
    const budget = DEPTH[depth] ?? 2;
    document.querySelectorAll('[data-explain-level]').forEach(el => {
      const need = LEVEL[el.dataset.explainLevel] ?? 1;
      el.hidden = need > budget;
    });
  }

  function init() {
    variant();          // mirrors the cookie on the very first paint
    applyBodyMode();
    wireRoutes();
    if (isHome()) armBounce();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    variant, track, events, meaningful, observe,
    watchlist, toggleSymbol, saveWatchlist, registerClick,
    mode, setMode, allows, policy, applyBodyMode, applyExplain, MODES, ORDER,
    density, setDensity, featureFirstUse,
    journey, journeyMeta, pushJourney, suggestNext, lastKind, RULES,
    BOUNCE_MS
  };
})();
