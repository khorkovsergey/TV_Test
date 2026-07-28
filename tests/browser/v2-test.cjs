/* Приёмка по FIX-PROMPT-v2.md. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (n, c, e) => { if (c) { pass++; console.log('  ok   ' + n); } else { fail++; console.log('  FAIL ' + n + (e ? ' — ' + e : '')); } };

const mk = m => ({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() });

/* opts.slow — сколько миллисекунд «висит» ответ котировочного API (Slow 3G),
   opts.dead — котировочный API вообще не отвечает. */
async function open(path, opts = {}) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  const html = await (await fetch(B + path)).text();
  const dom = new JSDOM(html, { url: B + path, runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  Object.defineProperty(dom.window, 'localStorage', { value: mk(opts.store || new Map()), configurable: true });
  Object.defineProperty(dom.window, 'sessionStorage', { value: mk(new Map()), configurable: true });

  dom.window.fetch = (u, o) => {
    const url = String(u);
    const isQuoteApi = /\/api\/(markets|symbol)/.test(url);
    if (isQuoteApi && opts.dead) return new Promise(() => {});           // никогда не отвечает
    if (isQuoteApi && opts.slow) return new Promise(r => setTimeout(() => r(fetch(new URL(u, B).href, o)), opts.slow));
    return fetch(new URL(u, B).href, o);
  };

  const t0 = Date.now();
  for (const s of dom.window.document.querySelectorAll('script')) {
    try {
      if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text());
      else dom.window.eval(s.textContent);
    } catch (e) { events.push('ERR ' + e.message); }
  }
  await new Promise(r => setTimeout(r, opts.wait || 1200));
  return { d: dom.window.document, w: dom.window, events, ms: Date.now() - t0 };
}

const PAGES = ['/', '/markets', '/screeners', '/symbols/BTCUSD',
               '/charts', '/learn/academy', '/learn/academy/lesson', '/community/experts', '/staff', '/metrics'];

const visibleText = d => {
  const c = d.body.cloneNode(true);
  c.querySelectorAll('script,style').forEach(n => n.remove());
  return c.textContent;
};
const stuck = d => /Loading live quotes|Loading…|loading…/.test(visibleText(d));

