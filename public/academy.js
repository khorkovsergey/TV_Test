/* =========================================================================
   Academy — shared state for the hub and the lesson page.

   No backend: the pilot keeps progress in localStorage, as the handoff spec
   requires. Everything here degrades safely — if storage is unavailable the
   pages still render, the learner just starts fresh each visit.
   ========================================================================= */

window.Academy = (function () {

  const K_PROGRESS = 'academy_progress';   // array of completed lesson ids
  const K_MODE     = 'ui_mode';            // 'beginner' | 'standard'
  const K_FIRST    = 'academy_first_visit';// ms, for Time to First Value
  const K_EVENTS   = 'academy_events';     // local ring buffer, inspectable

  /* Storage can throw (private mode, file://) — never let that break a page. */
  const ls = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ------------------------------------------------------------- lessons */

  const LESSONS = [
    { id: 1, title: 'What is trading',      mins: 10, desc: 'no charts, plain words' },
    { id: 2, title: 'Understand assets',    mins: 8,  desc: 'stocks, crypto, FX — on live prices' },
    { id: 3, title: 'Compare instruments',  mins: 6,  desc: 'a task on the live BTC vs ETH chart', interactive: true },
    { id: 4, title: 'Build a watchlist',    mins: 5,  desc: 'your first saved list' },
    { id: 5, title: 'Set an alert',         mins: 5,  desc: 'the platform watches the price for you' },
    { id: 6, title: 'Paper Trading',        mins: 15, desc: 'your first trade with no money at risk' }
  ];

  /* Steps 1-3 are open from the start; 4-6 unlock one by one, each behind the
     previous. That is what the acceptance criteria describe: a new learner sees
     4-6 locked, and finishing step 3 opens step 4. */
  const OPEN_FROM_START = 3;

  const completed = () => ls.get(K_PROGRESS, []);
  const isDone = id => completed().includes(id);

  function isUnlocked(id) {
    if (id <= OPEN_FROM_START) return true;
    return isDone(id - 1);
  }

  /* The step the learner should be on: first unlocked one that is not done. */
  function currentId() {
    for (const l of LESSONS) if (isUnlocked(l.id) && !isDone(l.id)) return l.id;
    return null;   // whole track finished
  }

  function stateOf(id) {
    if (isDone(id)) return 'done';
    if (!isUnlocked(id)) return 'locked';
    return id === currentId() ? 'current' : 'available';
  }

  function complete(id, extra) {
    if (isDone(id)) return false;
    const list = completed();
    list.push(id);
    ls.set(K_PROGRESS, list);
    track('academy_lesson_completed', { lesson_id: id, duration_ms: sinceFirstVisit(), ...(extra || {}) });
    return true;
  }

  function reset() {
    ls.set(K_PROGRESS, []);
    ls.set(K_EVENTS, []);
  }

  /* ---------------------------------------------------------------- mode */

  /* Beginner is the default for a new visitor — the whole point of the
     hypothesis is that complexity should be opt-in, not opt-out.

     The value itself belongs to Portal: the chart workspace, the Copilot and
     this track all have to agree on one mode, and one owner of the key is the
     only way that stays true. The fallback keeps Academy standalone if home.js
     ever fails to load, and tolerates the quoted value older builds wrote. */
  function mode() {
    if (window.Portal?.mode) return window.Portal.mode();
    const raw = ls.get(K_MODE, 'beginner');
    return ['beginner', 'standard', 'pro'].includes(raw) ? raw : 'beginner';
  }

  function setMode(next) {
    const from = mode();
    if (from === next) return;
    if (window.Portal?.setMode) window.Portal.setMode(next, 'pill');   // owns storage + analytics
    else { ls.set(K_MODE, next); track('mode_switch', { from, to: next }); }
    applyMode();
  }

  /* In beginner mode the advanced nav items are hidden. Scoped to Academy
     pages on purpose: the spec requires the other pages to stay untouched. */
  function applyMode() {
    const beginner = mode() === 'beginner';
    document.querySelectorAll('[data-advanced]').forEach(el => { el.hidden = beginner; });
    document.querySelectorAll('[data-mode]').forEach(el =>
      el.classList.toggle('on', el.dataset.mode === mode()));
    document.body.dataset.uiMode = mode();
  }

  /* ----------------------------------------------------------- analytics */

  function sinceFirstVisit() {
    let t0 = ls.get(K_FIRST, null);
    if (!t0) { t0 = Date.now(); ls.set(K_FIRST, t0); }
    return Date.now() - t0;
  }

  /* Pilot-grade: log to the console and keep a local buffer so the events can
     be inspected without a analytics backend. Swap the body for a real sink. */
  function track(event, props) {
    // The home A/B flag rides on every event: without it the Academy funnel
    // cannot be split by the variant the visitor landed on.
    const rec = {
      event, ts: new Date().toISOString(),
      home_variant: window.Portal?.variant?.() || ls.get('home_variant', 'task'),
      ...(props || {})
    };
    // eslint-disable-next-line no-console
    console.log('[analytics]', event, rec);
    const buf = ls.get(K_EVENTS, []);
    buf.push(rec);
    ls.set(K_EVENTS, buf.slice(-200));
    return rec;
  }

  /* Time to First Value: the first genuinely useful action a learner takes. */
  function firstValueAction(type) {
    track('first_value_action', { type, ms_since_first_visit: sinceFirstVisit() });
  }

  const events = () => ls.get(K_EVENTS, []);

  /* ---------------------------------------------------------------- boot */

  function init() {
    sinceFirstVisit();   // stamps the first visit on the very first page load
    applyMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return {
    LESSONS, OPEN_FROM_START,
    completed, isDone, isUnlocked, currentId, stateOf, complete, reset,
    mode, setMode, applyMode,
    track, firstValueAction, events, sinceFirstVisit
  };
})();
