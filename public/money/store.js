/* =========================================================================
   Personal finance — the store.

   One versioned key, `money_store_v1`. Not five loose keys: the portal
   already has `saved_screens` written by one page and `screener_saved` read
   by another, and that is exactly the bug this avoids repeating for data a
   person actually cares about.

   Everything lives in this browser. Nothing is sent anywhere. That is stated
   on the page rather than assumed, because a free-text financial record is
   the most sensitive thing a visitor can type into this stand.
   ========================================================================= */

window.MoneyStore = (function () {

  const KEY = 'money_store_v1';
  const SCHEMA = 1;
  const M = () => window.MoneyModel;

  const EMPTY = () => ({
    schemaVersion: SCHEMA,
    profile: {
      onboardingPath: null,          // track | goal | savings | investor
      primaryCurrency: 'USD',
      incomePattern: 'regular',      // regular | irregular | mixed
      createdAt: new Date().toISOString()
    },
    accounts: [
      { id: 'acc_cash', name: 'Cash', type: 'cash', currency: 'USD', openingBalance: 0, includedInNetWorth: true }
    ],
    transactions: [],
    goals: [],
    liabilities: [],
    recurring: [],
    flags: {}                        // investingBasicsDone, paperTradeDone, investingStarted
  });

  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; } };

  let cache = null;

  function load() {
    if (cache) return cache;
    let raw = null;
    try { raw = JSON.parse(read() || 'null'); } catch { raw = null; }
    cache = raw && typeof raw === 'object' ? migrate(raw) : EMPTY();
    return cache;
  }

  function save(next) {
    cache = next || cache;
    write(cache);
    document.dispatchEvent(new CustomEvent('money-changed', { detail: { state: cache } }));
    return cache;
  }

  /* ------------------------------------------------------------ migration

     `wealth_profile` and `wealth_scenarios` are what the old asset-first hub
     wrote. Nobody's data is dropped: the sums become accounts, the goal
     becomes a goal, and the scenarios are kept verbatim in a legacy field so
     the investing section can still show them. */
  function migrate(state) {
    if (!state.schemaVersion) state.schemaVersion = SCHEMA;
    for (const k of ['accounts', 'transactions', 'goals', 'liabilities', 'recurring']) {
      if (!Array.isArray(state[k])) state[k] = [];
    }
    if (!state.profile) state.profile = EMPTY().profile;
    if (!state.flags) state.flags = {};
    return state;
  }

  function legacyWealth() {
    try {
      const p = JSON.parse(localStorage.getItem('wealth_profile') || 'null');
      const s = JSON.parse(localStorage.getItem('wealth_scenarios') || 'null');
      return (p || s) ? { profile: p, scenarios: s } : null;
    } catch { return null; }
  }

  /* Explicit, never automatic: the visitor presses "Import my Wealth
     profile" after seeing what it will create. Silently inserting financial
     records is the same class of mistake as adding BTC to somebody's
     watchlist and calling it their choice. */
  function importLegacy() {
    const legacy = legacyWealth();
    if (!legacy) return null;
    const st = load();
    const p = legacy.profile || {};
    const cur = p.currency || 'USD';
    const add = (name, type, amount) => {
      if (!(Number(amount) > 0)) return;
      st.accounts.push({
        id: 'acc_' + Math.random().toString(36).slice(2, 9),
        name, type, currency: cur, openingBalance: Number(amount),
        includedInNetWorth: true, importedFrom: 'wealth_profile'
      });
    };
    add('Cash', 'cash', p.cash);
    add('Deposits', 'deposit', p.deposit);
    add('Stocks & ETFs', 'investment', p.stocks);
    add('Crypto', 'investment', p.crypto);
    add('Bonds', 'investment', p.bonds);
    add('Other market assets', 'investment', p.other);

    if (p.goalAmount > 0) {
      st.goals.push({
        id: 'goal_' + Math.random().toString(36).slice(2, 9),
        name: p.goalName || 'Imported goal',
        targetAmount: Number(p.goalAmount), currentAmount: 0, currency: cur,
        monthlyContribution: 0, priority: 'medium', type: 'purchase',
        importedFrom: 'wealth_profile'
      });
    }
    if (p.currency) st.profile.primaryCurrency = p.currency;
    st.legacyScenarios = legacy.scenarios || null;
    st.profile.importedAt = new Date().toISOString();
    save(st);
    window.Portal?.track?.('money_legacy_imported', { accounts: st.accounts.length, goals: st.goals.length });
    return st;
  }

  /* Preview before importing — what will be created, in the visitor's words. */
  function legacyPreview() {
    const legacy = legacyWealth();
    if (!legacy?.profile) return null;
    const p = legacy.profile;
    const rows = [];
    const push = (n, v) => { if (Number(v) > 0) rows.push({ name: n, amount: Number(v) }); };
    push('Cash', p.cash); push('Deposits', p.deposit); push('Stocks & ETFs', p.stocks);
    push('Crypto', p.crypto); push('Bonds', p.bonds); push('Other market assets', p.other);
    return { accounts: rows, goal: p.goalAmount > 0 ? { name: p.goalName || 'Imported goal', amount: Number(p.goalAmount) } : null,
             currency: p.currency || 'USD', scenarios: (legacy.scenarios || []).length };
  }

  /* --------------------------------------------------------------- writes */

  const id = prefix => prefix + '_' + Math.random().toString(36).slice(2, 10);

  function addTransaction(input) {
    const st = load();
    const t = {
      id: id('tx'),
      type: input.type === 'income' || input.type === 'transfer' ? input.type : 'expense',
      accountId: input.accountId || st.accounts[0]?.id || 'acc_cash',
      transferAccountId: input.transferAccountId || undefined,
      amount: Math.abs(Number(input.amount) || 0),
      currency: input.currency || st.profile.primaryCurrency,
      date: input.date || new Date().toISOString().slice(0, 10),
      categoryId: input.categoryId || (input.type === 'income' ? 'inc_other' : 'exp_other'),
      note: (input.note || '').slice(0, 200),
      recurringRuleId: input.recurringRuleId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!(t.amount > 0)) return null;

    const first = !st.transactions.length;
    const firstOfType = !st.transactions.some(x => x.type === t.type);
    st.transactions.push(t);
    save(st);

    window.Portal?.track?.('transaction_added', { type: t.type, category: t.categoryId, first });
    if (first) window.Portal?.meaningful?.('first_transaction');
    if (firstOfType && t.type === 'income') window.Portal?.track?.('first_income_added');
    if (firstOfType && t.type === 'expense') window.Portal?.track?.('first_expense_added');
    /* Academy steps complete from this event, not from a "mark as read". */
    document.dispatchEvent(new CustomEvent('money-action', { detail: { action: 'transaction_added', transaction: t } }));
    return t;
  }

  function updateTransaction(txId, patch) {
    const st = load();
    const t = st.transactions.find(x => x.id === txId);
    if (!t) return null;
    Object.assign(t, patch, { updatedAt: new Date().toISOString() });
    if (patch.amount != null) t.amount = Math.abs(Number(patch.amount) || 0);
    save(st);
    window.Portal?.track?.('transaction_edited', { id: txId });
    return t;
  }

  function removeTransaction(txId) {
    const st = load();
    const before = st.transactions.length;
    st.transactions = st.transactions.filter(x => x.id !== txId);
    if (st.transactions.length !== before) {
      save(st);
      window.Portal?.track?.('transaction_deleted', { id: txId });
    }
    return st.transactions;
  }

  function addGoal(input) {
    const st = load();
    const g = {
      id: id('goal'),
      name: (input.name || 'My goal').slice(0, 80),
      targetAmount: Number(input.targetAmount) || 0,
      currentAmount: Number(input.currentAmount) || 0,
      currency: input.currency || st.profile.primaryCurrency,
      targetDate: input.targetDate || undefined,
      monthlyContribution: Number(input.monthlyContribution) || 0,
      priority: input.priority || 'medium',
      type: input.type || 'other',
      createdAt: new Date().toISOString()
    };
    st.goals.push(g);
    save(st);
    window.Portal?.track?.('goal_created', { type: g.type, hasContribution: g.monthlyContribution > 0 });
    if (g.type === 'emergency') window.Portal?.track?.('emergency_goal_created');
    if (g.type === 'tax') window.Portal?.track?.('tax_envelope_created');
    window.Portal?.meaningful?.('goal_created');
    document.dispatchEvent(new CustomEvent('money-action', { detail: { action: 'goal_created', goal: g } }));
    return g;
  }

  const removeGoal = goalId => {
    const st = load();
    st.goals = st.goals.filter(g => g.id !== goalId);
    return save(st);
  };

  function addAccount(input) {
    const st = load();
    const a = {
      id: id('acc'),
      name: (input.name || 'Account').slice(0, 60),
      type: M().ACCOUNT_TYPES.includes(input.type) ? input.type : 'bank',
      currency: input.currency || st.profile.primaryCurrency,
      openingBalance: Number(input.openingBalance) || 0,
      includedInNetWorth: input.includedInNetWorth !== false
    };
    st.accounts.push(a);
    save(st);
    return a;
  }

  function addLiability(input) {
    const st = load();
    const l = {
      id: id('debt'),
      name: (input.name || 'Debt').slice(0, 60),
      balance: Number(input.balance) || 0,
      interestRate: input.interestRate != null ? Number(input.interestRate) : undefined,
      monthlyPayment: Number(input.monthlyPayment) || 0,
      dueDay: input.dueDay || undefined
    };
    st.liabilities.push(l);
    save(st);
    return l;
  }

  function addRecurring(input) {
    const st = load();
    const r = {
      id: id('rec'),
      type: input.type === 'income' ? 'income' : 'expense',
      name: (input.name || 'Recurring').slice(0, 60),
      amount: Math.abs(Number(input.amount) || 0),
      categoryId: input.categoryId || 'exp_subs',
      frequency: ['weekly', 'monthly', 'yearly'].includes(input.frequency) ? input.frequency : 'monthly',
      nextDate: input.nextDate || new Date().toISOString().slice(0, 10),
      active: true
    };
    st.recurring.push(r);
    save(st);
    window.Portal?.track?.('recurring_payment_created', { frequency: r.frequency });
    return r;
  }

  const setProfile = patch => { const st = load(); Object.assign(st.profile, patch); return save(st); };
  const setFlag = (name, value = true) => { const st = load(); st.flags[name] = value; return save(st); };

  /* ---------------------------------------------------------- read helpers */

  const state = () => load();
  const transactions = () => load().transactions;
  const accounts = () => load().accounts;
  const goals = () => load().goals;
  const liabilities = () => load().liabilities;
  const recurring = () => load().recurring;
  const hasData = () => load().transactions.length > 0;

  const stage = () => M().financialStage({
    transactions: transactions(), goals: goals(), accounts: accounts(), flags: load().flags
  });
  const nextStep = () => M().nextStep({
    transactions: transactions(), goals: goals(), accounts: accounts(), flags: load().flags
  });

  /* ---------------------------------------------------- export and delete */

  const exportJson = () => JSON.stringify(load(), null, 2);

  function exportCsv() {
    const rows = [['date', 'type', 'amount', 'currency', 'category', 'note']];
    for (const t of transactions()) {
      rows.push([t.date, t.type, t.amount, t.currency,
                 M().categoryById(t.categoryId)?.name || '', (t.note || '').replace(/[",\n]/g, ' ')]);
    }
    return rows.map(r => r.map(c => `"${String(c)}"`).join(',')).join('\n');
  }

  function deleteAll() {
    try { localStorage.removeItem(KEY); } catch {}
    cache = null;
    document.dispatchEvent(new CustomEvent('money-changed', { detail: { state: load() } }));
    window.Portal?.track?.('money_deleted_all');
  }

  /* Sample data is loaded only when asked for, and it is the trainer's week
     from the case — so the demo shows the person the product is built for. */
  function loadSample() {
    const st = load();
    if (st.transactions.length) return st;
    const today = new Date();
    const day = n => new Date(today.getFullYear(), today.getMonth(), Math.max(1, today.getDate() - n))
      .toISOString().slice(0, 10);
    const acc = st.accounts[0]?.id || 'acc_cash';
    const add = (type, amount, categoryId, note, ago) =>
      st.transactions.push({ id: id('tx'), type, accountId: acc, amount, currency: st.profile.primaryCurrency,
        date: day(ago), categoryId, note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sample: true });

    add('income', 60, 'inc_clients', 'Personal session', 6);
    add('income', 60, 'inc_clients', 'Personal session', 4);
    add('income', 45, 'inc_clients', 'Group class', 3);
    add('expense', 400, 'exp_workspace', 'Gym rent', 5);
    add('expense', 55, 'exp_transport', 'Transport', 2);
    add('expense', 20, 'exp_phone', 'Phone', 1);
    st.profile.sampleLoaded = true;
    save(st);
    window.Portal?.track?.('money_sample_loaded');
    return st;
  }

  return {
    KEY, SCHEMA,
    state, load, save, transactions, accounts, goals, liabilities, recurring, hasData,
    addTransaction, updateTransaction, removeTransaction,
    addGoal, removeGoal, addAccount, addLiability, addRecurring,
    setProfile, setFlag, stage, nextStep,
    legacyWealth, legacyPreview, importLegacy,
    exportJson, exportCsv, deleteAll, loadSample
  };
})();
