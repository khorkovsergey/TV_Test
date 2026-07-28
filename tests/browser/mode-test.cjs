/* Приёмка режимов Simple / Standard / Pro. §12 промпта
   claude_code_simple_standard_pro_mode_refactor: один продукт, одна IA,
   три пресета подачи. Ничего не пропадает, ничего не теряется. */
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
  await new Promise(r => setTimeout(r, opts.wait || 1600));
  return { d: dom.window.document, w: dom.window, events, html, res, store };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const key = (w, el, k) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
const text = d => d.body.textContent.replace(/\s+/g, ' ');
const modeStore = m => new Map([['ui_mode', m]]);

async function switchTo(p, mode) {
  const btn = p.d.querySelector(`.mode-switch [data-mode="${mode}"]`);
  click(p.w, btn);
  await new Promise(r => setTimeout(r, 250));
  return btn;
}

(async () => {

  /* ------------------------------------------------- центральная политика */

  console.log('\n[Политика] Один источник правил');
  const home = await open('/', { wait: 2200 });
  const M = home.w.Modes;
  ok('Modes подключён', !!M);
  ok('ровно три режима', M.LIST.length === 3 && M.LIST.join() === 'simple,standard,pro');
  ok('у каждого есть политика', M.LIST.every(id => M.policy(id).label && M.policy(id).density));
  ok('сложность растёт 1→2→3', M.LIST.map(i => M.policy(i).complexity).join() === '1,2,3');
  ok('лимит основных действий 3/5/8', M.LIST.map(i => M.policy(i).maxPrimaryActions).join() === '3,5,8');
  ok('плотность comfortable/balanced/compact',
     M.LIST.map(i => M.policy(i).density).join() === 'comfortable,balanced,compact');
  ok('пресет графика совпадает с режимом', M.LIST.every(i => M.policy(i).chartPreset === i));
  ok('русские подписи заданы', M.LIST.every(i => /[А-Яа-я]/.test(M.policy(i).description)));
  ok('у Standard свой смысл, а не «между»', /complete|full/i.test(M.policy('standard').tagline));

  console.log('\n[Политика] Видимость никогда не равна «скрыто»');
  ok('в словаре видимости нет hidden', !M.VISIBILITY.includes('hidden'));
  ok('самое слабое состояние оставляет дверь',
     M.VISIBILITY.every(v => ['always', 'default', 'collapsed', 'more-menu', 'advanced-drawer'].includes(v)));
  const p3 = M.presentation(3);
  ok('модуль сложности 3 в Simple доступен через More', p3.simple === 'more-menu');
  ok('модуль сложности 3 в Pro открыт сразу', p3.pro === 'default');
  ok('ничего не возвращает hidden', !Object.values(p3).includes('hidden'));

  /* ------------------------------------------------------------ миграция */

  console.log('\n[Миграция] Старые и ошибочные значения');
  ok('standart → standard', M.migrate('standart') === 'standard');
  ok('Standart Mode → standard', M.migrate('Standart mode') === 'standard');
  ok('beginner → simple', M.migrate('beginner') === 'simple');
  ok('значение в кавычках читается', M.migrate('"pro"') === 'pro');
  ok('advanced → pro', M.migrate('advanced') === 'pro');
  ok('мусор не проходит', M.migrate('turbo') === null && M.migrate(7) === null);
  ok('регистр не важен', M.migrate('PRO') === 'pro');

  const legacy = await open('/', { store: modeStore('standart'), wait: 1800 });
  ok('страница со сломанным значением поднимает Standard', legacy.w.Portal.mode() === 'standard',
     legacy.w.Portal.mode());
  ok('починенное значение записано обратно', legacy.store.get('ui_mode') === 'standard', legacy.store.get('ui_mode'));

  const beginner = await open('/', { store: modeStore('beginner'), wait: 1800 });
  ok('старое beginner читается как simple', beginner.w.Portal.mode() === 'simple');

  const fresh = await open('/', { wait: 1600 });
  ok('новый анонимный посетитель получает Simple', fresh.w.Portal.mode() === 'simple');
  ok('источник выбора записан', ['default', 'migration'].includes(fresh.w.Modes.prefs().source));

  console.log('\n[Написание] Standart не должен вернуться');
  for (const path of ['/', '/overview', '/charts', '/symbols/BTCUSD', '/learn/academy', '/new']) {
    const r = await fetch(B + path);
    const h = await r.text();
    ok(`нет «Standart» на ${path}`, !/Standart/.test(h));
  }
  const srcs = await Promise.all(['/modes.js', '/nav.js', '/home.js', '/ia.js', '/academy.js']
    .map(async u => [u, await (await fetch(B + u)).text()]));
  for (const [u, body] of srcs) {
    // modes.js обязан знать опечатку — он её и чинит
    ok(`нет «Standart» в ${u}`, u === '/modes.js' ? !/Standart/.test(body) : !/standart/i.test(body));
  }
  ok('в modes.js стоит защита от опечатки', /'standart'/.test(srcs[0][1]));

  /* ------------------------------- режим ≠ подписка ≠ права (§2.1) */

  console.log('\n[Разделение] Режим не подписка и не права');
  /* Строки обещания сами упоминают пейволл — чтобы сказать, что его нет. */
  const src = srcs.map(s => s[1]).join('\n')
    .split('\n').filter(l => !/never|not a paywall|forbid/i.test(l)).join('\n');
  const hit = (src.match(/.{0,70}(paywall|subscription|billing|entitle).{0,40}/i) || [''])[0];
  ok('режим нигде не используется как пейволл',
     !/mode[^\n]{0,40}(paywall|subscription|billing|entitle)/i.test(src), hit);
  ok('в обещании явно записано, что план не меняется',
     M.KEEPS.some(k => /plan|billing|paywall/i.test(k)));
  ok('обещание перечисляет сохраняемое', M.KEEPS.length >= 6);
  ok('обещание перечисляет изменяемое', M.CHANGES.length >= 5);
  ok('стратегические фичи названы в обещании',
     M.KEEPS.some(k => /Expert Marketplace/.test(k) && /Wealth Hub/.test(k)));

  /* ------------------------------------------- ничего не пропадает (§7.1) */

  console.log('\n[Навигация] Категория не исчезает вместе с режимом');
  const IA = home.w.IA;
  const total = IA.allItems().length;
  for (const mode of M.LIST) {
    let shown = 0, more = 0;
    for (const s of IA.SECTIONS) {
      const sp = IA.menuSplit(s, mode, 6);
      shown += sp.rows.length; more += sp.more.length;
    }
    ok(`${mode}: ни один пункт не потерян (${shown} сразу + ${more} под More)`,
       shown + more === IA.SECTIONS.reduce((n, s) => n + s.groups.reduce((k, g) => k + g.items.length, 0), 0));
    ok(`${mode}: часть открыта сразу`, shown >= 12, String(shown));
  }

  const simpleNav = await open('/overview', { store: modeStore('simple'), wait: 2200 });
  // седьмая дверь — «My space» за аватаром, она не раздел
  const panels = [...simpleNav.d.querySelectorAll('.menu .nav-door > .nav-panel')];
  /* Четыре домена плюс дверь More — одинаково во всех режимах. Раньше
     ожидалось пять разделов плюс More, потому что верхний уровень зависел
     от режима. */
  ok('четыре доменные панели и дверь More в Simple',
     panels.length === 5 && simpleNav.d.querySelector('.nav-more'), String(panels.length));
  ok('в Simple есть дисклоужер More tools', panels.some(p => p.querySelector('.more-tools')));
  const simpleLinks = new Set([...simpleNav.d.querySelectorAll('.nav-panel a[data-ia]')].map(a => a.dataset.ia));
  const proNav = await open('/overview', { store: modeStore('pro'), wait: 2200 });
  const proLinks = new Set([...proNav.d.querySelectorAll('.nav-panel a[data-ia]')].map(a => a.dataset.ia));
  /* Прежняя проверка требовала одинакового набора ссылок в меню всех режимов.
     Это и есть то, что релиз меняет: Professional ведёт Screeners и Charts, а
     My Budget уходит под More вместе со своей панелью. Инвариант перенесён туда,
     где он остаётся правдой, — в реестр: ни одна запись раздела не теряется ни
     в одном режиме, и каждый раздел достижим. */
  const N = simpleNav.w.Navigation;
  ok('ни одна запись домена не потеряна ни в одном режиме',
     N.DOMAINS.every(d => M.LIST.every(m => {
       const r = N.menu(d.id, m);
       const got = new Set(r.rows.concat(r.more).map(x => x.id));
       return d.entries.every(e => got.has(e.id));
     })));
  ok('каждый раздел достижим в каждом режиме',
     M.LIST.every(m => N.everySectionReachable(m)));
  ok('More несёт утилиты, а не вытесненные домены',
     [...proNav.d.querySelectorAll('.nav-more .nav-panel a')].map(a => a.textContent).join()
       .includes('Full site map'));

  console.log('\n[Стратегические фичи] Видны во всех режимах (§2.3)');
  /* Личные сервисы живут под Home, а не на верхнем уровне: сама фича никуда
     не делась — изменился её владелец. */
  /* По идентификаторам, а не по подписям: в Simple «My Budget» называется
     «Manage my money», и проверка по тексту ловила бы формулировку, а не
     наличие самой возможности. */
  const MUST = ['money', 'experts', 'rewards', 'academy', 'screeners'];
  for (const mode of M.LIST) {
    const p = mode === 'simple' ? simpleNav : mode === 'pro' ? proNav : await open('/overview', { store: modeStore('standard'), wait: 2200 });
    /* Раздел, вытесненный режимом под More, не рендерит свою панель — поэтому
       наличие его пунктов проверяется там, где оно остаётся правдой: в реестре
       навигации. Утверждение то же самое — «режим не прячет стратегическое», —
       но проверяется не через то, какая панель сейчас открыта. */
    const NAVREG = p.w.Navigation;
    const ids = new Set(NAVREG.DOMAINS.flatMap(d => {
      const r = NAVREG.menu(d.id, mode);
      return r.rows.concat(r.more).map(x => x.id);
    }).concat(NAVREG.topNav(mode).lead.concat(NAVREG.topNav(mode).more).map(e => e.id)));
    const gone = MUST.filter(x => !ids.has(x));
    ok(`${mode}: ${MUST.length} стратегических пунктов на месте`, gone.length === 0, gone.join(','));
  }
  for (const mode of M.LIST) {
    const p = await open('/', { store: modeStore(mode), wait: 2200 });
    const ids = [...p.d.querySelectorAll('[data-fid]')].map(a => a.dataset.fid);
    ok(`${mode}: блок инноваций на главной`, ids.length >= 4, ids.join(','));
    ok(`${mode}: Expert Marketplace на главной`, ids.includes('NEW-07'));
    ok(`${mode}: My Budget на главной как флагман`, ids.includes('NEW-05'));
  }
  const newPage = {};
  for (const mode of M.LIST) {
    const p = await open('/new', { store: modeStore(mode), wait: 1800 });
    newPage[mode] = [...p.d.querySelectorAll('.fcard')].length;
  }
  ok('/new показывает один и тот же набор во всех режимах',
     newPage.simple === 14 && newPage.standard === 14 && newPage.pro === 14, JSON.stringify(newPage));

  /* ------------------------------------------- переключатель и его обещание */

  console.log('\n[Переключатель] Один, доступный, объясняющий себя');
  const sw = home.d.querySelector('.mode-switch');
  ok('переключатель один на страницу', home.d.querySelectorAll('.mode-switch').length === 1);
  ok('это радиогруппа', sw.getAttribute('role') === 'radiogroup');
  ok('три радиокнопки', sw.querySelectorAll('[role="radio"]').length === 3);
  ok('выбранный объявлен текстом, не цветом',
     sw.querySelector('[data-mode="simple"]').getAttribute('aria-checked') === 'true');
  ok('в таб-порядке только выбранный',
     [...sw.querySelectorAll('[data-mode]')].filter(b => b.tabIndex === 0).length === 1);
  ok('у каждой кнопки есть пояснение', [...sw.querySelectorAll('[data-mode]')].every(b => (b.title || '').length > 20));
  ok('есть вход в сравнение режимов', !!sw.querySelector('[data-cmp]'));

  const first = sw.querySelector('[data-mode="simple"]');
  key(home.w, first, 'ArrowRight');
  await new Promise(r => setTimeout(r, 200));
  ok('стрелка вправо переключает режим', home.w.Portal.mode() === 'standard', home.w.Portal.mode());
  key(home.w, sw.querySelector('[data-mode="standard"]'), 'ArrowLeft');
  await new Promise(r => setTimeout(r, 200));
  ok('стрелка влево возвращает', home.w.Portal.mode() === 'simple');

  click(home.w, sw.querySelector('[data-cmp]'));
  await new Promise(r => setTimeout(r, 200));
  const dlg = home.d.querySelector('.mode-cmp-back');
  ok('диалог сравнения открывается', !!dlg);
  ok('это модальный диалог', dlg.getAttribute('role') === 'dialog' && dlg.getAttribute('aria-modal') === 'true');
  ok('показаны все три режима', dlg.querySelectorAll('.col').length === 3);
  ok('текущий режим отмечен', !!dlg.querySelector('.col.on'));
  const dtext = dlg.textContent.replace(/\s+/g, ' ');
  ok('сказано, что меняется', /Switching changes/.test(dtext));
  ok('сказано, что не меняется', /Switching never changes/.test(dtext));
  ok('обещано не трогать план', /plan and billing/i.test(dtext));
  ok('обещано не трогать сохранённое', /watchlists, alerts, portfolios/i.test(dtext));
  ok('обещано не менять цены', /prices themselves/i.test(dtext));
  click(home.w, dlg.querySelector('[data-pick="pro"]'));
  await new Promise(r => setTimeout(r, 250));
  ok('выбор в диалоге переключает режим', home.w.Portal.mode() === 'pro');
  ok('диалог закрывается после выбора', !home.d.querySelector('.mode-cmp-back'));

  /* ------------------------------------------ переключение сохраняет состояние */

  console.log('\n[Состояние] Переключение ничего не теряет (§5.3)');
  const hub = await open('/symbols/ETHUSD', { store: modeStore('pro'), wait: 2600 });
  const tabs = [...hub.d.querySelectorAll('#hubTabs [data-tab]')];
  ok('в Pro доступны все девять вкладок', tabs.length === 9, String(tabs.length));
  const trade = tabs.find(t => t.dataset.tab === 'trade');
  click(hub.w, trade);
  await new Promise(r => setTimeout(r, 150));
  ok('вкладка Trade выбрана', hub.d.querySelector('#hubTabs [data-tab="trade"]').getAttribute('aria-selected') === 'true');
  await switchTo(hub, 'simple');
  ok('маршрут не изменился', hub.w.location.pathname === '/symbols/ETHUSD');
  ok('инструмент сохранился', /ETHUSD/.test(text(hub.d)));
  ok('выбранная вкладка пережила переключение',
     hub.d.querySelector('[data-tab="trade"]')?.getAttribute('aria-selected') === 'true');
  ok('вкладки выше уровня не удалены, а под More',
     !!hub.d.querySelector('#hubTabs .tab-more [data-tab="trade"]'));
  ok('в Simple по-прежнему девять вкладок в разметке',
     hub.d.querySelectorAll('#hubTabs [data-tab]').length === 9,
     String(hub.d.querySelectorAll('#hubTabs [data-tab]').length));
  ok('подпись объясняет, где остальные', /open from More here/i.test(text(hub.d)));

  console.log('\n[Состояние] Действия ограничены числом, а не удалением');
  const bars = {};
  for (const mode of M.LIST) {
    const p = await open('/symbols/BTCUSD', { store: modeStore(mode), wait: 2400 });
    const primary = p.d.querySelectorAll('#actionBar > .btn').length;
    const hidden = p.d.querySelectorAll('#actionBar .act-more .btn').length;
    bars[mode] = { primary, hidden, total: primary + hidden };
    ok(`${mode}: основных действий ${primary} ≤ ${M.policy(mode).maxPrimaryActions}`,
       primary <= M.policy(mode).maxPrimaryActions, String(primary));
    ok(`${mode}: остальные под More actions`, primary + hidden === 9, JSON.stringify(bars[mode]));
  }
  ok('Simple предлагает меньше, чем Pro', bars.simple.primary < bars.pro.primary);
  ok('во всех режимах доступно одно и то же число действий',
     bars.simple.total === bars.pro.total && bars.standard.total === bars.pro.total);

  console.log('\n[График] Три пресета, один маршрут');
  const chart = await open('/charts?symbol=SOLUSD', { store: modeStore('simple'), wait: 2400 });
  ok('маршрут графика один', chart.w.location.pathname === '/charts');
  ok('нет параллельного дерева /simple', !/\/simple\/|\/pro\//.test(chart.html));
  ok('есть ящик Advanced tools', !!chart.d.querySelector('#advDrawer'));
  ok('ящик виден в Simple', chart.d.querySelector('#advDrawer').hidden === false);
  const advCount = Number(chart.d.querySelector('#advCount')?.textContent || 0);
  ok('ящик называет, сколько инструментов скрыто', advCount > 0, String(advCount));
  click(chart.w, chart.d.querySelector('#advDrawer button'));
  await new Promise(r => setTimeout(r, 200));
  ok('открытие ящика показывает продвинутые инструменты',
     [...chart.d.querySelectorAll('.cw-toolbar [data-min="pro"]')].every(b => !b.hidden));
  ok('глобальный режим при этом не изменился', chart.w.Portal.mode() === 'simple');
  ok('есть возврат к пресету', /Back to the simple preset/i.test(chart.d.querySelector('#advDrawer').textContent));
  ok('есть явное «сделать по умолчанию»', !!chart.d.querySelector('#makeDefault'));
  click(chart.w, chart.d.querySelector('#makeDefault'));
  await new Promise(r => setTimeout(r, 200));
  ok('«сделать по умолчанию» повышает режим явно', chart.w.Portal.mode() === 'standard');
  ok('символ на графике сохранился', /SOLUSD/.test(chart.d.querySelector('#symbolBtn')?.textContent || ''));

  console.log('\n[График] Слово Beginner больше не встречается');
  const chartSrc = await (await fetch(B + '/charts')).text();
  ok('в подсказках графика нет Beginner', !/goes back to Beginner/.test(chartSrc));

  /* -------------------------------------------------- плотность и объяснения */

  console.log('\n[Плотность] Режим меняет подачу, а не содержание');
  for (const mode of M.LIST) {
    const p = await open('/markets', { store: modeStore(mode), wait: 2600 });
    ok(`${mode}: режим объявлен на body`, p.d.body.dataset.uiMode === mode, p.d.body.dataset.uiMode);
    ok(`${mode}: плотность объявлена на body`, p.d.body.dataset.density === M.policy(mode).density,
       p.d.body.dataset.density);
    ok(`${mode}: глубина объяснений объявлена`, p.d.body.dataset.explain === M.policy(mode).explanationDepth);
  }

  const rowsBy = {};
  for (const mode of M.LIST) {
    const p = await open('/markets', { store: modeStore(mode), wait: 3000 });
    rowsBy[mode] = {
      cols: p.d.querySelectorAll('.q-table thead th').length,
      rows: p.d.querySelectorAll('.q-table tbody tr').length
    };
  }
  ok('колонок в Pro больше, чем в Simple', rowsBy.pro.cols > rowsBy.simple.cols, JSON.stringify(rowsBy));
  ok('строк одинаково — данные не зависят от режима',
     rowsBy.simple.rows === rowsBy.pro.rows && rowsBy.standard.rows === rowsBy.pro.rows, JSON.stringify(rowsBy));

  console.log('\n[Данные] Режим не трогает цифры');
  const priceOf = async mode => {
    const r = await fetch(B + '/api/markets');
    const j = await r.json();
    return (j.items || []).filter(i => i.ok).length;
  };
  ok('данные приходят с одного эндпоинта без режима', (await priceOf('simple')) === (await priceOf('pro')));
  const apiSrc = await (await fetch(B + '/quotes.js')).text();
  ok('клиент котировок не знает про режим', !/ui_mode|Portal\.mode|Modes\./.test(apiSrc));

  /* -------------------------------------------------------------- академия */

  console.log('\n[Академия] Доступна во всех режимах, меняется акцент');
  for (const mode of M.LIST) {
    const p = await open('/learn/academy', { store: modeStore(mode), wait: 2400 });
    ok(`${mode}: академия открывается`, p.res.status === 200 && p.events.length === 0, p.events.join(' | '));
    ok(`${mode}: подпись режима верна`,
       (p.d.querySelector('#modeLabel')?.textContent || '').toLowerCase().startsWith(mode),
       p.d.querySelector('#modeLabel')?.textContent);
    ok(`${mode}: шесть уроков на месте`, p.d.querySelectorAll('.track .lesson, #track > *').length >= 6,
       String(p.d.querySelectorAll('#track > *').length));
  }

  /* ------------------------------------------------------------- аналитика */

  console.log('\n[Аналитика] События режима');
  const an = await open('/', { wait: 2200 });
  const evs = () => (an.w.Portal.events ? an.w.Portal.events() : []).map(e => e.event || e.name);
  click(an.w, an.d.querySelector('.mode-switch [data-cmp]'));
  await new Promise(r => setTimeout(r, 150));
  ok('mode_comparison_opened логируется', evs().includes('mode_comparison_opened'), evs().slice(-4).join(','));
  const esc_ = an.d.querySelector('.mode-cmp-back .x');
  click(an.w, esc_);
  await new Promise(r => setTimeout(r, 150));
  ok('mode_change_cancelled логируется', evs().includes('mode_change_cancelled'));
  click(an.w, an.d.querySelector('.mode-switch [data-mode="pro"]'));
  await new Promise(r => setTimeout(r, 200));
  ok('mode_changed логируется', evs().includes('mode_changed'));
  ok('событие несёт откуда и куда',
     (an.w.Portal.events() || []).some(e => e.event === 'mode_changed' && e.from && e.to && e.route));

  /* ------------------------------------- режим обязан что-то менять (§13) */

  console.log('\n[Различия] Ни один маршрут не одинаков в двух режимах');
  /* Баг, ради которого этот блок написан: режим менял отступы и больше ничего.
     Считаем структуру — что человек видит без единого клика. */
  const seen2 = el => {
    if (!el || el.hidden) return false;
    const st = el.getAttribute('style') || '';
    if (/display:\s*none/.test(st)) return false;
    if (el.closest('details:not([open])')) return false;
    if (el.closest('[hidden]')) return false;
    return true;
  };
  const shape = d => {
    const main = d.querySelector('main') || d.body;
    const vis = sel => [...main.querySelectorAll(sel)].filter(seen2).length;
    const words = [...main.querySelectorAll('p, .d, .prob, .sol, [data-explain-level], .tv-lead')]
      .filter(seen2).reduce((n, e) => n + e.textContent.trim().split(/\s+/).length, 0);
    return [vis('.tv-card, .fcard, .next-step'), vis('.btn, .preset, .tb-item, .cw-btn'),
            vis('[role="tab"]'), vis('.q-table thead th'), vis('[data-route]'),
            vis('input, select, textarea'), vis('[data-explain-level]'),
            [...main.querySelectorAll('details')].length, words,
            main.textContent.replace(/\s+/g, ' ').length].join('|');
  };

  const ROUTES = ['/', '/overview', '/markets', '/research', '/screeners', '/symbols/BTCUSD',
                  '/charts', '/money', '/trade', '/learn', '/learn/academy',
                  '/community', '/capital/experts', '/new'];
  for (const path of ROUTES) {
    const sh = {};
    for (const mode of M.LIST) sh[mode] = shape((await open(path, { store: modeStore(mode), wait: 2600 })).d);
    ok(`${path}: Simple отличается от Standard`, sh.simple !== sh.standard, sh.simple + ' vs ' + sh.standard);
    ok(`${path}: Standard отличается от Pro`, sh.standard !== sh.pro, sh.standard + ' vs ' + sh.pro);
  }

  console.log('\n[Различия] Объяснений меньше по мере роста режима');
  /* Слой объяснений применяется к элементам, а не только описан в CSS —
     иначе страница может заявлять глубину и нести одни и те же слова. */
  /* Считать «сколько объяснений видно» нельзя: Simple показывает меньше
     модулей, потому что глубокие свёрнуты. Инвариант — про УРОВЕНЬ копии:
     обучающий абзац живёт только в Simple, короткая строка — до Standard,
     в Pro не остаётся ни того, ни другого. */
  const explainOf = async (path, mode) => {
    const p = await open(path, { store: modeStore(mode), wait: 2400 });
    const all = [...p.d.querySelectorAll('[data-explain-level]')];
    return {
      deep: all.filter(e => e.dataset.explainLevel === 'deep' && !e.hidden).length,
      ctx:  all.filter(e => e.dataset.explainLevel === 'context' && !e.hidden).length,
      txt: text(p.d)
    };
  };
  for (const path of ['/overview', '/research', '/money', '/community', '/new']) {
    const w = { simple: await explainOf(path, 'simple'), standard: await explainOf(path, 'standard'), pro: await explainOf(path, 'pro') };
    ok(`${path}: обучающий абзац только в Simple`,
       w.simple.deep > 0 && w.standard.deep === 0 && w.pro.deep === 0,
       `deep ${w.simple.deep}/${w.standard.deep}/${w.pro.deep}`);
    ok(`${path}: объяснений не растёт с уровнем`,
       (w.simple.deep + w.simple.ctx) >= (w.standard.deep + w.standard.ctx) &&
       (w.standard.deep + w.standard.ctx) > (w.pro.deep + w.pro.ctx),
       `${w.simple.deep + w.simple.ctx}/${w.standard.deep + w.standard.ctx}/${w.pro.deep + w.pro.ctx}`);
    ok(`${path}: в Pro обучающей копии не остаётся`,
       w.pro.deep === 0 && w.pro.ctx === 0, `${w.pro.deep}+${w.pro.ctx}`);
    ok(`${path}: подписи источников в Pro остались`,
       /source|delayed|prototype|not investment advice|PILOT|LIVE|nothing leaves/i.test(w.pro.txt));
  }

  /* --------------------------------------------------------------- регресс */

  console.log('\n[Регресс] Прежние гарантии');
  for (const mode of M.LIST) {
    const p = await open('/overview', { store: modeStore(mode), wait: 2200 });
    /* Число дверей теперь зависит от режима — это и есть mode-first v2.
       Гарантия, которая осталась: Standard равен вчерашней базовой линии, и
       из любого режима достижим каждый раздел. */
    ok(`${mode}: верхнее меню непусто и содержит дверь More`,
       p.d.querySelectorAll('.portal-nav .menu > a, .portal-nav .menu > .nav-door > a').length >= 5
       && Boolean(p.d.querySelector('.nav-more')));
    if (mode === 'standard') {
      ok('standard: четыре домена на первом уровне',
         p.w.Navigation.topNav('standard').lead
           .filter(e => e.type === 'section').map(e => e.label).join(' · ')
           === 'Home · Market · Symbols · Economy');
    }
    ok(`${mode}: без ошибок исполнения`, p.events.length === 0, p.events.join(' | '));
  }
  const classic = await (await fetch(B + '/classic')).text();
  ok('контрольная страница A/B не подключает modes.js', !/modes\.js/.test(classic));

  console.log(`\n${pass} ok, ${fail} fail\n`);
  process.exit(fail ? 1 : 0);
})();
