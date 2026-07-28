/* Приёмка слоя фоновых изображений. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? ' — ' + e : '')); } };

const store = new Map(), session = new Map();
const mk = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() });

async function open(path) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  const html = await (await fetch(B + path)).text();
  const dom = new JSDOM(html, { url: B + path, runScripts: 'outside-only', resources: 'usable', virtualConsole: vc, pretendToBeVisual: true });
  Object.defineProperty(dom.window, 'localStorage', { value: mk(store), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(session), configurable: true });
// jsdom не даёт fetch — в браузере он есть, поэтому подставляем настоящий
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);
  dom.window.document.cookie = 'home_variant=task';
  for (const s of dom.window.document.querySelectorAll('script')) {
    if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B + path).href)).text());
    else { try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); } }
  }
  await new Promise(r => setTimeout(r, 700));
  return { d: dom.window.document, w: dom.window, events, html };
}

(async () => {

  console.log('\n[1] Файлы отдаются');
  for (const f of ['/backgrounds.css',
                   '/assets/bg-home-hero.webp', '/assets/bg-home-hero.png',
                   '/assets/bg-dashboard.webp', '/assets/bg-dashboard.png',
                   '/assets/bg-wave.webp', '/assets/bg-wave.png',
                   '/assets/bg-arena.webp', '/assets/bg-arena.png']) {
    const r = await fetch(B + f);
    ok(f + ' → ' + r.status, r.ok);
  }
  const css = await (await fetch(B + '/backgrounds.css')).text();
  ok('оверлеи на месте (::before у всех четырёх)',
     ['.bg-home::before', '.bg-dashboard::before', '.bg-wave::before', '.bg-arena::before'].every(s => css.includes(s)));
  ok('блок prefers-reduced-data сохранён', css.includes('prefers-reduced-data'));
  // По одному правилу image-set на картинку + по два url на неё: webp и png-фолбэк.
  ok('WebP с PNG-фолбэком у всех четырёх',
     (css.match(/image-set\(url/g) || []).length === 4 &&
     (css.match(/\.webp/g) || []).length === 4 &&
     (css.match(/\.png"\)/g) || []).length === 8);

  console.log('\n[2] Вес: WebP вместо PNG');
  let webp = 0, png = 0;
  for (const n of ['home-hero', 'dashboard', 'wave', 'arena']) {
    webp += Number((await fetch(B + `/assets/bg-${n}.webp`)).headers.get('content-length'));
    png  += Number((await fetch(B + `/assets/bg-${n}.png`)).headers.get('content-length'));
  }
  ok(`четыре WebP = ${(webp / 1024).toFixed(0)} КБ против ${(png / 1024 / 1024).toFixed(1)} МБ в PNG`, webp < 400 * 1024);

  console.log('\n[3] Главная: карта размещения');
  let { d, w, events } = await open('/');
  ok('без ошибок исполнения', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('backgrounds.css подключён', Boolean(d.querySelector('link[href="/backgrounds.css"]')));
  const hero = d.querySelector('.bg-section.bg-home');
  ok('герой на bg-home', Boolean(hero));
  ok('контент героя в .bg-inner', Boolean(hero.querySelector(':scope > .bg-inner h1')));
  ok('заголовок остался вопросом', /What do you want to do today/.test(hero.textContent));
  ok('карточки маршрутов вне героя — на чёрном', !d.querySelector('.bg-home .routes'));

  const promo = d.querySelector('[data-route="skip_portal"].bg-card');
  ok('промо-карточка Supercharts на bg-dashboard', promo && promo.classList.contains('bg-dashboard'));
  ok('только одна карточка в сетке с картинкой',
     d.querySelectorAll('.routes .bg-card').length === 1, String(d.querySelectorAll('.routes .bg-card').length));

  const cta = d.querySelector('.bg-section.bg-wave');
  ok('value-CTA на bg-wave', Boolean(cta) && Boolean(d.getElementById('saveCta')));
  ok('кнопки CTA внутри .bg-inner', Boolean(cta.querySelector('.bg-inner #saveCta')));

  const ev = d.getElementById('events');
  ok('блок событий на bg-arena', ev.classList.contains('bg-arena') && ev.classList.contains('bg-section'));
  ok('якорь #events сохранён для маршрута 06',
     d.querySelector('[data-route="prepare_event"]').getAttribute('href') === '#events');

  console.log('\n[4] Никаких картинок за данными');
  ok('строки брифа на сплошном фоне', d.querySelectorAll('.brief-row.bg-section, .brief-row .bg-section').length === 0);
  ok('карточка брифа без фоновой картинки',
     !d.getElementById('brief').classList.contains('bg-section'));
  ok('идеи и вотчлист без картинок',
     !d.querySelector('#ideas.bg-section') && !d.querySelector('#watchlist.bg-section'));

  console.log('\n[5] Главная всё ещё работает');
  const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  click(w, d.querySelector('#chips [data-sym="BTCUSD"]'));
  click(w, d.getElementById('saveWatchlist'));
  ok('watchlist_created по-прежнему летит', w.Portal.events().some(e => e.event === 'watchlist_created'));
  click(w, d.getElementById('followEvent'));
  ok('кнопка Follow внутри баннера работает', d.getElementById('followEvent').disabled);
  click(w, d.getElementById('saveCta'));
  ok('value_cta_register_click', w.Portal.events().some(e => e.event === 'value_cta_register_click'));

  console.log('\n[6] Академия');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/learn/academy'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('герой на bg-wave', Boolean(d.querySelector('.bg-section.bg-wave .bg-inner h1')));
  ok('CTA прогресса на bg-wave', d.getElementById('saveCta').classList.contains('bg-wave'));
  ok('CTA скрыт при нуле уроков', d.getElementById('saveCta').hidden);
  ok('завершение трека на bg-arena', d.getElementById('expertsCta').classList.contains('bg-arena'));
  ok('завершение скрыто, пока трек не пройден', d.getElementById('expertsCta').hidden);
  ok('трек из 6 уроков цел', d.querySelectorAll('.lesson').length === 6);

  console.log('\n[7] Страницы, которые должны остаться без картинок');
  for (const p of ['/metrics', '/staff', '/charts', '/symbols/BTCUSD', '/capital/experts', '/learn/academy/lesson', '/classic.html']) {
    const page = await open(p);
    ok(p + ' — без фоновых классов',
       page.d.querySelectorAll('.bg-section, .bg-card').length === 0,
       String(page.d.querySelectorAll('.bg-section, .bg-card').length));
    ok(p + ' — backgrounds.css не подключён', !page.html.includes('backgrounds.css'));
  }

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