(async () => {

  console.log('\n[P0-1] Запасной набор данных есть и полон');
  const s = await (await fetch(B + '/assets/quotes-sample.json')).json();
  ok('49 инструментов заморожено', s.items.length === 49, String(s.items.length));
  ok('у каждого цена, изменение и серия',
     s.items.every(i => Number.isFinite(i.price) && Number.isFinite(i.changePct) && i.series.length >= 15));
  ok('у каждого 52-недельный коридор', s.items.filter(i => Number.isFinite(i.wk52High)).length >= 45);
  ok('снимок датирован', Boolean(s.captured_at));
  ok('честно назван снимком', /snapshot|not live/i.test(s.note + s.source));

  console.log('\n[P0-2] Медленная сеть: 3 секунды — потолок');
  for (const p of ['/', '/markets', '/symbols/BTCUSD', '/charts']) {
    const r = await open(p, { slow: 30000, wait: 4000 });
    ok(p + ' — не висит на Loading', !stuck(r.d),
       visibleText(r.d).match(/Loading[^.]{0,30}/)?.[0]);
    ok(p + ' — помечено SAMPLE · NOT LIVE', /SAMPLE · NOT LIVE|SAMPLE — NOT LIVE/.test(visibleText(r.d)),
       'нет метки');
    ok(p + ' — без ошибок', !r.events.some(e => e.startsWith('ERR')), r.events.filter(e => e.startsWith('ERR'))[0]);
  }

  console.log('\n[P0-3] Источник мёртв полностью');
  {
    const r = await open('/markets', { dead: true, wait: 5000 });
    ok('таблица заполнена из снимка', r.d.querySelectorAll('#rows tr').length >= 45,
       String(r.d.querySelectorAll('#rows tr').length));
    ok('движения дня посчитаны из снимка', r.d.querySelectorAll('#movers .mover-row').length >= 18);
    ok('тепловая карта отрисована', r.d.querySelectorAll('#heat a').length >= 45);
    ok('нет надписи Loading', !stuck(r.d));
  }

  console.log('\n[P0-4] Страница символа рисует оболочку сразу');
  {
    const r = await open('/symbols/BTCUSD', { dead: true, wait: 4000 });
    ok('H1 никогда не «Loading…»', r.d.getElementById('assetName').textContent !== 'Loading…',
       r.d.getElementById('assetName').textContent);
    ok('символ виден из URL', /BTC/.test(r.d.getElementById('assetName').textContent + r.d.getElementById('eyebrow').textContent));
    ok('цена подставлена из снимка', /\d/.test(r.d.getElementById('price').textContent),
       r.d.getElementById('price').textContent);
    ok('ключевые цифры заполнены', r.d.querySelectorAll('#stats .st').length === 8);
    ok('пиры не пустые', r.d.querySelectorAll('#peers .mover-row').length >= 3);
    ok('техника объясняет своё отсутствие, а не пустая',
       /did not answer in time/.test(r.d.getElementById('technicals').textContent),
       r.d.getElementById('technicals').textContent.slice(0, 80));
  }

  console.log('\n[P0-5] Живой источник — по-прежнему FACT');
  {
    const r = await open('/markets', { wait: 2500 });
    ok('метка FACT · MARKET DATA', /FACT · MARKET DATA/.test(r.d.getElementById('sourceLine').textContent));
    ok('строк 49', r.d.querySelectorAll('#rows tr').length === 49, String(r.d.querySelectorAll('#rows tr').length));
    const sym = await open('/symbols/BTCUSD', { wait: 2500 });
    ok('символ: живое имя', sym.d.getElementById('assetName').textContent === 'Bitcoin',
       sym.d.getElementById('assetName').textContent);
    ok('символ: техника посчитана', /RSI 14/.test(sym.d.getElementById('technicals').textContent));
    ok('скелетоны сняты', sym.d.querySelectorAll('.skel').length === 0);
  }

  console.log('\n[P1] Пустых модулей нет');
  {
    const fresh = await open('/', { wait: 2500 });
    const raw = await (await fetch(B + '/')).text();
    const block = raw.match(/id="ideaCards"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] || '';
    ok('идеи: 3 карточки в разметке до всякого скрипта',
       (block.match(/tv-card/g) || []).length === 3, String((block.match(/tv-card/g) || []).length));
    ok('идеи: 3 карточки после отрисовки', fresh.d.querySelectorAll('#ideaCards .tv-card').length === 3);
    const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    click(fresh.w, fresh.d.querySelector('[data-feed="popular"]'));
    ok('идеи: 3 карточки на вкладке Popular', fresh.d.querySelectorAll('#ideaCards .tv-card').length === 3);
    click(fresh.w, fresh.d.querySelector('[data-feed="newest"]'));
    ok('идеи: 3 карточки на вкладке Newest', fresh.d.querySelectorAll('#ideaCards .tv-card').length === 3);
    ok('трейл скрыт у нового посетителя', fresh.d.getElementById('journeyCard').hidden);

    ok('чипы вотчлиста есть', fresh.d.querySelectorAll('#chips .chip').length === 5);
    click(fresh.w, fresh.d.querySelector('#chips [data-sym="BTCUSD"]'));
    click(fresh.w, fresh.d.getElementById('saveWatchlist'));
    ok('watchlist_created летит', fresh.w.Portal.events().some(e => e.event === 'watchlist_created'));
    ok('вотчлист в localStorage', /BTCUSD/.test(fresh.w.localStorage.getItem('watchlist') || ''));
  }
  {
    // Трейл появляется после открытия одного символа
    const store = new Map();
    await open('/symbols/ETHUSD', { store, wait: 2500 });
    const back = await open('/', { store, wait: 2000 });
    ok('трейл появился после первого символа', !back.d.getElementById('journeyCard').hidden);
    ok('в трейле виден символ', /ETHUSD/.test(back.d.getElementById('trail').textContent));
  }
  {
    const unknown = await open('/symbols/WOOF', { wait: 2500 });
    ok('неизвестный символ: понятное сообщение, не пустые боксы',
       !unknown.d.getElementById('loadError').hidden && /Unknown symbol|not in the bundled/i.test(unknown.d.body.textContent));
    ok('есть путь назад на рынки', /href="\/markets"/.test(unknown.d.getElementById('loadError').innerHTML));
  }

  console.log('\n[P2] Единая шапка и футер');
  const navs = new Set(), rights = new Set(), footers = new Set();
  for (const p of PAGES) {
    const r = await open(p, { wait: 900 });
    const nav = r.d.querySelector('.portal-nav .menu');
    const right = r.d.querySelector('.portal-nav .right');
    const foot = r.d.querySelector('.portal-footer');
    navs.add(nav.innerHTML.replace(/ class="active"/g, '').replace(/\s+/g, ' ').trim());
    rights.add(right.innerHTML.replace(/\s+/g, ' ').trim());
    footers.add(foot.innerHTML.replace(/\s+/g, ' ').trim());
    ok(p + ' — Copilot FAB на месте', Boolean(r.d.querySelector('.cp-fab')));
  }
  ok('навигация одинакова на всех 10 страницах', navs.size === 1, `вариантов: ${navs.size}`);
  ok('правая группа одинакова', rights.size === 1, `вариантов: ${rights.size}`);
  ok('футер одинаков', footers.size === 1, `вариантов: ${footers.size}`);
  // §6.1 отменяет прежнее правило: переключатель режима живёт в шапке.
  ok('переключатель режима в шапке — §6.1', [...rights][0].includes('mode-switch'));
  const acad = await open('/learn/academy', { wait: 900 });
  ok('в Академии режим меняется общим переключателем', Boolean(acad.d.querySelector('.portal-nav .mode-switch')));

  const footHtml = [...footers][0];
  ok('в футере нет мёртвых ссылок', !/href="#"/.test(footHtml));
  ok('есть якорь About this prototype', /#about-prototype/.test(footHtml));
  // Стало лучше приглушённого текста: пункты ведут на карту сайта, где у
  // каждого написан статус. Навигация в футере больше не дублируется —
  // Screener живёт в двери Markets и в палитре.
  ok('Pricing ведёт на карту сайта', /Pricing<\/a>/.test(footHtml) && /sitemap#company/.test(footHtml));
  ok('футер из четырёх групп карты', (footHtml.match(/<div class="col">/g) || []).length === 6);
  ok('в футере есть ссылка на полную карту', /Full site map/.test(footHtml));

  console.log('\n[P2-4] Фоны отдаются');
  for (const f of ['bg-home-hero', 'bg-dashboard', 'bg-wave', 'bg-arena']) {
    const a = await fetch(B + `/assets/${f}.webp`), b = await fetch(B + `/assets/${f}.png`);
    ok(`${f}: webp ${a.status} · png ${b.status}`, a.ok && b.ok);
  }
  {
    const home = await open('/', { wait: 900 });
    ok('bg-home на герое', Boolean(home.d.querySelector('.bg-section.bg-home')));
    ok('bg-dashboard на Skip the portal', Boolean(home.d.querySelector('[data-route="skip_portal"].bg-dashboard')));
    ok('bg-wave на value CTA', Boolean(home.d.querySelector('.bg-section.bg-wave')));
    ok('bg-arena на блоке FOMC', home.d.getElementById('events').classList.contains('bg-arena'));
    const ac = await open('/learn/academy', { wait: 900 });
    ok('bg-wave на герое Академии', Boolean(ac.d.querySelector('.bg-section.bg-wave .bg-inner h1')));
  }

  console.log('\n[P3] Полировка');
  {
    const home = await open('/', { wait: 900 });
    ok('строка A/B — мелкая моно-подпись', /font-size:10px/.test(home.d.querySelector('.variant-note').getAttribute('style')));
    const chip = home.d.getElementById('modeChip');
    // Чип показывает текущий режим и ведёт к его объяснению в Learn.
    ok('чип режима — ссылка на объяснение',
       chip.tagName === 'A' && /\/learn#modes/.test(chip.getAttribute('href')) && /MODE · ON/.test(chip.textContent),
       chip.textContent + ' → ' + chip.getAttribute('href'));
  }
  {
    // Прогресс Академии: хаб читает то, что записал урок
    const store = new Map();
    store.set('academy_progress', JSON.stringify([1, 2]));
    const ac = await open('/learn/academy', { store, wait: 900 });
    ok('хаб показывает 2 of 6', ac.d.getElementById('doneCount').textContent === '2',
       ac.d.getElementById('doneCount').textContent);
    ok('CTA прогресса показан', !ac.d.getElementById('saveCta').hidden);
  }

  console.log('\n[Приёмка] Ни одной вечной надписи Loading');
  for (const p of PAGES) {
    const r = await open(p, { slow: 30000, wait: 3600 });
    ok(p + ' — чисто через 3.6с при мёртвой сети', !stuck(r.d),
       visibleText(r.d).match(/Loading[^.]{0,40}/)?.[0]);
  }

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
