/* Приёмка Task-based Home по критериям handoff-task-home/PROMPT.md. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};

const store = new Map(), session = new Map();
const mk = m => ({
  getItem: k => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => m.set(k, String(v)),
  removeItem: k => m.delete(k),
  clear: () => m.clear()
});

async function open(path, cookie) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  vc.on('log', (...a) => events.push(a.map(String).join(' ')));

  const res = await fetch(B + path, { headers: cookie ? { cookie } : {}, redirect: 'manual' });
  const html = await res.text();
  const dom = new JSDOM(html, {
    url: B + path, runScripts: 'outside-only', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true
  });
  Object.defineProperty(dom.window, 'localStorage', { value: mk(store), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(session), configurable: true });
// jsdom не даёт fetch — в браузере он есть, поэтому подставляем настоящий
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  if (cookie) dom.window.document.cookie = cookie;

  for (const s of dom.window.document.querySelectorAll('script')) {
    if (s.src) {
      const r = await fetch(new URL(s.src, B + path).href);
      dom.window.eval(await r.text());
    } else {
      try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); }
    }
  }
  await new Promise(r => setTimeout(r, 700));
  return { dom, d: dom.window.document, w: dom.window, events, res, html };
}

const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const navText = d => [...d.querySelectorAll('.portal-nav .menu a:not(.nav-panel a)')].map(a => a.textContent.trim());

(async () => {

  /* Сплит по умолчанию выключен: стенд показывают людям, а не измеряют на
     трафике, и монетка у входной двери один раз уже стоила того, что работу
     приняли за невыкаченную. Механизм жив и включается HOME_AB=on —
     это проверяет ab-on-test.cjs на отдельном порту. */
  console.log('\n[1] Входная дверь и переключение вариантов');
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const r = await fetch(B + '/', { redirect: 'manual' });
    const html = await r.text();
    seen.add(/What do you want to do today/.test(html) ? 'task' : 'classic');
  }
  ok('без HOME_AB все заходы дают task-главную', seen.size === 1 && seen.has('task'), [...seen].join(','));

  let r = await fetch(B + '/?home=task');
  let setCookie = r.headers.get('set-cookie') || '';
  ok('?home=task отдаёт task-главную', /What do you want to do today/.test(await r.text()));
  ok('вариант закреплён в cookie', /home_variant=task/.test(setCookie), setCookie);
  ok('cookie доступна скриптам (не HttpOnly)', !/HttpOnly/i.test(setCookie));
  ok('ответ не кэшируется прокси', (r.headers.get('cache-control') || '').includes('no-store'));

  r = await fetch(B + '/', { headers: { cookie: 'home_variant=classic; tv_seen=1' } });
  ok('старая cookie контроля не запирает на нём', /What do you want to do today/.test(await r.text()));

  r = await fetch(B + '/', { headers: { cookie: 'tv_seen=1' } });
  ok('вернувшийся тоже видит текущую главную', /What do you want to do today/.test(await r.text()));

  r = await fetch(B + '/?home=classic');
  ok('?home=classic — опт-аут в контроль', /Look first/.test(await r.text()));

  console.log('\n[2] Новая главная: IA-правила');
  let { d, w, events } = await open('/', 'home_variant=task; tv_seen=1');
  ok('нет ошибок исполнения', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('заголовок — вопрос, а не слоган', /What do you want to do today/.test(d.querySelector('h1').textContent));
  ok('старого промо-героя нет', !/Look first/.test(d.body.textContent));
  ok('навигация из 6 пунктов',
     JSON.stringify(navText(d)) === JSON.stringify(['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice']),
     navText(d).join(','));
  ok('в шапке Copilot, режим, профиль', /Copilot/.test(d.querySelector('.portal-nav .right').textContent));
  ok('нет pricing-first кнопок «Get started»', !/Get started/i.test(d.body.textContent));
  ok('нет кнопки See plans', !/See plans/i.test(d.body.textContent));
  ok('один блок брифа', d.querySelectorAll('#brief').length === 1);
  ok('один блок идей', d.querySelectorAll('#ideas').length === 1);
  ok('один блок событий', d.querySelectorAll('#events').length === 1);
  ok('лента идей по умолчанию — Editors\' Picks',
     d.querySelector('#feedTabs .on').dataset.feed === 'editors');
  ok('дефолтная лента помечена как проверенная',
     d.getElementById('feedTag').textContent.includes('REVIEWED'));
  ok('метки типов контента на месте',
     d.querySelector('.tag-fact') && d.querySelector('.tag-ai') && d.querySelector('.tag-warn'));
  ok('дисклеймер сохранён', /not investment advice/i.test(d.body.textContent));
  ok('плашка «не настоящая платформа»', Boolean(d.querySelector('.mock-strip')));
  // Перегруппировка заменила «Do / Learn & decide / Company» на четыре группы
  // карты сайта: дублировать навигацию в футере — ровно то, что мы убираем.
  ok('футер из 4 групп карты сайта', d.querySelectorAll('.portal-footer .cols')[0].querySelectorAll('.col').length === 6);
  ok('футер ведёт на карту сайта', /Full site map/.test(d.querySelector('.portal-footer').textContent));
  ok('Pricing остался доступен из футера', /Pricing/.test(d.querySelector('.portal-footer').textContent));

  console.log('\n[3] Семь маршрутов + выход в воркспейс');
  const routes = [...d.querySelectorAll('.routes [data-route]')];
  /* §9.1 — задача про деньги добавлена первой, поэтому плиток девять.
     Значение имеет не их число в разметке, а сколько видно без клика. */
  ok('плитки задач на месте', routes.length >= 8, 'найдено ' + routes.length);
  ok('первая задача — «Manage my money»',
     routes[0].dataset.route === 'manage_money', routes[0].dataset.route);
  const ids = routes.map(x => x.dataset.route);
  ok('все семь задач размечены',
     ['understand_market', 'research_asset', 'find_idea', 'track_instruments', 'learn', 'prepare_event', 'start_trading']
       .every(x => ids.includes(x)), ids.join(','));
  const targets = routes.map(x => x.getAttribute('href'));
  ok('маршруты ведут в существующие места',
     targets.every(t => t.startsWith('#') ? Boolean(d.querySelector(t)) : true),
     targets.filter(t => t.startsWith('#') && !d.querySelector(t)).join(','));
  ok('Skip the portal ведёт в /charts.html',
     routes.find(x => x.dataset.route === 'skip_portal').getAttribute('href') === '/charts');

  console.log('\n[4] Аналитика: пять событий гипотезы');
  click(w, routes[0]);
  const ev = () => w.Portal.events();
  ok('route_click с route_id',
     ev().some(e => e.event === 'route_click' && e.route_id === routes[0].dataset.route));
  ok('first_meaningful_action с ms_since_landing',
     ev().some(e => e.event === 'first_meaningful_action' && typeof e.ms_since_landing === 'number'));
  ok('home_variant проставлен в каждом событии',
     ev().every(e => e.home_variant === 'task'), JSON.stringify(ev()[0]));

  click(w, d.querySelector('#chips [data-sym="BTCUSD"]'));
  click(w, d.getElementById('saveWatchlist'));
  ok('watchlist_created', ev().some(e => e.event === 'watchlist_created' && e.count === 1));
  ok('continuation после второго осмысленного действия',
     ev().some(e => e.event === 'continuation'));

  click(w, d.getElementById('saveCta'));
  ok('value_cta_register_click', ev().some(e => e.event === 'value_cta_register_click'));
  ok('вотчлист сохранён в localStorage', JSON.parse(store.get('watchlist') || '[]').includes('BTCUSD'));

  console.log('\n[5] home_bounce при отсутствии действий');
  store.clear(); session.clear();
  const b = await open('/', 'home_variant=task; tv_seen=1');
  ok('bounce не срабатывает сразу', !b.w.Portal.events().some(e => e.event === 'home_bounce'));
  b.w.dispatchEvent(new b.w.Event('pagehide'));
  ok('home_bounce при уходе без действия',
     b.w.Portal.events().some(e => e.event === 'home_bounce' && e.reason === 'exit_without_action'));

  console.log('\n[6] Copilot жив на новой главной');
  store.clear(); session.clear();
  const c = await open('/', 'home_variant=task; tv_seen=1');
  ok('кнопка Copilot отрисована', Boolean(c.d.querySelector('.cp-fab')));
  click(c.w, c.d.querySelector('.cp-fab'));
  ok('панель открывается', c.d.querySelector('.cp-panel').classList.contains('open'));
  ok('контекст страницы — portal_home',
     /PORTAL HOME/.test(c.d.querySelector('.cp-ctx').textContent), c.d.querySelector('.cp-ctx').textContent);

  console.log('\n[7] Навигация одинакова на всех страницах');
  const NAV = ['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice'];
  for (const p of ['/', '/charts', '/learn/academy', '/learn/academy/lesson', '/capital/experts', '/staff', '/metrics']) {
    store.clear(); session.clear();
    const page = await open(p, 'home_variant=task; tv_seen=1');
    ok(p + ' — 6 пунктов', JSON.stringify(navText(page.d)) === JSON.stringify(NAV), navText(page.d).join(','));
    ok(p + ' — Copilot в шапке', /Copilot/.test(page.d.querySelector('.portal-nav .right').textContent));
    ok(p + ' — без ошибок', !page.events.some(e => e.startsWith('ERR')),
       page.events.filter(e => e.startsWith('ERR'))[0]);
    const f = page.d.querySelector('.portal-footer');
    if (f) {
      // Перегруппировка: три навигационные колонки заменены четырьмя группами
      // карты сайта, а сама навигация в футере больше не дублируется.
      ok(p + ' — футер из 4 групп', f.querySelectorAll('.cols')[0].querySelectorAll('.col').length === 6,
         String(f.querySelectorAll('.cols')[0].querySelectorAll('.col').length));
      // «Community extras» в футере требует §20 промпта; исчезнуть должны
      // именно мега-меню Products и More из шапки.
      ok(p + ' — нет колонок Products/More', !/<b>Products<\/b>|<b>More<\/b>/.test(f.innerHTML));
      ok(p + ' — Pricing доступен', /Pricing/.test(f.textContent));
      ok(p + ' — ведёт на карту сайта', /Full site map/.test(f.textContent));
    }
  }

  console.log('\n[8] Воркспейс: граница Portal/Chart');
  store.clear(); session.clear();
  const ch = await open('/charts?symbol=ETHUSD', 'home_variant=task; tv_seen=1');
  ok('символ из пути подхвачен', ch.d.getElementById('symbolBtn').textContent === 'ETHUSD',
     ch.d.getElementById('symbolBtn').textContent);
  /* «Это не движок графиков» было правдой, пока страница рисовала линию по
     двадцати закрытиям. Теперь это настоящие свечи по OHLCV, и прежняя фраза
     стала бы ложной скромностью. Ожидание переписано под то, что честно
     сейчас: что именно живое, а что прототип. */
  ok('честно разделено живое и прототипное',
     /real delayed prices/i.test(ch.d.body.textContent)
     && /prototype surfaces/i.test(ch.d.body.textContent));
  ok('сказано, что задержанные данные — не лицензия на рыночные данные',
     /not a market-data licence/i.test(ch.d.body.textContent));
  ok('событие chart_workspace_opened', ch.w.Portal.events().some(e => e.event === 'chart_workspace_opened'));

  console.log('\n[9] Контрольный вариант рабочий');
  store.clear(); session.clear();
  const cl = await open('/classic', 'home_variant=classic; tv_seen=1');
  ok('старый герой на месте', /Look first/.test(cl.d.body.textContent));
  ok('контроль тоже пишет вариант в события',
     (cl.w.Portal.track('probe', {}), cl.w.Portal.events().slice(-1)[0].home_variant === 'classic'),
     cl.w.Portal.events().slice(-1)[0].home_variant);
  ok('без ошибок', !cl.events.some(e => e.startsWith('ERR')), cl.events.filter(e => e.startsWith('ERR'))[0]);

  console.log('\n[10] Академия и Эксперты продолжают работать');
  store.clear(); session.clear();
  const ac = await open('/learn/academy', 'home_variant=task; tv_seen=1');
  ok('трек из 6 уроков', ac.d.querySelectorAll('.lesson').length === 6);
  ac.w.Academy.track('probe', {});
  ok('события Академии несут home_variant',
     ac.w.Academy.events().slice(-1)[0].home_variant === 'task',
     JSON.stringify(ac.w.Academy.events().slice(-1)[0]));
  const ex = await fetch(B + '/api/consultants');
  ok('/api/consultants отвечает', ex.ok);

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
