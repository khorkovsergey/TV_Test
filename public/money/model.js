/* =========================================================================
   Personal finance — the domain model.

   The old Wealth Hub asked, as its first question:

       "What is invested in markets right now? Stocks & ETFs / Crypto / Bonds"

   For the person this product is actually for — a self-employed trainer who
   keeps client payments in a notebook — that first screen says "not for you"
   and the session ends. This model starts where they are: what came in, what
   went out, what is left.

   Pure functions only. No DOM, no storage, no formatting — so every
   calculation here is testable on its own, and none of them can quietly
   depend on what happens to be on screen.
   ========================================================================= */

window.MoneyModel = (function () {

  /* ------------------------------------------------------------ categories

     Grouped by what the money DOES, because that is the distinction that
     makes cash-flow advice honest: an essential expense cannot be cut, a
     flexible one can, and a saving is not an expense at all. */
  const CATEGORIES = [
    // income
    { id: 'inc_clients',   name: 'Clients',        group: 'income' },
    { id: 'inc_salary',    name: 'Salary',         group: 'income' },
    { id: 'inc_freelance', name: 'Freelance',      group: 'income' },
    { id: 'inc_business',  name: 'Business',       group: 'income' },
    { id: 'inc_rent',      name: 'Rent received',  group: 'income' },
    { id: 'inc_other',     name: 'Other income',   group: 'income' },

    // essential — the part a cash-flow calculation may not assume away
    { id: 'exp_housing',   name: 'Housing & rent', group: 'essential' },
    { id: 'exp_utilities', name: 'Utilities',      group: 'essential' },
    { id: 'exp_food',      name: 'Food',           group: 'essential' },
    { id: 'exp_transport', name: 'Transport',      group: 'essential' },
    { id: 'exp_health',    name: 'Health',         group: 'essential' },
    { id: 'exp_workspace', name: 'Workspace rent', group: 'essential' },
    { id: 'exp_phone',     name: 'Phone & internet', group: 'essential' },
    { id: 'exp_debt',      name: 'Debt payments',  group: 'essential' },
    { id: 'exp_tax',       name: 'Tax',            group: 'essential' },

    // flexible
    { id: 'exp_eating',    name: 'Eating out',     group: 'flexible' },
    { id: 'exp_shopping',  name: 'Shopping',       group: 'flexible' },
    { id: 'exp_fun',       name: 'Entertainment',  group: 'flexible' },
    { id: 'exp_travel',    name: 'Travel',         group: 'flexible' },
    { id: 'exp_subs',      name: 'Subscriptions',  group: 'flexible' },
    { id: 'exp_equipment', name: 'Equipment',      group: 'flexible' },
    { id: 'exp_other',     name: 'Other spending', group: 'flexible' },

    // saving — money that left the month but not the person
    { id: 'sav_goal',      name: 'To a goal',      group: 'saving' },
    { id: 'sav_reserve',   name: 'To the reserve', group: 'saving' },
    { id: 'sav_tax',       name: 'To tax reserve', group: 'saving' }
  ];

  const categoryById = id => CATEGORIES.find(c => c.id === id) || null;
  const categoriesOf = group => CATEGORIES.filter(c => c.group === group);
  const groupOf = id => categoryById(id)?.group || 'flexible';

  const ACCOUNT_TYPES = ['cash', 'bank', 'card', 'deposit', 'investment', 'property', 'business', 'debt', 'other'];
  const LIQUID = ['cash', 'bank', 'card'];   // available this month without breaking anything

  /* ------------------------------------------------------------- periods */

  const monthKey = date => String(date || '').slice(0, 7);          // YYYY-MM
  const thisMonth = now => monthKey((now || new Date()).toISOString());
  const inMonth = (t, month) => monthKey(t.date) === month;

  function monthsBetween(fromISO, toISO) {
    const a = new Date(fromISO), b = new Date(toISO);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  }

  /* ------------------------------------------------------------ cash flow

     Transfers are excluded everywhere. Moving money between your own accounts
     is not income and not spending; counting it as either is the classic way
     a budget app tells somebody they earned twice what they did. */
  const isFlow = t => t.type === 'income' || t.type === 'expense';

  const sumOf = list => list.reduce((n, t) => n + (Number(t.amount) || 0), 0);

  const monthlyIncome = (transactions, month) =>
    sumOf(transactions.filter(t => t.type === 'income' && inMonth(t, month)));

  const monthlyExpenses = (transactions, month) =>
    sumOf(transactions.filter(t => t.type === 'expense' && inMonth(t, month)));

  const monthlyCashFlow = (transactions, month) =>
    monthlyIncome(transactions, month) - monthlyExpenses(transactions, month);

  const essentialExpenses = (transactions, month) =>
    sumOf(transactions.filter(t => t.type === 'expense' && inMonth(t, month) && groupOf(t.categoryId) === 'essential'));

  const flexibleExpenses = (transactions, month) =>
    sumOf(transactions.filter(t => t.type === 'expense' && inMonth(t, month) && groupOf(t.categoryId) === 'flexible'));

  /* Insufficient data is reported as null, never as zero. A savings rate of
     "0%" for somebody with no recorded income is a false statement. */
  function savingsRate(transactions, month) {
    const income = monthlyIncome(transactions, month);
    if (income <= 0) return null;
    return (monthlyCashFlow(transactions, month) / income) * 100;
  }

  /* Irregular income is the normal case for the person this is built for, so
     the average is over months that actually have data — not over the
     calendar, which would report a trainer's good month as a decline. */
  function averageMonthly(transactions, type, months = 3) {
    const keys = [...new Set(transactions.filter(t => t.type === type).map(t => monthKey(t.date)))]
      .sort().slice(-months);
    if (!keys.length) return null;
    const total = keys.reduce((n, k) =>
      n + sumOf(transactions.filter(t => t.type === type && inMonth(t, k))), 0);
    return total / keys.length;
  }

  function byCategory(transactions, month, type = 'expense') {
    const out = new Map();
    for (const t of transactions) {
      if (t.type !== type || !inMonth(t, month)) continue;
      const c = categoryById(t.categoryId);
      const key = c ? c.id : 'exp_other';
      const row = out.get(key) || { categoryId: key, name: c?.name || 'Other', group: c?.group || 'flexible', total: 0, count: 0 };
      row.total += Number(t.amount) || 0;
      row.count++;
      out.set(key, row);
    }
    return [...out.values()].sort((a, b) => b.total - a.total);
  }

  /* --------------------------------------------------------- net worth */

  function accountBalance(account, transactions) {
    let b = Number(account.openingBalance) || 0;
    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      if (t.accountId === account.id) b += t.type === 'income' ? amt : -amt;
      if (t.type === 'transfer' && t.transferAccountId === account.id) b += amt;
    }
    return b;
  }

  const liquidAssets = (accounts, transactions) =>
    accounts.filter(a => LIQUID.includes(a.type) && !a.archivedAt)
      .reduce((n, a) => n + accountBalance(a, transactions), 0);

  function netWorth(accounts, liabilities, transactions) {
    const assets = accounts.filter(a => a.includedInNetWorth !== false && !a.archivedAt && a.type !== 'debt')
      .reduce((n, a) => n + accountBalance(a, transactions), 0);
    const debts = (liabilities || []).reduce((n, l) => n + (Number(l.balance) || 0), 0);
    return { assets, liabilities: debts, net: assets - debts };
  }

  /* ------------------------------------------------------- safety layer

     Deliberately no universal "you need six months" rule. The product states
     the number of months the buffer covers and lets the person choose their
     own target; a norm presented as an obligation is advice this prototype
     is not entitled to give. */
  function emergencyFundMonths(liquid, essentialMonthly) {
    if (!essentialMonthly || essentialMonthly <= 0) return null;   // never divide by zero
    return liquid / essentialMonthly;
  }

  function debtPaymentShare(monthlyDebtPayments, income) {
    if (!income || income <= 0) return null;
    return (monthlyDebtPayments / income) * 100;
  }

  /* --------------------------------------------------------------- goals

     Projection uses the monthly contribution, not total capital. The old
     Wealth Hub computed "goal coverage = total capital / goal amount", which
     told somebody with a large deposit that a goal was already met while they
     were saving nothing towards it.

     Assumed return defaults to zero. Any growth assumption has to be chosen
     explicitly and is labelled as an assumption wherever it appears. */
  function goalProjection(goal, opts) {
    const target = Number(goal.targetAmount) || 0;
    const current = Number(goal.currentAmount) || 0;
    const monthly = Number(goal.monthlyContribution ?? opts?.monthlyContribution) || 0;
    const annualReturn = Number(opts?.assumedAnnualReturn) || 0;

    const remaining = Math.max(0, target - current);
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : null;

    let monthsNeeded = null;
    if (remaining === 0) monthsNeeded = 0;
    else if (monthly > 0) {
      if (annualReturn === 0) monthsNeeded = Math.ceil(remaining / monthly);
      else {
        const r = annualReturn / 100 / 12;
        // future value of an annuity, solved for n
        const n = Math.log(1 + (remaining * r) / monthly) / Math.log(1 + r);
        monthsNeeded = Number.isFinite(n) ? Math.ceil(n) : null;
      }
    }

    let projectedDate = null;
    if (monthsNeeded != null) {
      const d = new Date();
      d.setMonth(d.getMonth() + monthsNeeded);
      projectedDate = d.toISOString().slice(0, 10);
    }

    /* If a target date exists, say whether the plan reaches it — as a fact
       about the arithmetic, not as encouragement or a warning. */
    let requiredMonthly = null, onTrack = null;
    if (goal.targetDate) {
      const left = monthsBetween(new Date().toISOString(), goal.targetDate);
      if (left != null && left > 0) {
        requiredMonthly = remaining / left;
        onTrack = monthly > 0 ? monthly >= requiredMonthly : false;
      } else if (left != null && left <= 0) {
        requiredMonthly = remaining;
        onTrack = remaining === 0;
      }
    }

    return {
      remaining, progress, monthsNeeded, projectedDate, requiredMonthly, onTrack,
      assumedAnnualReturn: annualReturn,
      insufficient: monthly <= 0 && remaining > 0     // cannot project without a contribution
    };
  }

  /* --------------------------------------------------- progress ladder

     The stage decides what the product offers next. Nothing here pushes
     anybody towards the market: `learn` is only reached once there is a real
     surplus, and `invest` only once the person has actually practised. */
  const STAGES = ['record', 'understand', 'stabilise', 'save', 'learn', 'practice', 'invest', 'advanced'];

  function financialStage(state) {
    const { transactions = [], goals = [], accounts = [], flags = {} } = state || {};
    const month = state?.month || thisMonth();

    if (!transactions.length) return 'record';

    const months = new Set(transactions.map(t => monthKey(t.date))).size;
    const categorised = transactions.filter(t => t.categoryId).length;
    if (months < 1 || categorised < 3) return 'understand';

    /* Spending comes before saving. Telling somebody whose month ends
       negative to "create a reserve goal" is advice they cannot act on —
       the useful step is to see which spending is essential and which is
       not. §2.6: negative cash flow → review spending. */
    const flow = monthlyCashFlow(transactions, month);
    if (flow <= 0) return 'understand';

    const essential = essentialExpenses(transactions, month);
    const liquid = liquidAssets(accounts, transactions);
    const buffer = emergencyFundMonths(liquid, essential);
    const hasReserve = goals.some(g => g.type === 'emergency') || (buffer != null && buffer >= 1);
    if (!hasReserve) return 'stabilise';

    if (!goals.some(g => g.type !== 'emergency')) return 'save';

    if (!flags.investingBasicsDone) return 'learn';
    if (!flags.paperTradeDone) return 'practice';
    if (!flags.investingStarted) return 'invest';
    return 'advanced';
  }

  /* One next step, chosen by stage. Never more than one, and never a market
     action before the stage that earns it. */
  const NEXT_STEP = {
    record:     { label: 'Add your first income or expense', action: 'add-transaction',
                  why: 'Two or three entries are enough to see where a month actually goes.' },
    understand: { label: 'Look at what you can actually change', action: 'categorise', route: '/money/transactions',
                  why: 'More went out than came in. The difference between essential and flexible spending is where a decision is possible — and where it is not.' },
    stabilise:  { label: 'Create a reserve goal', action: 'goal-emergency', route: '/money/safety',
                  why: 'A buffer is what stops one bad month from undoing everything else.' },
    save:       { label: 'Set a goal and a monthly amount', action: 'goal-create', route: '/money/goals',
                  why: 'A goal with a monthly figure is a plan; a goal without one is a wish.' },
    learn:      { label: 'Learn what cash, deposits, bonds and ETFs are', action: 'academy', route: '/learn#investing',
                  why: 'You have a regular surplus. This is the point where knowing the options is useful.' },
    practice:   { label: 'Try Paper Trading with virtual money', action: 'paper-trade', route: '/trade#practice',
                  why: 'Practice costs attention rather than money.' },
    invest:     { label: 'Compare instruments before deciding anything', action: 'research', route: '/screeners',
                  why: 'You decide whether the market is for you — nothing here decides it for you.' },
    advanced:   { label: 'Open the full research workspace', action: 'pro', route: '/charts',
                  why: '' }
  };

  const nextStep = state => ({ stage: financialStage(state), ...NEXT_STEP[financialStage(state)] });

  return {
    CATEGORIES, ACCOUNT_TYPES, LIQUID, STAGES, NEXT_STEP,
    categoryById, categoriesOf, groupOf,
    monthKey, thisMonth, inMonth, monthsBetween, isFlow,
    monthlyIncome, monthlyExpenses, monthlyCashFlow,
    essentialExpenses, flexibleExpenses, savingsRate, averageMonthly, byCategory,
    accountBalance, liquidAssets, netWorth,
    emergencyFundMonths, debtPaymentShare,
    goalProjection, financialStage, nextStep
  };
})();
