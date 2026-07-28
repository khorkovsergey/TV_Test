/* =========================================================================
   Toolbar maturity (§4.3).

   The reference workspace has a dozen controls across the top. Not all of them
   can work on a case-study stand, and the rule the brief sets is the right
   one: an active-looking button that does nothing is worse than a button that
   says it does nothing. Every control declares one of three states and the
   page cannot render a fourth.

     functional  it does the thing
     prototype   it opens, and says what it would do
     disabled    it is visibly unavailable and explains why

   Nothing here reads `mode`. What the mode controls is which controls appear,
   and that is the page's decision, not this module's.
   ========================================================================= */

window.ChartToolbar = (function () {

  const MATURITY = ['functional', 'prototype', 'disabled'];

  const NOTE = {
    prototype: 'Prototype control — it demonstrates the workflow and computes nothing.',
    disabled: 'Not available on this stand.'
  };

  function decorate(root) {
    root.querySelectorAll('[data-maturity]').forEach(btn => {
      const m = MATURITY.includes(btn.dataset.maturity) ? btn.dataset.maturity : 'disabled';
      btn.classList.add('ch-tb-' + m);
      if (m === 'disabled') {
        btn.setAttribute('aria-disabled', 'true');
        btn.disabled = true;
        if (!btn.title) btn.title = NOTE.disabled;
      } else if (m === 'prototype' && !btn.title) {
        btn.title = NOTE.prototype;
      }
    });
  }

  /* A prototype control has to answer for itself. One line, in place, naming
     what it would do — not a modal, and not silence. */
  function explain(btn, hostEl) {
    const label = (btn.dataset.label || btn.textContent || 'This control').trim();
    const says = btn.dataset.would || 'is part of the workspace this case study models';
    if (!hostEl) return;
    hostEl.hidden = false;
    hostEl.textContent = `${label} ${says}. ${NOTE.prototype}`;
    window.Portal?.track?.('chart_prototype_control_opened', { control: btn.dataset.feature || label });
  }

  function wire(root, hostEl) {
    decorate(root);
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-maturity]');
      if (!btn) return;
      if (btn.dataset.maturity === 'prototype') explain(btn, hostEl);
      else if (hostEl && btn.dataset.maturity === 'functional') hostEl.hidden = true;
    });
  }

  return { MATURITY, decorate, explain, wire, NOTE };
})();
