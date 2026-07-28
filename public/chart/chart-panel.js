/* =========================================================================
   Right panel (§4.7, §18).

   Three tabs — Watchlist, Details, Copilot — over one docked column. Selecting
   a candle activates Copilot; it does not destroy the other two, which is the
   specific failure the brief calls out: a panel that resets the watchlist
   every time somebody asks a question teaches them not to ask.

   The panel is docked, not overlaid. The chart is given less width and
   redraws; it is not covered. On a narrow screen the same markup becomes a
   bottom sheet, because a 380px column on a phone is a covered chart with
   extra steps.
   ========================================================================= */

window.ChartPanel = (function () {

  const TABS = ['watchlist', 'details', 'copilot'];
  const MOBILE_MAX = 860;

  function create(opts) {
    const root = opts.root;
    const onResize = opts.onResize || (() => {});
    let active = 'watchlist';
    let open = true;

    const isMobile = () => (window.innerWidth || 1200) <= MOBILE_MAX;

    function paint() {
      root.dataset.tab = active;
      root.dataset.open = open ? 'true' : 'false';
      root.hidden = !open;
      root.querySelectorAll('[data-tab-btn]').forEach(b => {
        const on = b.dataset.tabBtn === active;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      root.querySelectorAll('[data-tab-panel]').forEach(p => {
        p.hidden = p.dataset.tabPanel !== active;
      });
      document.body.dataset.chartPanel = open ? active : 'closed';
      root.classList.toggle('ch-sheet', isMobile());
      onResize();
    }

    function show(tab, why) {
      if (!TABS.includes(tab)) return;
      active = tab;
      open = true;
      paint();
      window.Portal?.track?.('chart_panel_opened', { tab, reason: why || 'user' });
    }

    function toggle() {
      open = !open;
      paint();
    }

    root.addEventListener('click', e => {
      const b = e.target.closest('[data-tab-btn]');
      if (b) return show(b.dataset.tabBtn, 'tab');
      if (e.target.closest('[data-panel-close]')) { open = false; paint(); }
    });

    window.addEventListener('resize', paint);

    return {
      show, toggle, paint,
      isOpen: () => open,
      active: () => active,
      isMobile,
      slot: name => root.querySelector(`[data-tab-panel="${name}"]`)
    };
  }

  return { create, TABS, MOBILE_MAX };
})();
