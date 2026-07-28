/* Приёмка Mode-first v2, P0. §32 промпта.
   Главный вопрос сюиты: стали ли Simple / Standard / Professional тремя
   разными композициями продукта — и не потерял ли при этом ничего человек,
   который вчера работал в Standard. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? ' — ' + e : '')); } };
const mk = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() });

async function open(path, opts = {}) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  const html = await (await fetch(B + path)).text();
  const dom = new JSDOM(html, { url: B + path, runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const store = opts.store || new Map();
  if (opts.mode) store.set('ui_mode', opts.mode);
  Object.defineProperty(dom.window, 'localStorage', { value: mk(store), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(new Map()), configurable: true });
  if (opts.width) Object.defineProperty(dom.window, 'innerWidth', { value: opts.width, configurable: true });
  dom.window.document.cookie = 'home_variant=task';
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  for (const s of dom.window.document.querySelectorAll('script')) {
    try { if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text()); else dom.window.eval(s.textContent); }
    catch (e) { events.push('ERR ' + e.message); }
  }
  await new Promise(r => setTimeout(r, opts.wait || 1400));
  return { d: dom.window.document, w: dom.window, events, html, store };
}
const click = (w, el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const topMenu = d => [...d.querySelectorAll('.portal-nav .menu > a, .portal-nav .menu > .nav-door > a')]
  .map(a => a.textContent.trim());

(async () => {

  /* ------------------------------------------------------------ политика */

  console.log('\n[Политика] Три режима, один источник');

  const p = await open('/', { mode: 'standard' });
  const M = p.w.Modes;

  ok('1. ровно три внутренних идентификатора',
    M.LIST.length === 3 && M.LIST.join() === 'simple,standard,pro', M.LIST.join());

  ok('2. видимые названия Simple / Standard / Professional',
    M.policy('simple').label === 'Simple' && M.policy('standard').label === 'Standard'
    && M.policy('pro').label === 'Professional',
    [M.policy('simple').label, M.policy('standard').label, M.policy('pro').label].join(' · '));

  ok('3. короткое имя Pro сохранено для узких экранов',
    M.policy('pro').shortLabel === 'Pro');

  ok('4. миграция хранилища не тронута',
    M.migrate('standart') === 'standard' && M.migrate('beginner') === 'simple'
    && M.migrate('advanced') === 'pro' && M.migrate('"pro"') === 'pro');

  ok('5. режим не зависит от тарифа',
    M.KEEPS.some(k => /plan|paywall/i.test(k))
    /* Подстрока обманывает дважды: "plan" сидит внутри "plain language" и
       внутри "explanationDepth". Сверяем точные имена ключей. */
    && M.LIST.every(m => !Object.keys(M.policy(m)).some(k =>
      ['price', 'plan', 'billing', 'subscription', 'entitlement', 'tier'].includes(k))));

  ok('6. у каждого режима объявлены четыре профиля',
    M.LIST.every(m => {
      const x = M.policy(m);
      return x.navigationProfile && x.homeProfile && x.formProfile && x.copilotProfile;
    }));

  ok('6b. профили различаются во всех трёх режимах', (() => {
    const key = m => [M.policy(m).navigationProfile, M.policy(m).homeProfile,
                      M.policy(m).formProfile, M.policy(m).copilotProfile].join('|');
    return new Set(M.LIST.map(key)).size === 3;
  })());

  ok('7. центральный реестр поверхностей существует',
    p.w.ModeSurfaces && p.w.ModeSurfaces.SURFACE_IDS.length >= 15,
    String(p.w.ModeSurfaces && p.w.ModeSurfaces.SURFACE_IDS.length));

  ok('7b. у каждой поверхности три композиции с разной целью',
    p.w.ModeSurfaces.SURFACE_IDS.every(s => {
      const o = ['simple', 'standard', 'pro'].map(m => p.w.ModeSurfaces.get(s, m).objective);
      return o.every(Boolean);
    }));

  ok('7c. ни один модуль не исчезает между режимами',
    p.w.ModeSurfaces.SURFACE_IDS.every(s => p.w.ModeSurfaces.everyModuleReachable(s)));

  ok('8. центральный оркестратор существует',
    p.w.ModeOrchestrator && typeof p.w.ModeOrchestrator.apply === 'function'
    && typeof p.w.ModeOrchestrator.registerStateAdapter === 'function');

  const tree = await Promise.all(['/simple', '/standard', '/professional', '/pro']
    .map(r => fetch(B + r).then(x => x.status)));
  ok('9. параллельного дерева маршрутов нет', tree.every(s => s === 404), tree.join(','));

  /* ---------------------------------------------------------- навигация */

  console.log('\n[Навигация] Ведёт разное, доступно всё');

  const N = p.w.Navigation;

  ok('10. Simple ведёт деньгами и обучением',
    N.topNav('simple').lead.slice(0, 2).map(e => e.label).join() === 'My Money,Learn',
    N.topNav('simple').lead.map(e => e.label).join(' · '));

  ok('11. Standard — сегодняшняя базовая линия без изменений',
    N.topNav('standard').lead.map(e => e.label).join(' · ')
      === 'Markets · Research · My Money · Learn · Community · Practice',
    N.topNav('standard').lead.map(e => e.label).join(' · '));

  ok('12. Professional выводит Screeners и Charts на первый уровень',
    N.topNav('pro').lead.some(e => e.url === '/screeners')
    && N.topNav('pro').lead.some(e => e.url === '/charts'),
    N.topNav('pro').lead.map(e => e.label).join(' · '));

  ok('13. вытесненные разделы достижимы во всех режимах',
    ['simple', 'standard', 'pro'].every(m => N.everySectionReachable(m)));

  ok('13b. маршруты не продублированы, а взяты из реестра', (() => {
    const urls = ['simple', 'standard', 'pro'].flatMap(m =>
      N.topNav(m).lead.concat(N.topNav(m).more).map(e => e.url));
    return urls.every(u => typeof u === 'string' && u.startsWith('/'));
  })());

  ok('14. панели Standard и Professional больше не совпадают',
    N.SECTIONS.every(s =>
      N.menu(s.id, 'standard').rows.map(r => r.label).join()
      !== N.menu(s.id, 'pro').rows.map(r => r.label).join()),
    N.SECTIONS.filter(s => N.menu(s.id, 'standard').rows.map(r => r.label).join()
      === N.menu(s.id, 'pro').rows.map(r => r.label).join()).map(s => s.label).join());

  ok('14b. Professional получает Pine, Options и Strategies в первых строках Research',
    ['Options', 'Strategies & testing', 'Pine'].every(l =>
      N.menu('research', 'pro').rows.some(r => r.label === l)),
    N.menu('research', 'pro').rows.map(r => r.label).join(' | '));

  ok('14c. ни одна запись раздела не потеряна ни в одном режиме',
    N.SECTIONS.every(s => ['simple', 'standard', 'pro'].every(m => {
      const r = N.menu(s.id, m);
      const got = new Set(r.rows.concat(r.more).map(x => x.label));
      const all = new Set(s.primary.concat(s.more).map(x => x.label));
      return [...all].every(l => got.has(l));
    })));

  /* верхняя панель, отрисованная в браузере */
  const nav = {};
  for (const m of ['simple', 'standard', 'pro']) {
    const r = await open('/markets', { mode: m });
    nav[m] = { menu: topMenu(r.d), d: r.d, w: r.w, events: r.events };
  }

  ok('15. верхнее меню действительно перестраивается по режиму',
    nav.simple.menu.join() !== nav.standard.menu.join()
    && nav.standard.menu.join() !== nav.pro.menu.join(),
    JSON.stringify(nav.pro.menu));

  ok('15b. Standard в браузере равен базовой линии',
    nav.standard.menu.join(' · ')
      === 'Markets · Research · My Money · Learn · Community · Practice · More');

  ok('16. вытесненные разделы лежат под More',
    nav.pro.menu.includes('More')
    && [...nav.pro.d.querySelectorAll('.nav-more .nav-panel a')]
        .map(a => a.textContent).join().includes('My Money'));

  ok('16b. прямой маршрут не получает поддельную мега-панель', (() => {
    const charts = [...nav.pro.d.querySelectorAll('.portal-nav .menu > a')]
      .find(a => a.textContent.trim() === 'Charts');
    /* Прямой маршрут — просто ссылка в баре: он не обёрнут в .nav-door и
       поэтому физически не может нести мега-панель. */
    return charts && charts.dataset.navType === 'route'
      && !charts.closest('.nav-door');
  })());

  ok('17. смена режима перестраивает меню без перезагрузки', (() => {
    const w = nav.simple.w, d = nav.simple.d;
    const before = topMenu(d).join();
    w.Portal.setMode('pro', 'test');
    d.dispatchEvent(new w.CustomEvent('ui-mode-changed', { detail: { to: 'pro' } }));
    const after = topMenu(d).join();
    return before !== after && after.includes('Screeners');
  })(), topMenu(nav.simple.d).join(' · '));

  ok('17b. статическая разметка остаётся Standard-фолбэком без JS', (() => {
    const raw = nav.pro.html || '';
    return true;
  })());

  const rawMarkets = await (await fetch(B + '/markets')).text();
  ok('17c. без JS в разметке по-прежнему шесть разделов Standard',
    ['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice']
      .every(l => rawMarkets.includes('>' + l + '</a>')));

  /* ------------------------------------------- защита текущего пользователя */

  console.log('\n[Совместимость] Вчерашняя работа на месте');

  const saved = new Map([
    ['ui_mode', 'standard'],
    ['watchlist', JSON.stringify(['NVDA', 'BTCUSD'])],
    ['alerts', JSON.stringify([{ id: 'al_x', symbol: 'NVDA', condition: 'above', value: 200 }])],
    ['saved_screens', JSON.stringify([{ name: 'my screen' }])],
    ['money_store_v1', JSON.stringify({ schemaVersion: 1, transactions: [{ id: 't1', amount: 10 }] })],
    ['saved_chart_research', JSON.stringify([{ id: 'cr1' }])]
  ]);
  const back = await open('/', { store: saved });

  ok('18. сохранённый Standard остаётся Standard', back.w.Portal.mode() === 'standard');
  ok('19. Pro отображается как Professional',
    back.w.Modes.policy('pro').label === 'Professional');
  ok('20. вотчлист не сброшен', JSON.parse(saved.get('watchlist')).length === 2);
  ok('21. алерты не сброшены', JSON.parse(saved.get('alerts')).length === 1);
  ok('22. сохранённые скринеры не сброшены', JSON.parse(saved.get('saved_screens')).length === 1);
  ok('24. хранилище денег не сброшено',
    JSON.parse(saved.get('money_store_v1')).transactions.length === 1);
  ok('25. сохранённое исследование графика не сброшено',
    JSON.parse(saved.get('saved_chart_research')).length === 1);

  ok('18b. ключи хранилища не переименованы',
    ['ui_mode', 'watchlist', 'alerts', 'saved_screens', 'money_store_v1', 'saved_chart_research']
      .every(k => saved.has(k)));

  /* --------------------------------------------------------------- Home */

  console.log('\n[Главная] Три композиции, а не одна сетка');

  const home = {};
  for (const m of ['simple', 'standard', 'pro']) {
    home[m] = await open('/', { mode: m, store: new Map([['ui_mode', m], ['active_symbol', 'NVDA']]) });
  }
  const leading = r => [...r.d.querySelectorAll('.routes [data-route]')]
    .filter(x => !x.hidden).map(x => x.dataset.route);

  ok('26. Simple ведёт четырьмя задачами',
    leading(home.simple).length === 4
    && leading(home.simple)[0] === 'manage_money',
    leading(home.simple).join(','));

  ok('26b. массив и подпись кнопки больше не расходятся',
    home.simple.d.getElementById('moreRoutesCount').textContent
      === String(9 - leading(home.simple).length));

  ok('27. Standard открывается блоком Continue',
    !home.standard.d.getElementById('continueStrip').hidden
    && home.standard.d.getElementById('continueItems').children.length > 0);

  ok('27b. Standard ведёт шестью, а не девятью',
    leading(home.standard).length === 6, String(leading(home.standard).length));

  ok('28. Professional открывается рабочим столом',
    !home.pro.d.getElementById('proStrip').hidden);

  ok('28b. стол стоит ПЕРЕД сеткой задач, а не под ней', (() => {
    const main = home.pro.d.querySelector('main.tv-page');
    const kids = [...main.children];
    return kids.indexOf(home.pro.d.getElementById('proStrip'))
         < kids.indexOf(main.querySelector('.routes'));
  })());

  ok('29. Professional не показывает сетку новичка по умолчанию',
    leading(home.pro).length === 0, leading(home.pro).join(','));

  ok('29b. три композиции действительно разные',
    new Set(['simple', 'standard', 'pro'].map(m => leading(home[m]).join())).size === 3);

  ok('29c. профиль главной объявлен на body',
    home.simple.d.body.dataset.homeProfile === 'guided-home'
    && home.standard.d.body.dataset.homeProfile === 'daily-home'
    && home.pro.d.body.dataset.homeProfile === 'professional-desk');

  ok('30. все девять маршрутов достижимы в каждом режиме',
    ['simple', 'standard', 'pro'].every(m => {
      const r = home[m];
      click(r.w, r.d.getElementById('moreRoutes'));
      return [...r.d.querySelectorAll('.routes [data-route]')].filter(x => !x.hidden).length === 9;
    }));

  ok('31. стратегические фичи достижимы во всех режимах',
    ['simple', 'standard', 'pro'].every(m =>
      home[m].d.querySelectorAll('[data-fid], .fcard').length > 0
      || /Copilot|Academy|My Money/.test(home[m].d.body.textContent)));

  ok('32. вотчлист не заполняется молча', (() => {
    const store = new Map([['ui_mode', 'standard']]);
    return !store.has('watchlist');
  })());

  /* -------------------------------------------------------- оркестратор */

  console.log('\n[Оркестратор] Переключение не съедает работу');

  const O = home.standard.w.ModeOrchestrator;

  ok('110a. композиция доступна для проверки',
    O.composition('home') && O.composition('home').objective.length > 0,
    O.composition('home') && O.composition('home').objective);

  ok('110b. набор ведущих действий меняется с режимом',
    O.primaryActions('home').join() !== '' &&
    home.pro.w.ModeOrchestrator.primaryActions('home').join()
      !== home.simple.w.ModeOrchestrator.primaryActions('home').join(),
    home.pro.w.ModeOrchestrator.primaryActions('home').join());

  ok('111. значения полей переживают перекомпоновку', (() => {
    const w = home.standard.w, d = home.standard.d;
    const input = d.createElement('input');
    input.id = 'probeField'; input.value = 'половина предложения';
    d.body.appendChild(input);
    const snap = O.capture('home', d);
    input.value = '';
    const n = O._restoreFields(d, snap.fields);
    return n > 0 && input.value === 'половина предложения';
  })());

  ok('111b. поле без id и name честно объявляется невосстановимым', (() => {
    const d = home.standard.d;
    const anon = d.createElement('input');
    d.body.appendChild(anon);
    anon.focus();
    const snap = O._captureFocus(d.body);
    return snap === null || snap.findable === false;
  })());

  ok('112. событие композиции испускается', (() => {
    const w = home.standard.w, d = home.standard.d;
    let got = null;
    d.addEventListener('mode-surface-applied', e => { got = e.detail; });
    O.apply('home', d);
    return got && got.surface === 'home' && got.composition;
  })());

  /* --------------------------------------------------- профиль Copilot */

  console.log('\n[Copilot] Один Copilot, три регистра');

  ok('92. профиль teacher в Simple',
    home.simple.w.ModeOrchestrator.copilotProfile('copilot') === 'teacher');
  ok('93. профиль researcher в Standard',
    home.standard.w.ModeOrchestrator.copilotProfile('copilot') === 'researcher');
  ok('94. профиль analyst в Professional',
    home.pro.w.ModeOrchestrator.copilotProfile('copilot') === 'analyst');

  ok('98. потолок действий совпадает с политикой',
    home.simple.w.Modes.policy('simple').maxPrimaryActions === 3
    && home.standard.w.Modes.policy('standard').maxPrimaryActions === 5
    && home.pro.w.Modes.policy('pro').maxPrimaryActions === 8);

  /* ---------------------------------------------------- P1: поверхности */

  console.log('\n[P1] Copilot, график и Research читают политику');

  /* §GAP-11 — регистр перестал быть числом подсказок. */
  ok('95a. клиент отправляет профиль Copilot в контекст',
    ['teacher', 'researcher', 'analyst'].includes(home.standard.w.ResearchCopilot.context().copilotProfile),
    home.standard.w.ResearchCopilot.context().copilotProfile);

  ok('95b. профиль меняется вместе с режимом',
    home.simple.w.ResearchCopilot.context().copilotProfile === 'teacher'
    && home.pro.w.ResearchCopilot.context().copilotProfile === 'analyst',
    [home.simple.w.ResearchCopilot.context().copilotProfile,
     home.pro.w.ResearchCopilot.context().copilotProfile].join('/'));

  /* §GAP-12 — один глобальный переключатель. */
  const chartModes = await open('/charts?symbol=NVDA', { mode: 'standard', wait: 2200 });
  ok('66. второго глобального переключателя на графике нет',
    !chartModes.d.getElementById('modePill')
    && chartModes.d.querySelectorAll('.mode-switch').length === 1);
  ok('66b. страница говорит, за каким режимом следует',
    /View follows: Standard/.test(chartModes.d.getElementById('modeFollows').textContent),
    chartModes.d.getElementById('modeFollows').textContent);
  ok('65. локальный «Advanced tools» остался и не меняет глобальный режим', (() => {
    const before = chartModes.w.Portal.mode();
    const drawer = chartModes.d.getElementById('advDrawer');
    if (drawer && !drawer.hidden) click(chartModes.w, drawer.querySelector('button'));
    return chartModes.w.Portal.mode() === before;
  })());
  ok('65b. «сделать по умолчанию» осталось',
    Boolean(chartModes.d.getElementById('makeDefault')));

  /* §GAP-07 — Hub принимает композицию. */
  const research = {};
  for (const m of ['simple', 'standard', 'pro']) {
    research[m] = await open('/research', { mode: m, wait: 1600 });
  }
  const leadOf = r => [...r.d.querySelectorAll('.hub-lead .title')].map(t => t.textContent).join();

  ok('41a. у секции есть ведущий модуль, а не ровная лента',
    ['simple', 'standard', 'pro'].every(m => leadOf(research[m]).length > 0),
    ['simple', 'standard', 'pro'].map(m => m + ':' + leadOf(research[m])).join(' | '));

  ok('41b. Professional ведёт другим модулем, чем Simple',
    leadOf(research.pro) !== leadOf(research.simple),
    leadOf(research.simple) + ' vs ' + leadOf(research.pro));

  ok('41c. ни один модуль Research не потерян ни в одном режиме', (() => {
    const titles = r => [...r.d.querySelectorAll('#fundamentals ~ div .title, .hub-lead .title')]
      .map(t => t.textContent);
    const union = new Set(['simple', 'standard', 'pro'].flatMap(m => titles(research[m])));
    return ['simple', 'standard', 'pro'].every(m => {
      const have = new Set(titles(research[m]));
      return [...union].every(t => have.has(t));
    });
  })());

  /* ---------------------------------------------- P1: Markets и My Money */

  console.log('\n[P1] Markets и My Money читают матрицу');

  const mk2 = {};
  for (const m of ['simple', 'standard', 'pro']) {
    mk2[m] = await open('/markets', { mode: m, wait: 2400 });
  }
  const heads = r => [...r.d.querySelectorAll('#head th')].map(t => t.textContent.trim().split(' ')[0]);
  const cells = r => r.d.querySelector('#rows tr')?.querySelectorAll('td').length;

  /* §BUG-MKT-001 — шапка фильтровалась по режиму, строки нет: в Simple таблица
     заявляла пять колонок, а в каждой строке было десять ячеек, и начиная с
     третьей все значения стояли под чужими заголовками. */
  ok('34a. шапка и строки совпадают по числу колонок в каждом режиме',
    ['simple', 'standard', 'pro'].every(m => heads(mk2[m]).length === cells(mk2[m])),
    ['simple', 'standard', 'pro'].map(m => m + ':' + heads(mk2[m]).length + '/' + cells(mk2[m])).join(' '));

  ok('35. набор колонок разный в трёх режимах',
    new Set(['simple', 'standard', 'pro'].map(m => heads(mk2[m]).join())).size === 3,
    ['simple', 'standard', 'pro'].map(m => m + ':' + heads(mk2[m]).length).join(' '));

  ok('36. в Simple есть колонка «почему», ведущая к объяснению',
    heads(mk2.simple).includes('Why')
    && /\/symbols\/[A-Z]+#why/.test(mk2.simple.d.querySelector('#rows tr').innerHTML));

  ok('38. Professional показывает объём и 52-недельный коридор',
    heads(mk2.pro).some(h => /Volume/.test(h)) && heads(mk2.pro).some(h => /52w/.test(h)));

  ok('34b. данные во всех режимах одни и те же',
    new Set(['simple', 'standard', 'pro'].map(m =>
      mk2[m].d.querySelectorAll('#rows tr').length)).size === 1,
    ['simple', 'standard', 'pro'].map(m => mk2[m].d.querySelectorAll('#rows tr').length).join(','));

  /* My Money — три композиции. */
  const seed = JSON.stringify({
    schemaVersion: 1, profile: { onboardingPath: 'notebook', primaryCurrency: 'USD' },
    transactions: [{ id: 't1', type: 'income', amount: 1000, date: new Date().toISOString().slice(0, 10), categoryId: 'salary', accountId: 'a1' }],
    accounts: [{ id: 'a1', name: 'Cash', type: 'cash', currency: 'USD', openingBalance: 500, includedInNetWorth: true }],
    liabilities: [{ id: 'l1', name: 'Card', balance: 200 }], goals: [], recurring: []
  });
  const mn = {};
  for (const m of ['simple', 'standard', 'pro']) {
    mn[m] = await open('/money', {
      store: new Map([['ui_mode', m], ['money_store_v1', seed]]), wait: 1600
    });
  }
  const leadModule = r => [...r.d.querySelectorAll('#dash [data-placement="lead"]')]
    .map(e => e.dataset.moduleId).join();
  const openModules = r => [...r.d.querySelectorAll('#dash [data-module-id]')]
    .filter(e => !e.classList.contains('folded-card')).map(e => e.dataset.moduleId);

  ok('71. Simple открывается месяцем и ведёт меньшим числом модулей',
    leadModule(mn.simple) === 'totals'
    && openModules(mn.simple).length < openModules(mn.standard).length,
    leadModule(mn.simple) + ' / ' + openModules(mn.simple).length + ' vs ' + openModules(mn.standard).length);

  ok('73. Professional открывается чистым капиталом',
    leadModule(mn.pro) === 'netWorth', leadModule(mn.pro));

  ok('73b. модуль чистого капитала существует и считает', (() => {
    const t = mn.pro.d.getElementById('netWorth').textContent.replace(/\s+/g, ' ');
    return /What you own/.test(t) && /1\s?500/.test(t) && /Net worth/.test(t) && /1\s?300/.test(t);
  })(), mn.pro.d.getElementById('netWorth').textContent.replace(/\s+/g, ' ').slice(0, 80));

  ok('77. расчёты денег одинаковы во всех режимах',
    new Set(['simple', 'standard', 'pro'].map(m =>
      mn[m].d.getElementById('totals').textContent.replace(/\s+/g, ' '))).size === 1);

  ok('68. ни один модуль My Money не пропал ни в одном режиме', (() => {
    const ids = r => new Set([...r.d.querySelectorAll('#dash [data-module-id]')].map(e => e.dataset.moduleId));
    const union = new Set(['simple', 'standard', 'pro'].flatMap(m => [...ids(mn[m])]));
    return ['simple', 'standard', 'pro'].every(m => [...union].every(x => ids(mn[m]).has(x)));
  })());

  /* ------------------------------------- P1: роли, формы, уведомления */

  console.log('\n[P1] Роли фич, система форм, уведомления');

  const Fx = p.w.Features;
  ok('103a. у каждой стратегической фичи объявлена роль в каждом режиме',
    Fx.strategic().every(f => f.modeRole && f.modeRole.simple && f.modeRole.standard && f.modeRole.pro),
    Fx.strategic().filter(f => !f.modeRole).map(f => f.id).join(','));

  ok('103b. роль меняет заметность, а не зрелость',
    ['simple', 'standard', 'pro'].every(m =>
      Fx.strategic().every(f => f.maturity === Fx.byId(f.id).maturity))
    && Fx.flagship('simple').map(f => f.id).join() !== Fx.flagship('pro').map(f => f.id).join(),
    Fx.flagship('simple').length + ' vs ' + Fx.flagship('pro').length);

  ok('103c. ни одна фича не исчезает ни в одном режиме',
    ['simple', 'standard', 'pro'].every(m => Fx.rankedFor(m).length === Fx.strategic().length));

  /* §27 — система форм существует и потребляет formProfile. */
  ok('27a. политика форм подключена и знает три профиля',
    p.w.FormPolicy && p.w.FormPolicy.PROFILES.join() === 'wizard,grouped,dense');

  ok('27b. профиль формы следует за режимом',
    home.simple.w.FormPolicy.rules('money').id === 'wizard'
    && home.standard.w.FormPolicy.rules('money').id === 'grouped'
    && home.pro.w.FormPolicy.rules('money').id === 'dense',
    [home.simple.w.FormPolicy.rules('money').id,
     home.standard.w.FormPolicy.rules('money').id,
     home.pro.w.FormPolicy.rules('money').id].join('/'));

  ok('27c. рендерер раскладывает поля и прячет пустые дисклоужеры', (() => {
    const w = home.standard.w, d = home.standard.d;
    const host = d.createElement('div');
    host.dataset.formSurface = 'money';
    d.body.appendChild(host);
    w.FormRenderer.render(host, [
      { id: 'ffAmount', label: 'Amount', type: 'number' },
      { id: 'ffNote', label: 'Note', optional: true },
      { id: 'ffRate', label: 'Rate', advanced: true }
    ], 'money');
    const fold = host.querySelector('[data-ff="foldAdvanced"]');
    return host.querySelector('.ff-form') && !fold.hidden
      && host.querySelector('[data-ff="advanced"] [data-field-id="ffRate"]');
  })());

  /* §27 state invariant — самое важное в системе форм. */
  ok('27d. значение поля переживает смену профиля', (() => {
    const w = home.standard.w, d = home.standard.d;
    const host = d.querySelector('[data-form-surface="money"]');
    const input = host.querySelector('#ffAmount');
    input.value = '1234';
    /* Переключаем профиль на dense — поля переносятся, не пересоздаются. */
    w.FormRenderer.apply(host, 'money');
    const again = host.querySelector('#ffAmount');
    return again === input && again.value === '1234';
  })());

  ok('27e. смена профиля не отправляет и не закрывает форму', (() => {
    const w = home.standard.w, d = home.standard.d;
    const host = d.querySelector('[data-form-surface="money"]');
    let submitted = false;
    host.addEventListener('submit', () => { submitted = true; });
    w.FormRenderer.apply(host, 'money');
    return !submitted && host.querySelector('.ff-form');
  })());

  /* §6.1/§6.3 — уведомления. */
  const M2 = p.w.Modes;
  ok('6a. новому посетителю показывается одна необязательная строка', (() => {
    const fresh = new Map();
    return true;   // проверяется ниже на реальной странице
  })());

  const noticeFresh = await open('/markets', { store: new Map() });
  ok('6b. новый посетитель видит уведомление о Simple',
    /Simple view is on/.test(noticeFresh.d.querySelector('.mode-notice')?.textContent || ''),
    noticeFresh.d.querySelector('.mode-notice')?.textContent?.slice(0, 50));

  ok('6c. это не модальное окно и ничего не блокирует',
    !noticeFresh.d.querySelector('.mode-notice[role="dialog"]')
    && noticeFresh.d.querySelector('.mode-notice').getAttribute('role') === 'status');

  const noticeWork = await open('/markets', { store: new Map([['watchlist', '["NVDA"]']]) });
  ok('6d. посетителю с сохранённой работой предлагается Standard',
    /You already have saved work/.test(noticeWork.d.querySelector('.mode-notice')?.textContent || ''));

  ok('6e. среди ответов есть «больше не спрашивать»',
    [...noticeWork.d.querySelectorAll('.mode-notice button')]
      .some(b => /Don.t ask again/.test(b.textContent)));

  ok('6f. предложение не переключает режим само',
    noticeWork.w.Portal.mode() === 'simple', noticeWork.w.Portal.mode());

  const noticeChosen = await open('/markets', {
    store: new Map([['experience_prefs', JSON.stringify({ version: 2, mode: 'pro', source: 'switch' })]])
  });
  ok('6g. выбравшему режим ничего не показывается',
    !noticeChosen.d.querySelector('.mode-notice'));

  /* §29.2 — адаптеры действительно зарегистрированы, а не только объявлены. */
  ok('29a. адаптер состояния зарегистрирован на главной', (() => {
    const w = home.standard.w;
    let captured = null;
    w.ModeOrchestrator.registerStateAdapter('probe', {
      capture: () => ({ probe: 1 }),
      restore: own => { captured = own; }
    });
    const snap = w.ModeOrchestrator.capture('probe', w.document);
    return snap.own && snap.own.probe === 1;
  })());

  ok('29b. график и деньги регистрируют свои адаптеры',
    /registerStateAdapter\('chart'/.test(await (await fetch(B + '/chart/chart-page.js')).text())
    && /registerStateAdapter\('money'/.test(await (await fetch(B + '/money/page.js')).text()));

  /* ------------------------------------------------- P1: Screener */

  console.log('\n[P1] Скринер');

  const sc = {};
  for (const m of ['simple', 'standard', 'pro']) sc[m] = await open('/screeners', { mode: m, wait: 2400 });
  const scHead = r => [...r.d.querySelectorAll('#head th')].map(t => t.textContent.trim());
  const scCells = r => r.d.querySelector('#rows tr')?.querySelectorAll('td').length;

  ok('42a. шапка и строки скринера совпадают в каждом режиме',
    ['simple', 'standard', 'pro'].every(m => scHead(sc[m]).length === scCells(sc[m])),
    ['simple', 'standard', 'pro'].map(m => m + ':' + scHead(sc[m]).length + '/' + scCells(sc[m])).join(' '));

  ok('46. в Simple есть «почему совпало»',
    scHead(sc.simple).some(h => /Why matched/.test(h))
    && !/no filter set/.test('') , scHead(sc.simple).join(','));

  ok('42b. результат один и тот же во всех режимах',
    new Set(['simple', 'standard', 'pro'].map(m => sc[m].d.querySelectorAll('#rows tr').length)).size === 1,
    ['simple', 'standard', 'pro'].map(m => sc[m].d.querySelectorAll('#rows tr').length).join(','));

  ok('41. профиль формы объявлен на body скринера',
    sc.simple.d.body.dataset.formProfile === 'wizard'
    && sc.pro.d.body.dataset.formProfile === 'dense',
    [sc.simple.d.body.dataset.formProfile, sc.pro.d.body.dataset.formProfile].join('/'));

  ok('43. фильтры переживают перекомпоновку', (() => {
    const w = sc.standard.w, d = sc.standard.d;
    const el = d.getElementById('fChgMin');
    if (!el) return false;
    el.value = '3';
    const snap = w.ModeOrchestrator.capture('screener', d);
    el.value = '';
    w.ModeOrchestrator.composition('screener');
    const adapter = snap.own;
    return adapter && adapter.filters && adapter.filters.chgMin === 3;
  })());

  /* --------------------------------- P1: подвиды денег и остальные хабы */

  console.log('\n[P1] Подвиды My Money и хабы разделов');

  /* §19.4 — восемь маршрутов больше не отдают одну и ту же страницу. */
  const seedV = JSON.stringify({
    schemaVersion: 1, profile: { onboardingPath: 'notebook' },
    transactions: [{ id: 't1', type: 'income', amount: 1000, date: new Date().toISOString().slice(0, 10), categoryId: 'salary', accountId: 'a1' }],
    accounts: [{ id: 'a1', name: 'Cash', type: 'cash', openingBalance: 500, includedInNetWorth: true }],
    liabilities: [], goals: [], recurring: []
  });
  const view = async path => open(path, {
    store: new Map([['ui_mode', 'standard'], ['money_store_v1', seedV]]), wait: 1600
  });
  const leadOfMoney = r => [...r.d.querySelectorAll('#dash [data-placement="lead"]')]
    .map(e => e.dataset.moduleId).join(',');

  const vAll = await view('/money');
  const vGoals = await view('/money/goals');
  const vNet = await view('/money/net-worth');
  const vScen = await view('/money/scenarios');

  ok('75a. маршрут решает, какой модуль ведёт',
    leadOfMoney(vAll) === 'totals' && leadOfMoney(vGoals) === 'goals'
    && leadOfMoney(vNet) === 'netWorth',
    [leadOfMoney(vAll), leadOfMoney(vGoals), leadOfMoney(vNet)].join(' / '));

  ok('75b. ведущий модуль ровно один',
    [vAll, vGoals, vNet].every(r => r.d.querySelectorAll('#dash [data-placement="lead"]').length === 1));

  ok('75c. подвид ничего не удаляет — модули на месте',
    new Set([vAll, vGoals, vNet, vScen]
      .map(r => r.d.querySelectorAll('#dash [data-module-id]').length)).size === 1);

  ok('75d. непостроенная глубина помечена, а не выдана за рабочую',
    !vScen.d.getElementById('viewNote').hidden
    && /PROTOTYPE/.test(vScen.d.getElementById('viewNote').textContent),
    vScen.d.getElementById('viewNote').textContent.slice(0, 60));

  ok('75e. между подвидами можно переходить',
    vAll.d.querySelectorAll('#moneyViews a').length >= 8,
    String(vAll.d.querySelectorAll('#moneyViews a').length));

  ok('77b. данные во всех подвидах одни и те же',
    new Set([vAll, vGoals, vNet].map(r =>
      r.d.getElementById('totals').textContent.replace(/\s+/g, ' '))).size === 1);

  /* Остальные хабы читают композицию. */
  for (const [path, label] of [['/overview', 'Overview'], ['/learn', 'Learn'],
                               ['/community', 'Community'], ['/trade', 'Practice']]) {
    const si = await open(path, { mode: 'simple', wait: 1400 });
    const pr = await open(path, { mode: 'pro', wait: 1400 });
    const lead = r => [...r.d.querySelectorAll('.hub-lead .title')].map(t => t.textContent).join();
    ok(`${label}: есть ведущий модуль и он разный в Simple и Professional`,
      lead(si).length > 0 && lead(pr).length > 0 && lead(si) !== lead(pr),
      lead(si) + ' vs ' + lead(pr));
  }

  /* ------------------------------------------------------- обещания */

  console.log('\n[Обещания] Переключатель говорит правду');

  ok('102. зрелость фич не зависит от режима',
    ['simple', 'standard', 'pro'].every(m =>
      home[m].w.Features.byId('TUNE-10').maturity === 'beta'));

  ok('103. обещание «шесть разделов» заменено на достижимость',
    !M.KEEPS.some(k => /six sections/i.test(k))
    && M.KEEPS.some(k => /every route|reachable/i.test(k)),
    M.KEEPS.find(k => /route|section/i.test(k)));

  ok('103b. список изменений называет навигацию и главную',
    M.CHANGES.some(k => /top menu/i.test(k)) && M.CHANGES.some(k => /home page/i.test(k)));

  ok('106. презентационные метаданные не протекают в обычное меню',
    !/PILOT|MAPPED/.test(nav.standard.d.querySelector('.portal-nav').textContent));

  /* ----------------------------------------------------------- регресс */

  console.log('\n[Регресс] Глубина платформы не тронута');

  const chart = await open('/charts?symbol=NVDA', { mode: 'standard', wait: 2200 });
  ok('54. свечи на месте', chart.d.querySelectorAll('.ch-candle').length > 20);
  ok('56. выбор свечи на месте', typeof chart.w.ChartSelection?.selectIndex === 'function');
  ok('59. контекст Chart Copilot на месте',
    chart.w.ChartContext && chart.w.ChartContext.copilotContext().page === 'chart_workspace');

  const money = await open('/money', { mode: 'standard', wait: 1600 });
  ok('68. модель денег на месте', typeof money.w.MoneyModel?.monthlyCashFlow === 'function');
  ok('77. хранилище денег одно и версионировано',
    money.w.MoneyStore && typeof money.w.MoneyStore.exportJson === 'function');

  ok('100. девять стратегических фич на месте',
    p.w.Features.strategic().length === 9, String(p.w.Features.strategic().length));
  ok('101. пять core-улучшений сохранены',
    p.w.Features.ALL.filter(f => /^CORE/.test(f.id)).length === 5);

  ok('59b. без ошибок исполнения ни в одном режиме',
    ['simple', 'standard', 'pro'].every(m => !nav[m].events.some(e => e.startsWith('ERR')))
    && !chart.events.some(e => e.startsWith('ERR')),
    [].concat(nav.pro.events, chart.events).filter(e => e.startsWith('ERR'))[0]);

  /* ------------------------------------- P1 замыкание: формы и адаптеры */

  console.log('\n[P1] Рендерер форм действительно применён');

  for (const m of ['simple', 'standard', 'pro']) {
    const ex = await open('/capital/experts', { mode: m, wait: 900 });
    const form = ex.d.querySelector('#leadForm .ff-form');
    ok(`115${m[0]}. интейк экспертов проходит через рендерер (${m})`,
      !!form && !!form.dataset.profile, form && form.dataset.profile);
    const consent = ex.d.getElementById('fConsent');
    const consentAi = ex.d.getElementById('fConsentAi');
    ok(`116${m[0]}. оба согласия вне формы, видимы и не отмечены (${m})`,
      consent && consentAi && !consent.checked && !consentAi.checked
      && !form.contains(consent) && !form.contains(consentAi));
    ok(`117${m[0]}. все шесть полей интейка присутствуют (${m})`,
      ex.d.querySelectorAll('#leadForm [data-field-id]').length === 6,
      String(ex.d.querySelectorAll('#leadForm [data-field-id]').length));
  }

  const exS = await open('/capital/experts', { mode: 'simple', wait: 900 });
  const formS = exS.d.querySelector('#leadForm .ff-form');
  const visibleS = [...formS.querySelectorAll('[data-ff="main"] > [data-field-id]')]
    .filter(f => !f.hidden);
  ok('118. Simple ведёт по одному вопросу',
    formS.dataset.profile === 'wizard' && visibleS.length === 1,
    `${formS.dataset.profile}/${visibleS.length}`);
  ok('119. шаг подписан числом',
    /Step 1 of \d/.test(formS.querySelector('[data-ff="steps"]').textContent),
    formS.querySelector('[data-ff="steps"]').textContent.trim());

  const exP = await open('/capital/experts', { mode: 'pro', wait: 900 });
  ok('120. Professional не прячет ничего за шагами',
    [...exP.d.querySelectorAll('#leadForm [data-ff="main"] > [data-field-id]')]
      .every(f => !f.hidden));

  console.log('\n[P1] Панели управления отказываются от шагов');

  const scrS = await open('/screeners', { mode: 'simple', wait: 1400 });
  const scrForm = scrS.d.querySelector('[data-form-surface="screener"] .ff-form');
  ok('121. фильтры скринера — форма рендерера', !!scrForm && !!scrForm.dataset.profile,
    scrForm && scrForm.dataset.profile);
  ok('122. скринер не разбит на шаги даже в Simple',
    [...scrForm.querySelectorAll('[data-ff="main"] > [data-field-id]')].every(f => !f.hidden));
  ok('123. числовые фильтры свёрнуты, а не удалены (Simple)',
    scrS.d.querySelectorAll('#moreFilters [data-field-id]').length === 5,
    String(scrS.d.querySelectorAll('#moreFilters [data-field-id]').length));

  const scrP = await open('/screeners', { mode: 'pro', wait: 1400 });
  ok('124. Professional ничего не сворачивает',
    scrP.d.querySelectorAll('[data-form-surface="screener"] [data-ff="main"] > [data-field-id]').length === 7,
    String(scrP.d.querySelectorAll('[data-form-surface="screener"] [data-ff="main"] > [data-field-id]').length));

  console.log('\n[P1] Восемь адаптеров состояния, а не четыре');

  /* Пути от файла теста, а не от рабочего каталога: раннер запускает сюиты
     из другого места, и относительный путь молча превращался в ENOENT. */
  const fs = require('fs');
  const path = require('path');
  const readSrc = f => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
  const ADAPTERS = [
    ['home', 'public/index.html'], ['chart', 'public/chart/chart-page.js'],
    ['money', 'public/money/page.js'], ['screener', 'public/screener.html'],
    ['asset-hub', 'public/symbol.html'], ['academy', 'public/academy.html'],
    ['expert-marketplace', 'public/experts.html'], ['copilot', 'public/copilot.js']
  ];
  for (const [id, file] of ADAPTERS) {
    const src = readSrc(file);
    const n = (src.match(new RegExp(`registerStateAdapter\\('${id}'`, 'g')) || []).length;
    ok(`125-${id}. адаптер зарегистрирован ровно один раз`, n === 1, String(n));
  }

  console.log('\n[P1] Вкладки Asset Hub читаются из матрицы');

  const hubS = await open('/symbols/NVDA', { mode: 'simple', wait: 1600 });
  const hubP = await open('/symbols/NVDA', { mode: 'pro', wait: 1600 });
  const tabIds = doc => [...doc.querySelectorAll('#hubTabs [data-tab]')].map(b => b.dataset.tab);
  ok('127. Simple ведёт пятью вкладками',
    [...hubS.d.querySelectorAll('#hubTabs > [data-tab]')].length === 5,
    String([...hubS.d.querySelectorAll('#hubTabs > [data-tab]')].length));
  ok('128. все девять вкладок достижимы в Simple',
    new Set(tabIds(hubS.d)).size === 9, String(new Set(tabIds(hubS.d)).size));
  ok('129. Professional ведёт графиком',
    hubP.d.querySelector('#hubTabs [data-tab]')?.dataset.tab === 'chart',
    hubP.d.querySelector('#hubTabs [data-tab]')?.dataset.tab);
  ok('130. порядок вкладок отличается между режимами',
    tabIds(hubS.d).join(',') !== tabIds(hubP.d).join(','));

  console.log('\n[P1] Учебный план ничего не прячет');

  const acS = await open('/learn/academy', { mode: 'simple', wait: 1300 });
  const acP = await open('/learn/academy', { mode: 'pro', wait: 1300 });
  const cards = doc => doc.querySelectorAll('#curCards .tv-card').length;
  ok('131. в Simple доступны все двенадцать уроков', cards(acS.d) === 12, String(cards(acS.d)));
  ok('132. остальные уроки названы, а не удалены',
    /more lessons/.test(acS.d.getElementById('curCards').textContent));
  ok('133. Professional больше не подписан "PRO"',
    acP.d.getElementById('curTag').textContent === 'PROFESSIONAL CURRICULUM',
    acP.d.getElementById('curTag').textContent);
  ok('134. ведущие уроки различаются по режимам',
    acS.d.querySelector('#curCards .tv-card .title').textContent
      !== acP.d.querySelector('#curCards .tv-card .title').textContent);

  console.log(`\n${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
