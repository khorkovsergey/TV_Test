/* =========================================================================
   Form renderer (§27).

   Takes a field list and a profile and lays it out. The layout is the easy
   part; the state invariant is the reason this exists as a module rather
   than as three stylesheets.

   Applying a profile to an existing form NEVER rebuilds it. Fields are moved
   between containers, exactly as `ModeOrchestrator` moves modules, because a
   rebuilt input is an emptied input — and a mode switch that empties the
   field somebody is typing into is the worst thing this whole system could do.
   ========================================================================= */

window.FormRenderer = (function () {

  const P = () => window.FormPolicy;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ------------------------------------------------------------- render */

  /* A field declares itself once:
       { id, label, type, hint, example, optional, advanced, options, value } */
  function field(f, rules) {
    const inline = rules.labelPosition === 'inline';
    const hint = (rules.showExamples && (f.example || f.hint))
      ? `<span class="ff-hint">${esc(f.example ? 'e.g. ' + f.example : f.hint)}</span>` : '';

    const control = f.type === 'select'
      ? `<select id="${esc(f.id)}" name="${esc(f.id)}">${(f.options || [])
          .map(o => `<option value="${esc(o.value)}"${o.value === f.value ? ' selected' : ''}>${esc(o.label)}</option>`)
          .join('')}</select>`
      : f.type === 'textarea'
      ? `<textarea id="${esc(f.id)}" name="${esc(f.id)}" rows="3">${esc(f.value || '')}</textarea>`
      : `<input id="${esc(f.id)}" name="${esc(f.id)}" type="${esc(f.type || 'text')}"
           ${f.value != null ? `value="${esc(f.value)}"` : ''}
           ${f.step ? `step="${esc(f.step)}"` : ''}
           ${rules.showDefaults && f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;

    return `<div class="ff-field${inline ? ' ff-inline' : ''}"
                 data-field-id="${esc(f.id)}"
                 data-optional="${f.optional ? 'true' : 'false'}"
                 data-advanced="${f.advanced ? 'true' : 'false'}">
      <label for="${esc(f.id)}">${esc(f.label)}${f.optional ? ' <span class="ff-opt">optional</span>' : ''}</label>
      ${control}${hint}
    </div>`;
  }

  /* Containers are declared once and never removed, so `apply` always has
     somewhere to move a field to. */
  function render(host, fields, surface) {
    const rules = P().rules(surface);
    host.innerHTML =
      `<div class="ff-form" data-profile="${rules.id}">
         <div class="ff-steps" data-ff="steps"></div>
         <div class="ff-main" data-ff="main">${fields.map(f => field(f, rules)).join('')}</div>
         <details class="ff-fold" data-ff="foldOptional"><summary>Optional details</summary>
           <div data-ff="optional"></div></details>
         <details class="ff-fold" data-ff="foldAdvanced"><summary>Advanced</summary>
           <div data-ff="advanced"></div></details>
       </div>`;
    apply(host, surface);
    return host.querySelector('.ff-form');
  }

  /* -------------------------------------------------------------- apply */

  /* Moves fields between the main body and the two folds according to the
     profile. Called on render and again on every mode change. */
  function apply(host, surface) {
    const form = host.querySelector('.ff-form');
    if (!form) return null;
    const rules = P().rules(surface);

    const main = form.querySelector('[data-ff="main"]');
    const optional = form.querySelector('[data-ff="optional"]');
    const advanced = form.querySelector('[data-ff="advanced"]');
    if (!main) return null;

    /* Capture before touching anything — same discipline as the orchestrator,
       and for the same reason. */
    const active = document.activeElement;
    const activeId = active && form.contains(active) ? active.id : null;
    const selStart = activeId && 'selectionStart' in active ? active.selectionStart : null;
    const selEnd = activeId && 'selectionEnd' in active ? active.selectionEnd : null;

    form.querySelectorAll('[data-field-id]').forEach(el => {
      const isOptional = el.dataset.optional === 'true';
      const isAdvanced = el.dataset.advanced === 'true';
      let target = main;
      if (isAdvanced && rules.foldAdvanced) target = advanced || main;
      else if (isOptional && rules.foldOptional) target = optional || main;
      /* appendChild MOVES the node. The input keeps its value, its listeners
         and its identity; nothing is re-created. */
      if (el.parentElement !== target) target.appendChild(el);
      el.classList.toggle('ff-inline', rules.labelPosition === 'inline');
    });

    form.dataset.profile = rules.id;
    form.dataset.density = rules.density;

    /* An empty fold is a disclosure with nothing behind it — hide the summary
       rather than inviting a click that reveals nothing. */
    for (const [box, key] of [[optional, 'foldOptional'], [advanced, 'foldAdvanced']]) {
      const fold = form.querySelector(`[data-ff="${key}"]`);
      if (!fold) continue;
      const empty = !box || !box.children.length;
      fold.hidden = empty;
      fold.style.display = empty ? 'none' : '';
    }

    applySteps(form, rules);

    if (activeId) {
      const again = form.querySelector('#' + activeId.replace(/([^a-zA-Z0-9_-])/g, '\\$1'));
      if (again) {
        try {
          again.focus();
          if (selStart != null && again.setSelectionRange) again.setSelectionRange(selStart, selEnd);
        } catch { /* not a text control */ }
      }
    }

    form.dispatchEvent(new CustomEvent('form-profile-applied', {
      bubbles: true, detail: { profile: rules.id, surface }
    }));
    return rules;
  }

  /* ------------------------------------------------------------- steps */

  /* The wizard shows one field at a time. Leaving the profile restores every
     field to view — the step is a presentation, and it is never allowed to
     become a filter on what the person can fill in. */
  function applySteps(form, rules) {
    const fields = [...form.querySelectorAll('[data-ff="main"] > [data-field-id]')];
    const bar = form.querySelector('[data-ff="steps"]');

    /* A form may refuse stepping and keep everything else the profile decides.
       Some surfaces are control panels rather than intakes — a screener's
       filters and a Quick Add dialog are compared against each other while
       being set, and showing one at a time would hide the comparison. The
       refusal is per form and explicit; the density and the folds still follow
       the mode. */
    const stepped = rules.stepped && form.dataset.ffStepped !== 'false';

    if (!stepped || fields.length < 2) {
      fields.forEach(f => { f.hidden = false; f.style.display = ''; });
      if (bar) { bar.hidden = true; bar.style.display = 'none'; }
      form.dataset.step = '';
      return;
    }

    let step = Number(form.dataset.step);
    if (!Number.isInteger(step) || step < 0 || step >= fields.length) step = 0;
    form.dataset.step = String(step);

    fields.forEach((f, i) => {
      const on = i === step;
      f.hidden = !on;
      f.style.display = on ? '' : 'none';
    });

    if (bar) {
      bar.hidden = false;
      bar.style.display = '';
      bar.innerHTML =
        `<span class="ff-count">Step ${step + 1} of ${fields.length}</span>
         <button type="button" class="ff-nav" data-ff-step="-1"${step === 0 ? ' disabled' : ''}>Back</button>
         <button type="button" class="ff-nav" data-ff-step="1"${step === fields.length - 1 ? ' disabled' : ''}>Next</button>`;
      if (!bar.dataset.wired) {
        bar.dataset.wired = '1';
        bar.addEventListener('click', e => {
          const b = e.target.closest('[data-ff-step]');
          if (!b) return;
          const now = Number(form.dataset.step) || 0;
          form.dataset.step = String(now + Number(b.dataset.ffStep));
          applySteps(form, window.FormPolicy.rules(form.dataset.profile));
        });
      }
    }
  }

  /* Values, so a caller can read the form without knowing its layout. */
  function values(host) {
    const out = {};
    host.querySelectorAll('[data-field-id] input, [data-field-id] select, [data-field-id] textarea')
      .forEach(el => {
        if (!el.name && !el.id) return;
        out[el.name || el.id] = (el.type === 'checkbox') ? el.checked : el.value;
      });
    return out;
  }

  /* One listener: every rendered form follows the mode without its page
     having to remember to re-apply. */
  document.addEventListener('ui-mode-changed', () => {
    document.querySelectorAll('[data-form-surface]').forEach(host =>
      apply(host, host.dataset.formSurface));
  });

  return { render, apply, values, field };
})();
