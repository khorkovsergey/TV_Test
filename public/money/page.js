/* =========================================================================
   My Money — the page controller.

   Extracted rather than inlined (§14.3): the old wealth.html carried 613
   lines and 81 inline styles in the document, which could not be tested and
   could not be reused.

   The whole screen answers five questions and nothing else:
     what came in · what went out · what is left · what am I saving for ·
     what should I do next.
   ========================================================================= */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const S = window.MoneyStore, M = window.MoneyModel, P = window.Portal;
  if (!S || !M) return;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Currency comes from the profile and is never converted silently. */
  const cur = () => S.state().profile.primaryCurrency || 'USD';
  const money = n => {
    const v = Number(n) || 0;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur(), maximumFractionDigits: 0 }).format(v);
    } catch { return v.toFixed(0) + ' ' + cur(); }
  };
  const monthName = key => {
    const [y, m] = String(key).split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const month = () => M.thisMonth();

  /* ------------------------------------------------------------ onboarding

     §11 — the first question is about the person's habit, not their holdings.
     Asking "what is invested in markets right now" as step one is what told
     a non-investor the product was not for them. */
  const CHOICES = [
    { id: 'track',    label: 'Track income and spending', desc: 'I write it in a notebook, or nowhere at all', path: 'track' },
    { id: 'where',    label: 'Understand where my money goes', desc: 'I earn enough but the month still ends empty', path: 'track' },
    { id: 'goal',     label: 'Save for a goal', desc: 'Something specific I want to reach', path: 'goal' },
    { id: 'buffer',   label: 'Build a financial buffer', desc: 'So one bad month does not undo everything', path: 'goal' },
    { id: 'savings',  label: 'Organise savings and deposits', desc: 'I have money set aside in a few places', path: 'savings' },
    { id: 'investor', label: 'Review my investments', desc: 'I already hold instruments', path: 'investor' }
  ];

  /* §12 — the preset changes what is offered FIRST, not what exists. Somebody
     in Pro already holds instruments and does not need "I write it in a
     notebook" at the top; somebody in Simple does, and should not have to
     scroll past a portfolio review to find it. All six stay, in every mode. */
  const ORDER_BY_MODE = {
    simple:   ['track', 'where', 'buffer', 'goal', 'savings', 'investor'],
    standard: ['track', 'where', 'goal', 'buffer', 'savings', 'investor'],
    pro:      ['investor', 'savings', 'goal', 'buffer', 'where', 'track']
  };

  function orderedChoices() {
    const mode = P?.mode?.() || 'simple';
    const order = ORDER_BY_MODE[mode] || ORDER_BY_MODE.simple;
    return order.map(id => CHOICES.find(c => c.id === id)).filter(Boolean);
  }

  function paintOnboarding() {
    $('onboardChoices').innerHTML = orderedChoices().map(c => `
      <button type="button" class="tv-card" data-choice="${c.id}"
        style="text-align:left;cursor:pointer;border-color:var(--tv-line);background:var(--tv-ink)">
        <p class="title" style="margin:0">${esc(c.label)}</p>
        <div style="font-size:12.5px;color:var(--tv-muted);margin-top:6px;line-height:1.5">${esc(c.desc)}</div>
      </button>`).join('');

    /* Pro leads with import; the same actions live in the Data menu for
       everyone, so nothing is exclusive to a preset. */
    const proBox = $('proImport');
    if (proBox) proBox.hidden = (P?.mode?.() !== 'pro');

    const preview = S.legacyPreview();
    if (preview) {
      $('legacyCard').hidden = false;
      const rows = preview.accounts.map(a => `${esc(a.name)} — ${money(a.amount)}`).join('<br>');
      $('legacyPreview').innerHTML =
        `It would become ${preview.accounts.length} account${preview.accounts.length === 1 ? '' : 's'}` +
        (preview.goal ? ' and one goal' : '') + ':<br>' + (rows || '—') +
        (preview.goal ? `<br>Goal: ${esc(preview.goal.name)} — ${money(preview.goal.amount)}` : '');
    }
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-choice]');
    if (!b) return;
    const choice = CHOICES.find(c => c.id === b.dataset.choice);
    S.setProfile({ onboardingPath: choice.path, onboardingChoice: choice.id });
    P?.track?.('money_onboarding_selected', { choice: choice.id, path: choice.path });
    render();
    /* Straight into the useful action — the 60-second promise (§1). */
    if (choice.path === 'track') openQuickAdd('income');
    if (choice.path === 'goal') openGoal(choice.id === 'buffer' ? 'emergency' : 'purchase');
  });

  $('proSample')?.addEventListener('click', () => { S.loadSample(); render(); });
  $('proSkip')?.addEventListener('click', () => { $('proImport').hidden = true; });
  $('importLegacy')?.addEventListener('click', () => { S.importLegacy(); render(); });
  $('skipLegacy')?.addEventListener('click', () => { $('legacyCard').hidden = true; });

  /* ------------------------------------------------------------- dashboard */

  function paintTotals() {
    const t = S.transactions(), m = month();
    const income = M.monthlyIncome(t, m);
    const expenses = M.monthlyExpenses(t, m);
    const flow = income - expenses;
    const upcoming = S.recurring().filter(r => r.active).reduce((n, r) => n + r.amount, 0);

    $('monthTitle').textContent = monthName(m);
    $('totals').innerHTML = [
      ['Came in', money(income)],
      ['Went out', money(expenses)],
      ['Left this month', money(flow)],
      ['Repeats monthly', upcoming ? money(upcoming) : '—']
    ].map(([k, v]) => `<div class="st"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  }

  function paintCategories() {
    const rows = M.byCategory(S.transactions(), month(), 'expense');
    const total = rows.reduce((n, r) => n + r.total, 0);
    const box = $('categories');
    if (!rows.length) {
      box.innerHTML = `<div style="font-size:13px;color:var(--tv-muted)">Nothing recorded this month yet.
        Two or three entries are enough to see a shape.</div>`;
      $('catNote').textContent = '';
      return;
    }
    $('catNote').textContent = `${rows.length} categor${rows.length === 1 ? 'y' : 'ies'} · essential vs flexible`;
    box.innerHTML = rows.slice(0, 8).map(r => {
      const pct = total ? (r.total / total) * 100 : 0;
      const colour = r.group === 'essential' ? '#5B8DFF' : 'var(--tv-orange)';
      return `<div style="padding:7px 0;border-bottom:1px solid var(--tv-line)">
        <div class="row" style="justify-content:space-between;gap:10px">
          <span style="font-size:13.5px">${esc(r.name)}
            <span class="mono" style="font-size:9.5px;color:${colour};margin-left:6px">${r.group.toUpperCase()}</span></span>
          <span class="mono" style="color:var(--tv-white)">${money(r.total)}</span>
        </div>
        <div style="height:3px;border-radius:2px;background:var(--tv-ink-2);margin-top:6px">
          <div style="height:3px;border-radius:2px;width:${pct.toFixed(0)}%;background:${colour}"></div>
        </div></div>`;
    }).join('') +
    `<div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:10px">
       essential is what you cannot easily change · flexible is where a decision is possible</div>`;
  }

  function paintRecent() {
    const list = S.transactions().slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const box = $('recent');
    if (!list.length) {
      box.innerHTML = `<div style="font-size:13px;color:var(--tv-muted)">No transactions yet.</div>`;
      return;
    }
    box.innerHTML = list.map(t => {
      const c = M.categoryById(t.categoryId);
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '→';
      const colour = t.type === 'income' ? 'var(--tv-green)' : 'var(--tv-text)';
      return `<div class="mover-row">
        <span class="s" style="flex:0 0 auto">${esc(t.date.slice(5))}</span>
        <span style="flex:1;font-size:12.5px;color:var(--tv-muted);overflow:hidden;text-overflow:ellipsis">
          ${esc(c?.name || 'Other')}${t.note ? ' · ' + esc(t.note) : ''}</span>
        <span class="mono" style="color:${colour}">${sign}${money(t.amount)}</span>
        <button type="button" class="preset" data-drop-tx="${esc(t.id)}" style="padding:3px 9px;font-size:10.5px">remove</button>
      </div>`;
    }).join('');
  }

  function paintGoals() {
    const goals = S.goals();
    const box = $('goals');
    if (!goals.length) {
      box.innerHTML = `<div style="font-size:13px;color:var(--tv-muted)">No goal yet. A goal with a
        monthly amount is a plan; without one it is a wish.</div>`;
      return;
    }
    box.innerHTML = goals.map(g => {
      const pr = M.goalProjection(g);
      const pct = pr.progress == null ? 0 : pr.progress;
      const line = pr.insufficient
        ? 'No monthly amount set — nothing to project from yet.'
        : pr.monthsNeeded === 0 ? 'Reached.'
        : `${pr.monthsNeeded} month${pr.monthsNeeded === 1 ? '' : 's'} at ${money(g.monthlyContribution)} a month` +
          (pr.assumedAnnualReturn ? ` · assumes ${pr.assumedAnnualReturn}% a year` : ' · no growth assumed');
      return `<div style="padding:8px 0;border-bottom:1px solid var(--tv-line)">
        <div class="row" style="justify-content:space-between;gap:10px">
          <span style="font-size:13.5px;color:var(--tv-white)">${esc(g.name)}</span>
          <span class="mono" style="font-size:12px">${money(g.currentAmount)} / ${money(g.targetAmount)}</span>
        </div>
        <div style="height:3px;border-radius:2px;background:var(--tv-ink-2);margin-top:6px">
          <div style="height:3px;border-radius:2px;width:${pct.toFixed(0)}%;background:var(--tv-green)"></div></div>
        <div style="font-size:11.5px;color:var(--tv-faint);margin-top:5px">${esc(line)}</div>
      </div>`;
    }).join('');
  }

  function paintSafety() {
    const t = S.transactions(), m = month();
    const essential = M.essentialExpenses(t, m);
    const liquid = M.liquidAssets(S.accounts(), t);
    const months = M.emergencyFundMonths(liquid, essential);
    const debts = S.liabilities();
    const debtMonthly = debts.reduce((n, d) => n + (d.monthlyPayment || 0), 0);
    const share = M.debtPaymentShare(debtMonthly, M.monthlyIncome(t, m));

    const bits = [];
    bits.push(months == null
      ? 'Record a month of essential spending and your buffer can be measured against it. Until then there is nothing honest to compare.'
      : `Your buffer covers approximately <b style="color:var(--tv-white)">${months.toFixed(1)} month${months >= 2 ? 's' : ''}</b> of essential spending. You choose the target — this prototype does not hand out a universal rule.`);
    if (debts.length) {
      bits.push(`Debt payments: ${money(debtMonthly)} a month` +
        (share == null ? '' : ` — ${share.toFixed(0)}% of what came in`) + '.');
    }
    $('safety').innerHTML = bits.join('<br><br>') +
      `<div class="row mt-16" style="gap:8px;flex-wrap:wrap">
         <a class="btn btn-quiet" href="/money/safety" style="padding:7px 14px;font-size:12.5px">Reserve, debts and tax</a>
       </div>`;
  }

  function paintNextStep() {
    const step = S.nextStep();
    $('nextStepCard').innerHTML = `
      <div class="mono" style="font-size:10.5px;color:#5B8DFF;letter-spacing:.08em">NEXT USEFUL STEP</div>
      <div style="font-size:14.5px;font-weight:700;color:var(--tv-white);margin-top:8px">${esc(step.label)}</div>
      ${step.why ? `<div style="font-size:12.5px;color:var(--tv-muted);margin-top:6px;line-height:1.5">${esc(step.why)}</div>` : ''}
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" data-step="${esc(step.action)}"
          ${step.route ? `data-route-to="${esc(step.route)}"` : ''} style="padding:9px 16px">Do it</button>
      </div>
      <div class="mono" style="font-size:10px;color:var(--tv-ghost);margin-top:10px">
        stage: ${esc(step.stage)} · the market is not the next step until the stage before it is done</div>`;
  }

  /* §12 — one data store, three compositions. Simple opens with the month,
     the ledger and one next step; Standard adds planning; Pro adds the
     structural view. Nothing is removed at any level — the deeper cards fold
     into a disclosure, and the mode never touches the numbers. */
  function applyMode() {
    const mode = P?.mode?.() || 'simple';
    const policy = window.Modes?.policy(mode);
    const deep = { categories: 1, safety: 2, netWorth: 3 };
    const order = { simple: 0, standard: 1, pro: 2 };

    const cards = [
      ['categoriesCard', 1],
      ['safetyCard', 2]
    ];
    for (const [id, complexity] of cards) {
      const el = $(id);
      if (!el) continue;
      const open = complexity <= (order[mode] ?? 0) + 1;
      el.classList.toggle('folded-card', !open);
      el.dataset.complexity = String(complexity);
    }

    /* The teaching copy follows the preset the same way it does everywhere
       else — guided keeps it, minimal drops it. */
    P?.applyExplain?.(policy?.explanationDepth);
    document.body.dataset.moneyMode = mode;
  }

  function render() {
    const started = S.hasData() || S.state().profile.onboardingPath;
    $('onboard').hidden = Boolean(started);
    $('dash').hidden = !started;
    if (!started) { paintOnboarding(); applyMode(); return; }
    paintTotals(); paintCategories(); paintRecent(); paintGoals(); paintSafety(); paintNextStep();
    applyMode();
  }

  /* ------------------------------------------------------------- quick add */

  function openQuickAdd(kind) {
    if (document.querySelector('.money-back')) return;
    const type = kind || 'expense';
    const cats = g => M.categoriesOf(g).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

    const back = document.createElement('div');
    back.className = 'money-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Add a transaction');
    back.innerHTML = `<div class="money-box">
      <div class="hd"><b>Add a transaction</b><button type="button" class="x" aria-label="Close">✕</button></div>
      <div class="seg mt-16" role="radiogroup" aria-label="Type">
        <button type="button" class="opt ${type === 'income' ? 'selected' : ''}" data-type="income">Income</button>
        <button type="button" class="opt ${type === 'expense' ? 'selected' : ''}" data-type="expense">Expense</button>
        <button type="button" class="opt" data-type="transfer">Transfer</button>
      </div>
      <div class="filters mt-16">
        <div class="f"><label for="txAmount">Amount</label>
          <input type="number" id="txAmount" step="any" min="0" inputmode="decimal" placeholder="0"></div>
        <div class="f"><label for="txDate">Date</label>
          <input type="date" id="txDate" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="f"><label for="txCat">Category</label>
          <select id="txCat">
            <optgroup label="Income" id="grpIncome">${cats('income')}</optgroup>
            <optgroup label="Essential">${cats('essential')}</optgroup>
            <optgroup label="Flexible">${cats('flexible')}</optgroup>
            <optgroup label="Saving">${cats('saving')}</optgroup>
          </select></div>
        <div class="f"><label for="txNote">Note (optional)</label>
          <input type="text" id="txNote" maxlength="140" placeholder="e.g. personal session"></div>
      </div>
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="txSave">Save</button>
        <button type="button" class="btn btn-quiet" id="txSaveMore">Save and add another</button>
        <button type="button" class="btn btn-quiet" id="txCancel">Cancel</button>
      </div>
      <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:12px">
        stays in this browser · never sent anywhere</div>
    </div>`;
    document.body.appendChild(back);

    let current = type;
    const pickDefault = () => {
      const sel = back.querySelector('#txCat');
      sel.value = current === 'income' ? 'inc_clients' : 'exp_other';
    };
    pickDefault();
    back.querySelector('#txAmount').focus();

    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    const commit = () => {
      const amount = Number(back.querySelector('#txAmount').value);
      if (!(amount > 0)) { back.querySelector('#txAmount').focus(); return false; }
      S.addTransaction({
        type: current, amount,
        date: back.querySelector('#txDate').value,
        categoryId: back.querySelector('#txCat').value,
        note: back.querySelector('#txNote').value.trim()
      });
      render();
      return true;
    };

    back.addEventListener('click', e => {
      const t = e.target.closest('[data-type]');
      if (t) {
        current = t.dataset.type;
        back.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('selected', b === t));
        pickDefault();
        return;
      }
      if (e.target === back || e.target.closest('.x') || e.target.closest('#txCancel')) return close();
      if (e.target.closest('#txSave')) { if (commit()) close(); return; }
      if (e.target.closest('#txSaveMore')) {
        if (commit()) {
          back.querySelector('#txAmount').value = '';
          back.querySelector('#txNote').value = '';
          back.querySelector('#txAmount').focus();
        }
      }
    });
  }

  /* ----------------------------------------------------------------- goals */

  function openGoal(type) {
    if (document.querySelector('.money-back')) return;
    const emergency = type === 'emergency';
    const back = document.createElement('div');
    back.className = 'money-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Create a goal');
    back.innerHTML = `<div class="money-box">
      <div class="hd"><b>${emergency ? 'Create a reserve' : 'Create a goal'}</b>
        <button type="button" class="x" aria-label="Close">✕</button></div>
      <div class="filters mt-16">
        <div class="f"><label for="gName">What for</label>
          <input type="text" id="gName" maxlength="80" value="${emergency ? 'Emergency reserve' : ''}" placeholder="e.g. new laptop"></div>
        <div class="f"><label for="gTarget">Target amount</label>
          <input type="number" id="gTarget" step="any" min="0" inputmode="decimal" placeholder="0"></div>
        <div class="f"><label for="gNow">Already saved</label>
          <input type="number" id="gNow" step="any" min="0" inputmode="decimal" placeholder="0"></div>
        <div class="f"><label for="gMonthly">Monthly amount</label>
          <input type="number" id="gMonthly" step="any" min="0" inputmode="decimal" placeholder="0"></div>
        <div class="f"><label for="gDate">Target date (optional)</label>
          <input type="date" id="gDate"></div>
      </div>
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="gSave">Create</button>
        <button type="button" class="btn btn-quiet" id="gCancel">Cancel</button>
      </div>
      <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:12px">
        the projection uses your monthly amount and assumes no investment growth ·
        any growth assumption is something you turn on deliberately</div>
    </div>`;
    document.body.appendChild(back);
    back.querySelector('#gName').focus();

    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('.x') || e.target.closest('#gCancel')) return close();
      if (!e.target.closest('#gSave')) return;
      const target = Number(back.querySelector('#gTarget').value);
      if (!(target > 0)) { back.querySelector('#gTarget').focus(); return; }
      S.addGoal({
        name: back.querySelector('#gName').value.trim() || (emergency ? 'Emergency reserve' : 'My goal'),
        targetAmount: target,
        currentAmount: Number(back.querySelector('#gNow').value) || 0,
        monthlyContribution: Number(back.querySelector('#gMonthly').value) || 0,
        targetDate: back.querySelector('#gDate').value || undefined,
        type: emergency ? 'emergency' : 'purchase'
      });
      close();
      render();
    });
  }

  /* --------------------------------------------------------------- wiring */

  $('quickAdd')?.addEventListener('click', () => openQuickAdd('expense'));
  $('addGoal')?.addEventListener('click', () => openGoal('purchase'));

  document.addEventListener('click', e => {
    const drop = e.target.closest('[data-drop-tx]');
    if (drop) { S.removeTransaction(drop.dataset.dropTx); render(); return; }

    const step = e.target.closest('[data-step]');
    if (step) {
      const action = step.dataset.step;
      P?.track?.('money_next_step_taken', { action, stage: S.stage() });
      if (action === 'add-transaction' || action === 'categorise') return openQuickAdd('income');
      if (action === 'goal-emergency') return openGoal('emergency');
      if (action === 'goal-create') return openGoal('purchase');
      if (action === 'academy') P?.track?.('money_to_academy', { stage: S.stage() });
      if (action === 'paper-trade') P?.track?.('academy_to_paper_trade', { from: 'money' });
      if (step.dataset.routeTo) location.href = step.dataset.routeTo;
    }
  });

  /* Data controls: export and delete are part of the promise, not a setting
     buried somewhere. */
  $('moneyMenu')?.addEventListener('click', () => {
    if (document.querySelector('.money-back')) return;
    const back = document.createElement('div');
    back.className = 'money-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Your data');
    back.innerHTML = `<div class="money-box">
      <div class="hd"><b>Your data</b><button type="button" class="x" aria-label="Close">✕</button></div>
      <p style="font-size:13px;color:var(--tv-muted);line-height:1.6;margin-top:10px">
        ${S.transactions().length} transaction${S.transactions().length === 1 ? '' : 's'},
        ${S.goals().length} goal${S.goals().length === 1 ? '' : 's'}, stored in this browser only.
        Clearing your browser data is the one thing that would lose it.</p>
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-quiet" id="expJson">Export JSON</button>
        <button type="button" class="btn btn-quiet" id="expCsv">Export CSV</button>
        <button type="button" class="btn btn-quiet" id="loadSample">Load sample week</button>
        <button type="button" class="btn btn-quiet" id="delAll" style="color:var(--tv-red)">Delete everything</button>
      </div>
      <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:12px">
        the sample is one week of a self-employed trainer — it is added only when you press it</div>
    </div>`;
    document.body.appendChild(back);
    const close = () => back.remove();

    const download = (name, text, mime) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: mime }));
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('.x')) return close();
      if (e.target.closest('#expJson')) return download('my-money.json', S.exportJson(), 'application/json');
      if (e.target.closest('#expCsv')) return download('my-money.csv', S.exportCsv(), 'text/csv');
      if (e.target.closest('#loadSample')) { S.loadSample(); close(); render(); return; }
      if (e.target.closest('#delAll')) {
        const btn = e.target.closest('#delAll');
        if (btn.dataset.confirm) { S.deleteAll(); close(); render(); return; }
        btn.dataset.confirm = '1';
        btn.textContent = 'Press again to delete everything';
      }
    });
  });

  document.addEventListener('money-changed', render);
  document.addEventListener('ui-mode-changed', render);

  P?.track?.('money_opened', { stage: S.stage(), transactions: S.transactions().length });
  render();
})();
