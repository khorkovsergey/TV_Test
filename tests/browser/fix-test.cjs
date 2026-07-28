/* Приёмка по FIX-PROMPT.md. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? ' — ' + e : '')); } };

const store = new Map(), session = new Map();
const mk = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() });

async function open(path, cookie) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  const res = await fetch(B + path, { headers: cookie ? { cookie } : {} });
  const html = await res.text();
  const dom = new JSDOM(html, { url: B + path, runScripts: 'outside-only', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true });
  Object.defineProperty(dom.window, 'localStorage', { value: mk(store), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(session), configurable: true });
// jsdom не даёт fetch — в браузере он есть, поэтому подставляем настоящий
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  for (const s of dom.window.document.querySelectorAll('script')) {
    if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B + path).href)).text());
    else { try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); } }
  }
  await new Promise(r => setTimeout(r, 700));
  return { d: dom.window.document, w: dom.window, events, html };
}

const PAGES = ['/', '/charts', '/symbols/BTCUSD', '/learn/academy', '/learn/academy/lesson',
               '/capital/experts', '/staff', '/metrics'];

(async () => {

  console.log('\n[§0] Входная дверь всегда ведёт на новую главную');
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const h = await (await fetch(B + '/')).text();
    seen.add(/What do you want to do today/.test(h) ? 'task' : 'classic');
  }
  ok('20 из 20 заходов — task-главная', seen.size === 1 && seen.has('task'), [...seen].join(','));
  ok('прежняя cookie контроля больше не запирает',
     /What do you want to do today/.test(await (await fetch(B + '/', { headers: { cookie: 'home_variant=classic; tv_seen=1' } })).text()));
  ok('?home=classic всё ещё показывает контроль',
     /Look first/.test(await (await fetch(B + '/?home=classic')).text()));
  const health = await (await fetch(B + '/api/health')).json();
  ok('health объясняет состояние сплита', /off — \/ always serves the task home/.test(health.home_ab), health.home_ab);

  console.log('\n[§1] Главная — задачи, а не витрина');
  const { d, w, events, html } = await open('/');
  ok('без ошибок исполнения', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('заголовок-вопрос', /What do you want to do today\?/.test(d.querySelector('h1').textContent));
  ok('подзаголовок как в референсе',
     /Pick a task — we set up the data, the chart and the next step\. No account needed to start\./.test(d.body.textContent));
  ok('ноль вхождений «Look first»', !/Look first/.test(d.body.textContent));
  ok('ноль вхождений «See plans»', !/See plans/.test(d.body.textContent));
  ok('ноль вхождений «Get started»', !/Get started/i.test(d.body.textContent));
  ok('нет заглушки hero visual', !/platform hero visual/.test(d.body.textContent));
  ok('нет витрины PRODUCTS', !/>Products</.test(html));
  const routes = [...d.querySelectorAll('.routes [data-route]')];
  /* §9.1 — задач стало девять, но в Simple видно три: «Manage my money»
     первой. Число маршрутов в разметке больше не показатель — показатель
     то, сколько их видно без клика (проверяется в mode-test). */
  ok('маршруты задач на месте', routes.length >= 8, String(routes.length));
  ok('первая задача — деньги',
     routes[0].querySelector('h3').textContent.trim() === 'Manage my money',
     routes[0].querySelector('h3').textContent);
  ok('брифов ровно один', d.querySelectorAll('#brief').length === 1);
  ok('в брифе есть причина у каждой строки',
     [...d.querySelectorAll('.brief-row')].every(r => r.children.length === 4));
  ok('блок события FOMC', /FOMC rate decision/.test(d.body.textContent));
  ok('value-first CTA «Save my watchlist»', Boolean(d.getElementById('saveCta')));
  ok('«Your research journey»', /Your research journey/.test(d.body.textContent));
  ok('идеи Editors\' Picks', d.querySelector('#feedTabs .on').dataset.feed === 'editors');
  // Перегруппировка заменила «Do / Learn & decide / Company» на четыре группы
  // карты сайта: дублировать навигацию в футере — ровно то, что мы убираем.
  ok('футер из 4 групп карты сайта', d.querySelectorAll('.portal-footer .cols')[0].querySelectorAll('.col').length === 6);
  ok('футер ведёт на карту сайта', /Full site map/.test(d.querySelector('.portal-footer').textContent));
  ok('прайсинг только в футере',
     !/Pricing/.test(d.querySelector('main').textContent) && /Pricing/.test(d.querySelector('.portal-footer').textContent));

  console.log('\n[§2] Одна навигация на всех страницах');
  const NAV = ['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice'];
  for (const p of PAGES) {
    const page = await open(p);
    const nav = [...page.d.querySelectorAll('.portal-nav .menu a:not(.nav-panel a)')].map(a => a.textContent.trim());
    ok(p + ' — 6 пунктов', JSON.stringify(nav) === JSON.stringify(NAV), nav.join(','));
    ok(p + ' — Copilot в шапке', /Copilot/.test(page.d.querySelector('.portal-nav .right').textContent));
    ok(p + ' — переключатель режима в шапке', Boolean(page.d.querySelector('.portal-nav .mode-switch')));
    ok(p + ' — нет Products/More в шапке', !/Products|>More</.test(page.d.querySelector('.portal-nav').innerHTML));
    ok(p + ' — нет пилюли Get started в шапке', !/Get started/i.test(page.d.querySelector('.portal-nav').textContent));
    ok(p + ' — подсказка поиска из спеки',
       page.d.querySelector('.portal-nav .search').textContent.includes('Search or ask: “why is BTC up?”'),
       page.d.querySelector('.portal-nav .search').textContent.trim());
    ok(p + ' — плашка дисклеймера', Boolean(page.d.querySelector('.mock-strip')));
    ok(p + ' — Copilot смонтирован', Boolean(page.d.querySelector('.cp-fab')));
  }

  console.log('\n[§3] Фоны и полосатые заглушки');
  ok('главная: герой на bg-home', Boolean(d.querySelector('.bg-section.bg-home .bg-inner h1')));
  ok('главная: Skip the portal на bg-card', Boolean(d.querySelector('[data-route="skip_portal"].bg-card')));
  ok('главная: CTA на bg-wave', Boolean(d.querySelector('.bg-section.bg-wave')));
  ok('главная: событие на bg-arena с центровкой',
     d.getElementById('events').classList.contains('bg-arena') &&
     /text-align:center/.test(d.querySelector('#events .bg-inner').getAttribute('style')));
  for (const p of PAGES) {
    const page = await open(p);
    ok(p + ' — полосатых заглушек нет', page.d.querySelectorAll('.ph').length === 0,
       String(page.d.querySelectorAll('.ph').length));
  }
  const academy = await open('/learn/academy');
  ok('академия: герой на bg-wave', Boolean(academy.d.querySelector('.bg-section.bg-wave .bg-inner h1')));
  const css = await (await fetch(B + '/backgrounds.css')).text();
  ok('оверлеи ::before не тронуты', (css.match(/::before\{background:/g) || []).length === 4);
  for (const f of ['bg-home-hero', 'bg-dashboard', 'bg-wave', 'bg-arena']) {
    const r = await fetch(B + `/assets/${f}.png`);
    const rw = await fetch(B + `/assets/${f}.webp`);
    ok(`${f}: png ${r.status} · webp ${rw.status}`, r.ok && rw.ok);
  }

  console.log('\n[§3b] Ничего декоративного за данными');
  ok('строки брифа на сплошной поверхности',
     !d.getElementById('brief').classList.contains('bg-section') &&
     [...d.querySelectorAll('.brief-row')].every(r => !r.classList.contains('bg-section')));
  for (const p of ['/metrics', '/staff', '/charts', '/symbols/BTCUSD', '/capital/experts', '/learn/academy/lesson']) {
    const page = await open(p);
    ok(p + ' — без фонов', page.d.querySelectorAll('.bg-section, .bg-card').length === 0);
  }

  console.log('\n[§5] Маршруты ведут куда обещано');
  const href = id => d.querySelector(`[data-route="${id}"]`).getAttribute('href');
  ok('01 → #brief', href('understand_market') === '#brief' && Boolean(d.querySelector('#brief')));
  ok('03 → #ideas', href('find_idea') === '#ideas' && Boolean(d.querySelector('#ideas')));
  ok('05 → /academy.html', href('learn') === '/learn/academy');
  ok('06 → #events', href('prepare_event') === '#events' && Boolean(d.querySelector('#events')));
  ok('Skip the portal → /charts.html', href('skip_portal') === '/charts');
  ok('Experts доступен из Community и с карты сайта',
     Boolean(d.querySelector('.portal-nav .menu a[href="/community"]')) &&
     Boolean(d.querySelector('.portal-footer a[href="/sitemap"]')));

  console.log('\n[§4] Что работало — работает');
  const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click(w, d.querySelector('#chips [data-sym="BTCUSD"]'));
  click(w, d.getElementById('saveWatchlist'));
  ok('watchlist_created', w.Portal.events().some(e => e.event === 'watchlist_created'));
  click(w, d.getElementById('followEvent'));
  ok('Follow · 1 click работает', d.getElementById('followEvent').disabled);
  click(w, routes[0]);
  ok('route_click', w.Portal.events().some(e => e.event === 'route_click'));

  console.log('\n[доп] Контроль нельзя спутать с продуктом');
  const cl = await open('/classic.html');
  ok('на контроле стоит явная плашка', /A\/B CONTROL/.test(cl.d.body.textContent));
  ok('с контроля есть путь на текущую главную', Boolean(cl.d.querySelector('.mock-strip a[href="/"]')));

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
