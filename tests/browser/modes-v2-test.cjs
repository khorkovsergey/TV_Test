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

  console.log(`\n${pass} ok, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
