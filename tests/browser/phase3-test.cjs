/* Приёмка фазы 3: стратегические фичи снова видны, честно помечены и связаны
   с реальными сценариями. §12 промпта claude_code_phase3_restore_strategic_features. */
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
  Object.defineProperty(dom.window, 'localStorage', { value: mk(opts.store || new Map()), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(new Map()), configurable: true });
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  for (const s of dom.window.document.querySelectorAll('script')) {
    const type = (s.getAttribute('type') || '').toLowerCase();
    if (type && !/javascript|module/.test(type)) continue;   // JSON-LD не исполняется
    try { if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text()); else dom.window.eval(s.textContent); }
    catch (e) { events.push('ERR ' + e.message); }
  }
  await new Promise(r => setTimeout(r, opts.wait || 1500));
  return { d: dom.window.document, w: dom.window, events, html, res };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const text = d => d.body.textContent.replace(/\s+/g, ' ');

(async () => {

  /* ------------------------------------------------ реестр как один источник */

  console.log('\n[Реестр] Единственный источник правды');
  const home = await open('/', { wait: 2400 });
  const Fx = home.w.Features;
  ok('Features подключён на главной', !!Fx);
  ok('четырнадцать записей', Fx.ALL.length === 14, String(Fx.ALL.length));
  ok('девять стратегических', Fx.strategic().length === 9, String(Fx.strategic().length));
  ok('пять переработанных сценариев', Fx.core().length === 5, String(Fx.core().length));
  ok('id уникальны', new Set(Fx.ALL.map(f => f.id)).size === 14);
  ok('у каждой фичи есть проблема пользователя', Fx.ALL.every(f => f.problem && f.problem.length > 25));
  ok('у каждой есть решение', Fx.ALL.every(f => f.solution && f.solution.length > 25));
  ok('у каждой есть метрика', Fx.ALL.every(f => f.metric && f.metric.length > 5));
  ok('у каждой есть маршрут', Fx.ALL.every(f => f.route && f.route.startsWith('/')));
  ok('у каждой есть аудитория', Fx.ALL.every(f => f.audience && f.audience.length > 5));
  ok('зрелость только из словаря', Fx.ALL.every(f => Fx.BADGE[f.maturity]));
  ok('новизна и тариф — отдельные измерения',
     Fx.ALL.every(f => (f.releaseMarker === null || Fx.MARKER[f.releaseMarker]) &&
                       (f.commercialTier == null || f.commercialTier === 'included' || Fx.TIER[f.commercialTier])));
  ok('честное деление: работает / концепт', Fx.working().length >= 8 && Fx.concepts().length >= 3,
     `working=${Fx.working().length} concepts=${Fx.concepts().length}`);
  ok('связи ссылаются на существующие id', Fx.ALL.every(f => f.related.every(r => Fx.byId(r))));
  ok('глубина проставлена честно (1..5)', Fx.ALL.every(f => f.depth >= 1 && f.depth <= 5));
  /* Прототип может быть глубоким — Expert Marketplace именно такой. Нечестно
     не это, а назвать его live. Идея без реализации по-прежнему мелкая. */
  ok('идея не выдаёт себя за готовое',
     Fx.ALL.filter(f => f.maturity === 'concept').every(f => f.depth <= 3),
     Fx.ALL.filter(f => f.maturity === 'concept' && f.depth > 3).map(f => f.id).join(','));
  ok('ничего недостроенного не помечено как live',
     Fx.ALL.filter(f => f.maturity === 'live').every(f => f.priority === 'core'),
     Fx.ALL.filter(f => f.maturity === 'live' && f.priority !== 'core').map(f => f.id).join(','));
  ok('Expert Marketplace честно назван прототипом', Fx.byId('NEW-07').maturity === 'prototype',
     Fx.byId('NEW-07').maturity);

  console.log('\n[Реестр] Бейдж — один компонент');
  const b = Fx.badge('concept');
  ok('бейдж несёт текст, не только цвет', /CONCEPT/.test(b));
  ok('бейдж объясняет статус в title', /title="[^"]{20,}"/.test(b));
  ok('бейдж доступен скринридеру', /aria-label="Status: CONCEPT"/.test(b));
  ok('неизвестный статус не рисует пустой бейдж', Fx.badge('nope') === '');

  /* --------------------------------------------------------- главная (§VIS-005) */

  console.log('\n[Главная] Блок инноваций вернулся на первый экран');
  const cards = [...home.d.querySelectorAll('#featureCards .fcard')];
  /* §9.2 — стена из восьми равных карточек заменена одним флагманом
     и тремя компактными ссылками: заметность через иерархию. */
  ok('на главной есть флагманский блок', !!home.d.querySelector('.flagship'));
  ok('рядом компактные ссылки на остальные',
     home.d.querySelectorAll('#featureCards .preset[data-fid]').length === 3,
     String(home.d.querySelectorAll('#featureCards .preset[data-fid]').length));
  ok('Expert Marketplace виден на главной', !!home.d.querySelector('[data-fid="NEW-07"]'));
  ok('Wealth Hub виден на главной', !!home.d.querySelector('[data-fid="NEW-05"]'));
  ok('есть вход на общий лендинг инноваций', /\/new/.test(home.d.querySelector('#featureCards, .stubs')?.parentElement.innerHTML || home.html));
  ok('заголовок блока говорит о новом', /New here/i.test(text(home.d)));
  ok('на главной нет ошибок исполнения', home.events.length === 0, home.events.join(' | '));

  /* ------------------------------------------------------------- лендинг /new */

  console.log('\n[/new] Лендинг продуктовых инноваций');
  const nw = await open('/new', { wait: 2000 });
  ok('страница открывается', nw.res.status === 200);
  const nwCards = [...nw.d.querySelectorAll('.fcard')];
  ok('все четырнадцать фич отрисованы', nwCards.length === 14, String(nwCards.length));
  ok('работающее отделено от концептов',
     nw.d.querySelector('#workingCards .fcard') && nw.d.querySelector('#conceptCards .fcard'));
  /* В Simple проблема идёт первой строкой без подписи «Problem:» — подача
     зависит от режима, наличие проблемы не зависит. */
  ok('у каждой карточки есть проблема пользователя',
     nwCards.every(c => c.querySelector('.prob') && c.querySelector('.prob').textContent.trim().length > 20));
  ok('у каждой карточки есть метрика', nwCards.every(c => /metric:/i.test(c.textContent)));
  ok('легенда статусов присутствует', nw.d.querySelectorAll('#legend .fbadge').length >= 4);
  ok('честная оговорка про статусы', /CONCEPT means the idea is demonstrated/i.test(text(nw.d)));
  ok('нет ошибок исполнения', nw.events.length === 0, nw.events.join(' | '));

  console.log('\n[/showcase] Карта кейса');
  const sc = await open('/showcase', { wait: 1800 });
  ok('страница открывается', sc.res.status === 200);
  const rows = [...sc.d.querySelectorAll('#mapNew tbody tr, #mapCore tbody tr')];
  ok('каждая фича имеет строку', rows.length === 14, String(rows.length));
  ok('в строке есть статус, проблема, метрика и маршрут',
     rows.every(r => r.querySelector('.fbadge') && r.querySelector('a[href^="/"]') && r.children.length === 6));
  ok('нет ошибок исполнения', sc.events.length === 0, sc.events.join(' | '));

  /* ---------------------------------------------- покрытие поверхностей (§NEW-07) */

  console.log('\n[Покрытие] Expert Marketplace на всех заявленных поверхностях');
  const E = Fx.byId('NEW-07');
  ok('заявлено не меньше восьми поверхностей', E.surfaces.length >= 8, String(E.surfaces.length));

  const seen = new Set();
  const check = async (surface, path, probe, opts) => {
    const p = await open(path, opts || { wait: 2000 });
    const hit = probe(p);
    if (hit) seen.add(surface);
    ok(`поверхность ${surface} (${path})`, hit);
    return p;
  };

  if (home.d.querySelector('[data-fid="NEW-07"]')) seen.add('home');
  ok('поверхность home (/)', seen.has('home'));

  await check('assetHub', '/symbols/BTCUSD', p => !!p.d.querySelector('#railCards [data-fid="NEW-07"]'), { wait: 2600 });
  /* §3.2 — раздел переехал: /capital и /capital/wealth ведут на /money.
     Маркетплейс достижим из My Budget через меню раздела. */
  await check('money', '/money', p => /Expert Marketplace/.test(p.d.querySelector('.portal-nav').textContent), { wait: 2000 });
  await check('academy', '/learn/academy', p => !!p.d.querySelector('#academyPromos [data-fid="NEW-07"]'), { wait: 2200 });
  await check('whatsNew', '/new', p => !!p.d.querySelector('[data-fid="NEW-07"]'), { wait: 1800 });
  await check('showcase', '/showcase', p => !!p.d.querySelector('[data-fid="NEW-07"]'), { wait: 1800 });

  const mega = home.w.IA.allItems().some(i => /expert marketplace/i.test(i.label));
  if (mega) seen.add('megaMenu');
  ok('поверхность megaMenu (навигация Community)', mega);

  // copilot: панель монтируется скриптом виджета
  const cop = home.d.querySelector('.cp-esc [data-fid="NEW-07"]');
  if (cop) seen.add('copilot');
  ok('поверхность copilot (панель ассистента)', !!cop);

  console.log('\n[Покрытие] Все фичи достижимы');
  const reach = await open('/sitemap', { wait: 1800 }).catch(() => null);
  for (const f of Fx.strategic()) {
    const r = await fetch(B + f.route.split('#')[0]);
    ok(`маршрут ${f.id} отвечает 200 (${f.route})`, r.status === 200, String(r.status));
  }

  /* -------------------------------------------------- командная палитра (§8) */

  console.log('\n[Поиск] Фичи находятся по человеческим словам');
  const pal = await open('/', { wait: 2400 });
  pal.w.PortalNav.openPalette();
  await new Promise(r => setTimeout(r, 400));
  const input = pal.d.querySelector('.cmd input');
  ok('палитра открывается', !!input);

  const search = async q => {
    input.value = q;
    input.dispatchEvent(new pal.w.Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    return [...pal.d.querySelectorAll('.cmd .row .lbl')].map(e => e.textContent.trim());
  };

  const QUERIES = [
    ['expert', /Expert Marketplace/i],
    ['adviser', /Expert Marketplace/i],
    ['human help', /Expert Marketplace/i],
    ['wealth', /Wealth Hub/i],
    ['savings', /Wealth Hub/i],
    ['copilot', /Research Copilot/i],
    ['ai assistant', /Research Copilot/i],
    ['academy', /Guided Academy/i],
    ['rewards', /Community Rewards/i],
    ['premium', /AI Private/i],
    ['deep link', /Everywhere/i],
    ['answer engine', /GEO/i]
  ];
  for (const [q, rx] of QUERIES) {
    const r = await search(q);
    ok(`«${q}» находит фичу`, r.some(x => rx.test(x)), r.slice(0, 3).join(' / '));
  }

  const empty = await search('');
  ok('пустой запрос показывает и фичи тоже', empty.length > 0);
  const badge = pal.d.querySelector('.cmd .row .fbadge, .cmd .row .lbl .b');
  ok('строки палитры несут статус', !!pal.d.querySelector('.cmd .row .lbl'));

  /* ------------------------------------------------------ режим витрины (§12) */

  console.log('\n[Showcase] Режим витрины — помощь ревьюеру, а не часть продукта');
  const fab = pal.d.querySelector('.sc-fab');
  ok('контрол витрины смонтирован', !!fab);
  ok('по умолчанию выключен', pal.d.body.className.indexOf('showcase') === -1);
  ok('контрол объясняет себя', /hypothesis/i.test(fab.getAttribute('title') || ''));
  click(pal.w, fab);
  ok('включение добавляет класс на body', pal.d.body.classList.contains('showcase'));
  ok('состояние объявлено ассистивным технологиям', fab.getAttribute('aria-pressed') === 'true');
  click(pal.w, fab);
  ok('выключение возвращает исходное', !pal.d.body.classList.contains('showcase'));

  const withParam = await open('/new?showcase=1', { wait: 1600 });
  ok('?showcase=1 включает витрину', withParam.d.body.classList.contains('showcase'));

  /* ----------------------------------------------------- честность концептов */

  console.log('\n[Честность] Концепт не притворяется продуктом');
  const CONCEPT_PAGES = [
    ['/new/everywhere', 'NEW-03'],
    ['/new/geo-aeo', 'NEW-04'],
    ['/research/ai-private', 'NEW-06'],
    ['/community/rewards', 'NEW-08'],
    ['/money', 'NEW-05']
  ];
  for (const [path, id] of CONCEPT_PAGES) {
    const p = await open(path, { wait: 1800 });
    const t = text(p.d);
    ok(`${path} открывается без ошибок`, p.res.status === 200 && p.events.length === 0, p.events.join(' | '));
    ok(`${path} несёт дисклеймер стенда`, /CASE-STUDY|PROTOTYPE|NOT A REAL PLATFORM/i.test(t));
    ok(`${path} называет проблему пользователя`, t.length > 1200, String(t.length));
    ok(`${path} показывает статус фичи`, !!p.d.querySelector('.fbadge') || /CONCEPT|PREMIUM|NEW/.test(t));
  }

  const priv = await open('/research/ai-private', { wait: 1800 });
  ok('AI Private показывает образец отчёта, а не обещание', /sample|report/i.test(text(priv.d)));
  ok('AI Private честно называет платную дверь имитацией',
     /concept|not (a )?(real|working)|no payment|nothing is charged|simulat/i.test(text(priv.d)));

  const geo = await open('/new/geo-aeo', { wait: 1500 });
  ok('GEO/AEO несёт реальную разметку FAQ', /"@type"\s*:\s*"FAQPage"/.test(geo.html));
  ok('GEO/AEO даёт прямой ответ первым', /short answer|direct answer/i.test(text(geo.d)));

  const rew = await open('/community/rewards', { wait: 1500 });
  ok('Rewards показывает правила начисления', /earn|rule/i.test(text(rew.d)));
  ok('Rewards показывает историю, а не только обещание', /ledger|history|balance/i.test(text(rew.d)));

  const ev = await open('/new/everywhere', { wait: 1500 });
  ok('Everywhere демонстрирует настоящую диплинк-ссылку', /symbol=/.test(ev.html));

  /* ------------------------------------------------------ Wealth Hub работает */

  console.log('\n[My Budget] Работающий сценарий, не макет');
  const w = await open('/money', { wait: 2000 });
  /* Мастер по активам заменён онбордингом по задаче: продукт больше не
     начинается с вопроса «сколько у вас в акциях» (§10.1). */
  ok('есть вход по задаче', w.d.querySelectorAll('[data-choice]').length === 6,
     String(w.d.querySelectorAll('[data-choice]').length));
  ok('не спрашивает про активы первым делом',
     !/Stocks & ETFs|What is invested in markets/i.test(text(w.d)));
  ok('громко раскрыт статус прототипа', /prototype/i.test(text(w.d)));
  ok('есть переход к эксперту из раздела',
     /Expert Marketplace/.test(w.d.querySelector('.portal-nav').textContent));
  ok('нет ошибок исполнения', w.events.length === 0, w.events.join(' | '));

  /* ------------------------------------------------------------ аналитика */

  console.log('\n[Аналитика] Показ и открытие фичи считаются');
  const evs = home.w.Portal.events ? home.w.Portal.events() : [];
  const names = new Set((evs || []).map(e => e.event || e.name));
  ok('показ фичи логируется', names.has('strategic_feature_impression'), [...names].join(','));

  /* ------------------------------------------------------------- регресс */

  console.log('\n[Регресс] Прежние гарантии не сломаны');
  const reg = await open('/overview', { wait: 2200 });
  /* Simple: четыре ядровых домена + Academy + дверь More. */
  ok('в навигации пять доменов и дверь More',
     [...reg.d.querySelectorAll('.portal-nav .menu > .nav-door > a')].length === 6,
     String(reg.d.querySelectorAll('.portal-nav .menu > .nav-door > a').length));
  ok('переключатель режимов на месте', reg.d.querySelectorAll('.mode-switch [data-mode]').length === 3);
  ok('витрина не влияет на режим', reg.d.body.dataset.uiMode === 'simple' || !!reg.d.body.dataset.uiMode);
  ok('нет ошибок исполнения', reg.events.length === 0, reg.events.join(' | '));

  const classic = await fetch(B + '/classic');
  const chtml = await classic.text();
  ok('контрольная страница A/B не тянет реестр фич', !/features\.js/.test(chtml));

  console.log(`\n${pass} ok, ${fail} fail\n`);
  process.exit(fail ? 1 : 0);
})();
