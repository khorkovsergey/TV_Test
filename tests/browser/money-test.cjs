/* Приёмка My Money / Personal Wealth Hub. §26 промпта Phase 5.
   Главный вопрос сюиты: работает ли продукт для человека без инвестиций. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? ' — ' + e : '')); } };
const mk = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() });

async function open(path, opts = {}) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  const res = await fetch(B + path);
  const html = await res.text();
  const dom = new JSDOM(html, { url: B + path, runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const store = opts.store || new Map();
  Object.defineProperty(dom.window, 'localStorage', { value: mk(store), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(new Map()), configurable: true });
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  for (const s of dom.window.document.querySelectorAll('script')) {
    const type = (s.getAttribute('type') || '').toLowerCase();
    if (type && !/javascript|module/.test(type)) continue;
    try { if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text()); else dom.window.eval(s.textContent); }
    catch (e) { events.push('ERR ' + e.message); }
  }
  await new Promise(r => setTimeout(r, opts.wait || 1400));
  return { d: dom.window.document, w: dom.window, events, html, res, store };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const text = d => d.body.textContent.replace(/\s+/g, ' ');

(async () => {

  /* ------------------------------------------------ модель как чистые функции */

  console.log('\n[Модель] Арифметика, которую можно проверить');
  const p = await open('/money', { wait: 1600 });
  const M = p.w.MoneyModel, S = p.w.MoneyStore;
  ok('MoneyModel подключён', !!M);
  ok('MoneyStore подключён', !!S);

  const tx = (type, amount, categoryId, date) => ({ type, amount, categoryId, date: date || '2026-07-10' });
  const set = [
    tx('income', 60, 'inc_clients'), tx('income', 60, 'inc_clients'), tx('income', 45, 'inc_clients'),
    tx('expense', 400, 'exp_workspace'), tx('expense', 55, 'exp_transport'), tx('expense', 20, 'exp_phone'),
    tx('expense', 30, 'exp_eating'),
    { type: 'transfer', amount: 500, categoryId: 'sav_goal', date: '2026-07-11' }
  ];
  ok('доход считается', M.monthlyIncome(set, '2026-07') === 165, String(M.monthlyIncome(set, '2026-07')));
  ok('расход считается', M.monthlyExpenses(set, '2026-07') === 505, String(M.monthlyExpenses(set, '2026-07')));
  ok('перевод не считается ни доходом, ни расходом',
     M.monthlyIncome(set, '2026-07') === 165 && M.monthlyExpenses(set, '2026-07') === 505);
  ok('денежный поток = доход − расход', M.monthlyCashFlow(set, '2026-07') === -340);
  ok('обязательные расходы отделены от гибких',
     M.essentialExpenses(set, '2026-07') === 475 && M.flexibleExpenses(set, '2026-07') === 30,
     `${M.essentialExpenses(set, '2026-07')}/${M.flexibleExpenses(set, '2026-07')}`);
  ok('другой месяц не попадает в расчёт', M.monthlyIncome(set, '2026-06') === 0);

  console.log('\n[Модель] Недостаток данных — это null, а не ноль');
  ok('норма сбережений без дохода = null', M.savingsRate([], '2026-07') === null);
  ok('подушка без обязательных расходов = null', M.emergencyFundMonths(1000, 0) === null);
  ok('доля долга без дохода = null', M.debtPaymentShare(500, 0) === null);
  ok('среднее без данных = null', M.averageMonthly([], 'income') === null);
  ok('на ноль нигде не делится',
     [M.savingsRate([], '2026-07'), M.emergencyFundMonths(100, 0), M.debtPaymentShare(1, 0)]
       .every(v => v === null || Number.isFinite(v)));

  console.log('\n[Модель] Нерегулярный доход');
  const irregular = [
    { type: 'income', amount: 900, categoryId: 'inc_clients', date: '2026-05-04' },
    { type: 'income', amount: 300, categoryId: 'inc_clients', date: '2026-06-04' },
    { type: 'income', amount: 1200, categoryId: 'inc_clients', date: '2026-07-04' }
  ];
  ok('среднее берётся по месяцам с данными, а не по календарю',
     M.averageMonthly(irregular, 'income', 3) === 800, String(M.averageMonthly(irregular, 'income', 3)));

  console.log('\n[Модель] Цель считается от ежемесячного взноса');
  const goal = { targetAmount: 1200, currentAmount: 200, monthlyContribution: 100 };
  const pr = M.goalProjection(goal);
  ok('остаток верен', pr.remaining === 1000);
  ok('срок берётся из взноса, а не из общего капитала', pr.monthsNeeded === 10, String(pr.monthsNeeded));
  ok('доходность по умолчанию нулевая', pr.assumedAnnualReturn === 0);
  ok('дата завершения рассчитана', typeof pr.projectedDate === 'string');
  const noContribution = M.goalProjection({ targetAmount: 1000, currentAmount: 0, monthlyContribution: 0 });
  ok('без взноса прогноз честно отсутствует',
     noContribution.insufficient === true && noContribution.monthsNeeded === null);
  const withReturn = M.goalProjection(goal, { assumedAnnualReturn: 6 });
  /* Важно не «стало быстрее», а что предположение записано и подписано:
     на коротком сроке 6% годовых дают меньше месяца разницы. */
  ok('доходность записана как явное предположение', withReturn.assumedAnnualReturn === 6);
  ok('с доходностью срок не больше, чем без неё',
     withReturn.monthsNeeded <= pr.monthsNeeded,
     `${withReturn.monthsNeeded} vs ${pr.monthsNeeded}`);
  const big = M.goalProjection({ targetAmount: 60000, currentAmount: 0, monthlyContribution: 500 });
  const bigReturn = M.goalProjection({ targetAmount: 60000, currentAmount: 0, monthlyContribution: 500 }, { assumedAnnualReturn: 7 });
  ok('на длинном сроке доходность заметно меняет прогноз',
     bigReturn.monthsNeeded < big.monthsNeeded,
     `${bigReturn.monthsNeeded} vs ${big.monthsNeeded}`);

  console.log('\n[Модель] Подушка и чистый капитал');
  ok('подушка — это месяцы обязательных расходов', M.emergencyFundMonths(1500, 500) === 3);
  const accounts = [
    { id: 'a1', type: 'cash', openingBalance: 500, includedInNetWorth: true },
    { id: 'a2', type: 'deposit', openingBalance: 2000, includedInNetWorth: true }
  ];
  const nw = M.netWorth(accounts, [{ balance: 800 }], []);
  ok('чистый капитал = активы − долги', nw.net === 1700, String(nw.net));
  ok('ликвидность считает только доступное', M.liquidAssets(accounts, []) === 500);

  /* --------------------------------------------- лестница финансового прогресса */

  console.log('\n[Лестница] Следующий шаг зависит от состояния');
  const stage = st => M.financialStage(st);
  ok('нет истории → record', stage({ transactions: [] }) === 'record');
  ok('отрицательный поток → разобрать расходы, а не копить',
     stage({ transactions: set }) === 'understand', stage({ transactions: set }));
  const positive = [
    { type: 'income', amount: 2000, categoryId: 'inc_clients', date: M.thisMonth() + '-05' },
    { type: 'expense', amount: 800, categoryId: 'exp_housing', date: M.thisMonth() + '-06' },
    { type: 'expense', amount: 200, categoryId: 'exp_food', date: M.thisMonth() + '-07' }
  ];
  ok('положительный поток без резерва → stabilise',
     stage({ transactions: positive, goals: [], accounts: [] }) === 'stabilise');
  ok('резерв есть, других целей нет → save',
     stage({ transactions: positive, goals: [{ type: 'emergency' }], accounts: [] }) === 'save');
  ok('цели есть, обучения нет → learn',
     stage({ transactions: positive, goals: [{ type: 'emergency' }, { type: 'purchase' }], accounts: [], flags: {} }) === 'learn');
  ok('обучение пройдено → practice',
     stage({ transactions: positive, goals: [{ type: 'emergency' }, { type: 'purchase' }], accounts: [],
             flags: { investingBasicsDone: true } }) === 'practice');

  console.log('\n[Лестница] Рынок не предлагается раньше времени');
  const early = ['record', 'understand', 'stabilise', 'save'];
  for (const s of early) {
    const step = M.NEXT_STEP[s];
    ok(`${s}: шаг не ведёт в скринер или на график`,
       !/screener|chart|symbols/i.test(step.route || ''), step.route || '—');
  }
  ok('обучение появляется только на стадии learn',
     /academy|learn/i.test(M.NEXT_STEP.learn.route));
  ok('Paper Trading идёт перед реальным рынком',
     M.STAGES.indexOf('practice') < M.STAGES.indexOf('invest'));

  /* --------------------------------------------------------- первый вход */

  console.log('\n[Онбординг] Не спрашивает про акции первым делом');
  const fresh = await open('/money', { wait: 1600 });
  ok('онбординг показан новому посетителю', fresh.d.getElementById('onboard').hidden === false);
  ok('первый вопрос — про пользу, а не про портфель',
     /What would be most useful right now/i.test(fresh.d.querySelector('h1').textContent));
  ok('не спрашивает про акции, ETF и крипту',
     !/Stocks & ETFs|What is invested in markets/i.test(text(fresh.d)),
     (text(fresh.d).match(/Stocks & ETFs|What is invested[^.]*/) || [''])[0]);
  ok('есть вариант «просто записывать»',
     /Track income and spending/i.test(text(fresh.d)));
  ok('есть вариант для того, кто уже инвестирует',
     /Review my investments/i.test(text(fresh.d)));
  ok('шесть путей входа', fresh.d.querySelectorAll('[data-choice]').length === 6,
     String(fresh.d.querySelectorAll('[data-choice]').length));
  ok('нет вопроса про риск-профиль на первом шаге',
     !/risk tolerance|how much risk/i.test(text(fresh.d)));
  ok('без ошибок исполнения', fresh.events.length === 0, fresh.events.join(' | '));

  /* ======================================================================
     ОБЯЗАТЕЛЬНЫЙ СЦЕНАРИЙ: САМОЗАНЯТЫЙ ФИТНЕС-ТРЕНЕР (§18)

     Ведёт записи в блокноте, брокерского счёта нет, доход по неделям
     разный. Продукт обязан быть полезен до всякого рынка.
     ====================================================================== */

  console.log('\n[Фитнес-тренер] Путь от блокнота до первой цели');
  const store = new Map();
  const t1 = await open('/money', { store, wait: 1600 });
  const W = t1.w, D = t1.d;
  const St = W.MoneyStore;

  click(W, D.querySelector('[data-choice="track"]'));
  await new Promise(r => setTimeout(r, 200));
  ok('1. выбран путь «веду в блокноте»', St.state().profile.onboardingPath === 'track');

  const today = new Date().toISOString().slice(0, 10);
  St.addTransaction({ type: 'income', amount: 60, categoryId: 'inc_clients', note: 'Personal session', date: today });
  St.addTransaction({ type: 'income', amount: 60, categoryId: 'inc_clients', note: 'Personal session', date: today });
  St.addTransaction({ type: 'income', amount: 60, categoryId: 'inc_clients', note: 'Personal session', date: today });
  St.addTransaction({ type: 'income', amount: 45, categoryId: 'inc_clients', note: 'Group class', date: today });
  ok('2. добавлены оплаты клиентов', St.transactions().filter(t => t.type === 'income').length === 4);

  St.addTransaction({ type: 'expense', amount: 400, categoryId: 'exp_workspace', note: 'Gym rent', date: today });
  St.addTransaction({ type: 'expense', amount: 55, categoryId: 'exp_transport', note: 'Transport', date: today });
  St.addTransaction({ type: 'expense', amount: 20, categoryId: 'exp_phone', note: 'Phone', date: today });
  ok('3. добавлены аренда зала, транспорт и телефон',
     St.transactions().filter(t => t.type === 'expense').length === 3);

  const m = W.MoneyModel.thisMonth(), all = St.transactions();
  ok('4. видно, сколько пришло', W.MoneyModel.monthlyIncome(all, m) === 225,
     String(W.MoneyModel.monthlyIncome(all, m)));
  ok('5. видно, сколько ушло', W.MoneyModel.monthlyExpenses(all, m) === 475);
  ok('6. видно, сколько осталось', W.MoneyModel.monthlyCashFlow(all, m) === -250);
  ok('7. дашборд заменил онбординг', D.getElementById('dash').hidden === false);
  ok('8. суммы месяца показаны на экране', D.getElementById('totals').textContent.trim().length > 10);
  ok('9. категории показаны', /Workspace rent|Transport/.test(D.getElementById('categories').textContent));

  St.addGoal({ name: 'Tax reserve', targetAmount: 900, monthlyContribution: 150, type: 'tax' });
  ok('10. налоговый резерв создан', St.goals().some(g => g.type === 'tax'));
  St.addGoal({ name: 'Emergency reserve', targetAmount: 1500, monthlyContribution: 100, type: 'emergency' });
  ok('11. резерв на чёрный день создан', St.goals().some(g => g.type === 'emergency'));

  /* Возвращается назавтра и добавляет ещё операцию — данные пережили сессию. */
  const t2 = await open('/money', { store, wait: 1600 });
  ok('12. данные пережили перезагрузку', t2.w.MoneyStore.transactions().length === 7,
     String(t2.w.MoneyStore.transactions().length));
  t2.w.MoneyStore.addTransaction({ type: 'income', amount: 60, categoryId: 'inc_clients', date: today });
  ok('13. новая операция добавлена при возврате', t2.w.MoneyStore.transactions().length === 8);
  ok('14. цели тоже сохранились', t2.w.MoneyStore.goals().length === 2);

  console.log('\n[Фитнес-тренер] Рынок не навязывается');
  const trainerText = text(t2.d);
  ok('15. нет призыва подключить брокера', !/connect a (verified )?broker/i.test(trainerText));
  ok('16. нет предложения купить крипту', !/buy (crypto|bitcoin)/i.test(trainerText));
  ok('17. нет утверждения «вам следует инвестировать»', !/you should invest/i.test(trainerText));
  ok('18. деньги не названы «простаивающими» без контекста',
     !/idle capital|money doing nothing/i.test(trainerText));
  const step = t2.w.MoneyStore.nextStep();
  ok('19. следующий шаг не ведёт в скринер',
     !/screener/i.test(step.route || ''), step.route || '—');
  ok('20. следующий шаг объяснён словами', typeof step.why === 'string' && step.why.length > 20);

  /* ------------------------------------------------------------ данные */

  console.log('\n[Данные] Один ключ, экспорт и удаление');
  ok('ключ один и версионированный', t2.w.MoneyStore.KEY === 'money_store_v1');
  ok('схема версионирована', t2.w.MoneyStore.state().schemaVersion >= 1);
  ok('экспорт в JSON работает', JSON.parse(t2.w.MoneyStore.exportJson()).transactions.length === 8);
  const csv = t2.w.MoneyStore.exportCsv();
  ok('экспорт в CSV работает', csv.split('\n').length === 9, String(csv.split('\n').length));
  ok('редактирование операции работает',
     !!t2.w.MoneyStore.updateTransaction(t2.w.MoneyStore.transactions()[0].id, { amount: 70 }));
  ok('удаление операции работает', t2.w.MoneyStore.removeTransaction(t2.w.MoneyStore.transactions()[0].id).length === 7);

  console.log('\n[Данные] Ничего не появляется само');
  const empty = await open('/money', { wait: 1400 });
  ok('у нового посетителя ноль операций', empty.w.MoneyStore.transactions().length === 0);
  ok('образец не загружается сам', !empty.w.MoneyStore.state().profile.sampleLoaded);
  empty.w.MoneyStore.loadSample();
  ok('образец загружается только по явному действию', empty.w.MoneyStore.transactions().length === 6);
  ok('операции образца помечены', empty.w.MoneyStore.transactions().every(t => t.sample === true));

  /* --------------------------------------------------------- миграция */

  console.log('\n[Миграция] Старый профиль Wealth не теряется');
  const legacyStore = new Map([['wealth_profile', JSON.stringify({
    stocks: 5000, crypto: 1000, bonds: 0, other: 0, cash: 800, deposit: 3000,
    currency: 'USD', goalName: 'New car', goalAmount: 12000
  })]]);
  const leg = await open('/money', { store: legacyStore, wait: 1600 });
  ok('старый профиль обнаружен', !!leg.w.MoneyStore.legacyPreview());
  ok('предпросмотр показан до импорта', leg.d.getElementById('legacyCard').hidden === false);
  ok('ничего не импортировано без нажатия', leg.w.MoneyStore.accounts().length === 1);
  const preview = leg.w.MoneyStore.legacyPreview();
  ok('предпросмотр перечисляет счета', preview.accounts.length === 4, String(preview.accounts.length));
  ok('предпросмотр называет цель', preview.goal?.amount === 12000);
  leg.w.MoneyStore.importLegacy();
  ok('после импорта счета созданы', leg.w.MoneyStore.accounts().length === 5,
     String(leg.w.MoneyStore.accounts().length));
  ok('цель перенесена', leg.w.MoneyStore.goals().some(g => g.name === 'New car'));
  ok('старый профиль не удалён', !!leg.store.get('wealth_profile'));

  /* -------------------------------------------------- режимы и маршруты */

  console.log('\n[Режимы] Одни и те же данные во всех режимах');
  const shared = new Map();
  const simple = await open('/money', { store: shared, wait: 1500 });
  simple.w.MoneyStore.addTransaction({ type: 'income', amount: 100, categoryId: 'inc_clients' });
  shared.set('ui_mode', 'pro');
  const pro = await open('/money', { store: shared, wait: 1500 });
  ok('переключение режима не теряет операции', pro.w.MoneyStore.transactions().length === 1);
  ok('Pro читает тот же ключ', pro.w.MoneyStore.KEY === simple.w.MoneyStore.KEY);

  console.log('\n[Маршруты] /money канонический, старые ведут на него');
  for (const [from, to] of [['/capital', '/money'], ['/capital/wealth', '/money']]) {
    const r = await fetch(B + from, { redirect: 'manual' });
    ok(`${from} → ${to}`, r.status === 301 && (r.headers.get('location') || '').endsWith(to),
       r.status + ' ' + r.headers.get('location'));
  }
  for (const path of ['/money', '/money/transactions', '/money/goals', '/money/safety', '/money/net-worth']) {
    const r = await fetch(B + path);
    ok(`${path} отвечает 200`, r.status === 200, String(r.status));
  }

  console.log('\n[Честность] Что обещано на экране');
  const honest = text((await open('/money', { wait: 1400 })).d);
  ok('сказано, что данные остаются в браузере', /stored in this browser|never sent anywhere/i.test(honest));
  ok('сказано, что это прототип', /prototype/i.test(honest));
  ok('сказано, что это не финансовый совет', /not financial advice|no.*advice/i.test(honest));

  console.log(`\n${pass} ok, ${fail} fail\n`);
  process.exit(fail ? 1 : 0);
})();
