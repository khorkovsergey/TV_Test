/* Приёмка релиза: шесть разделов, три режима, Asset Hub, маршруты. */

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

    try { if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text()); else dom.window.eval(s.textContent); }

    catch (e) { events.push('ERR ' + e.message); }

  }

  await new Promise(r => setTimeout(r, opts.wait || 1500));

  return { d: dom.window.document, w: dom.window, events, html, res };

}

const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

const navOf = d => [...d.querySelectorAll('.portal-nav .menu a:not(.nav-panel a)')].map(a => a.textContent.trim());



const SECTIONS = ['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice'];

const PAGES = ['/', '/overview', '/research', '/money', '/trade', '/learn', '/community',

               '/markets', '/screeners', '/symbols/BTCUSD', '/charts', '/learn/academy',

               '/learn/academy/lesson', '/capital/experts', '/staff', '/metrics', '/sitemap'];



(async () => {



  console.log('\n[Архитектура] Шесть разделов');

  const hub = await open('/overview', { wait: 2200 });

  const IA = hub.w.IA;

  ok('шесть верхнеуровневых разделов', IA.SECTIONS.length === 6, IA.SECTIONS.map(s => s.label).join(','));

  /* §P0-A — инвентарь и навигация разошлись намеренно: ia.js остаётся

     каталогом продукта, а меню строится из navigation.js. */

  ok('инвентарь сохранил все шесть разделов', IA.SECTIONS.length === 6);

  ok('пользовательская навигация — из своего реестра',

     JSON.stringify(hub.w.Navigation.SECTIONS.map(s => s.label)) === JSON.stringify(SECTIONS),

     hub.w.Navigation.SECTIONS.map(s => s.label).join(','));

  ok('в навигации ровно шесть пунктов', JSON.stringify(navOf(hub.d)) === JSON.stringify(SECTIONS), navOf(hub.d).join(','));

  const banned = ['Products', 'More', 'Brokers', 'Screeners', 'Ideas', 'Pine', 'Wealth Hub', 'AI Private', 'Expert Marketplace'];

  ok('нет запрещённых верхнеуровневых пунктов',

     banned.every(x => !navOf(hub.d).includes(x)), navOf(hub.d).filter(x => banned.includes(x)).join(','));

  ok('у каждого раздела есть вопрос', IA.SECTIONS.every(s => s.question && s.question.length > 10));



  console.log('\n[Инвентарь] Ничего не потеряно');

  const all = IA.allItems();

  ok('инвентарь не меньше 90 пунктов', all.length >= 90, String(all.length));

  ok('нет дублей по id', new Set(all.map(i => i.id)).size === all.length);

  const MUST = ['screener', 'heatmap', 'calendar', 'earnings', 'dividend', 'ipo', 'news', 'yield',

    'options', 'macro', 'fundamental', 'portfolio', 'broker', 'paper trading', 'pine', 'freelanc|scripts',

    'paid|rewards', 'leap|competition', 'indicators|scripts', 'education|learn', 'help', 'pricing',

    'features', 'market data', 'gift', 'apps', 'widgets', 'charting librar', 'advertising',

    'brokerage|broker integration', 'partner', 'careers', 'blog', 'media kit', 'store|merch',

    'terms', 'privacy', 'cookies', 'accessibility', 'security', 'house rules', 'etf', 'bond',

    'stocks', 'crypto', 'forex', 'indices', 'economy', 'watchlist', 'alerts', 'wealth', 'goals',

    'terminal', 'discussions', 'authors', 'refer'];

  const hay = all.map(i => `${i.label} ${i.desc} ${i.keywords}`.toLowerCase()).join(' | ');

  const missing = MUST.filter(m => !new RegExp(m).test(hay));

  ok(`все ${MUST.length} тем настоящего сайта имеют дом`, missing.length === 0, 'нет: ' + missing.join(', '));



  console.log('\n[Маршруты] Ничего не сломано');

  for (const p of PAGES) {

    const r = await fetch(B + p, { redirect: 'manual' });

    ok(p + ' → ' + r.status, r.status === 200);

  }

  const LEGACY = [['/index.html', '/'], ['/markets.html?cls=crypto', '/markets?cls=crypto'],

    ['/symbol.html?symbol=ETHUSD', '/symbols/ETHUSD'], ['/screener.html', '/screeners'],

    ['/charts.html', '/charts'], ['/academy.html', '/learn/academy'],

    ['/lesson.html', '/learn/academy/lesson'], ['/experts.html', '/capital/experts'],

    ['/directory.html', '/sitemap']];

  for (const [from, to] of LEGACY) {

    const r = await fetch(B + from, { redirect: 'manual' });

    const loc = (r.headers.get('location') || '').replace(B, '');

    ok(`${from} → ${to}`, r.status === 301 && loc === to, `${r.status} ${loc}`);

  }



  console.log('\n[Режимы] Simple / Standard / Pro');

  const store = new Map();

  const home = await open('/', { store, wait: 2000 });

  ok('новый посетитель получает Simple', home.w.Portal.mode() === 'simple', home.w.Portal.mode());

  const sw = home.d.querySelector('.mode-switch');

  // рядом с тремя режимами теперь кнопка «сравнить режимы» — считаем только режимы

  ok('переключатель в шапке', Boolean(sw) && sw.querySelectorAll('[data-mode]').length === 3);

  ok('подписи Simple/Standard/Pro',

     [...sw.querySelectorAll('[data-mode]')].map(b => b.textContent).join(',') === 'Simple,Standard,Pro');

  click(home.w, sw.querySelector('[data-mode="standard"]'));

  ok('режим переключился', home.w.Portal.mode() === 'standard');

  ok('событие mode_changed', home.w.Portal.events().some(e => e.event === 'mode_changed' && e.to === 'standard'));

  ok('переход вверх объяснён', Boolean(home.d.querySelector('.mode-toast')));

  ok('сохраняется', store.get('ui_mode') === 'standard', store.get('ui_mode'));

  click(home.w, sw.querySelector('[data-mode="simple"]'));

  ok('дорога вниз не заблокирована', home.w.Portal.mode() === 'simple');



  const legacy = new Map([['ui_mode', 'beginner']]);

  const old = await open('/', { store: legacy, wait: 1200 });

  ok('старое значение beginner читается как simple', old.w.Portal.mode() === 'simple', old.w.Portal.mode());



  console.log('\n[Меню] Карта, а не указатель');

  ok('панели у всех шести дверей',

     home.d.querySelectorAll('.portal-nav .menu .nav-panel').length === 6,

     String(home.d.querySelectorAll('.portal-nav .menu .nav-panel').length));

  /* Меню по-прежнему карта, а не индекс: сразу видно не больше семи строк.

     Остальное живёт под «More tools» — раньше оно просто удалялось. */

  const rows = [...home.d.querySelectorAll('.portal-nav .menu .nav-panel')]

    .map(p => [...p.querySelectorAll('a')].filter(a => !a.closest('.more-tools')).length);

  ok('ни одна панель не длиннее семи строк', rows.every(n => n <= 7), rows.join(','));

  ok('всё, что не поместилось, доступно под More tools',

     [...home.d.querySelectorAll('.portal-nav .menu .nav-panel')]

       .every(p => p.querySelectorAll('a').length <= 7 || p.querySelector('.more-tools')));

  /* §P0-A — панель ведёт в раздел словами раздела: «Open Markets →».

     «See everything in X» описывало инвентарь, а не задачу. */

  ok('в каждой панели есть вход в раздел',

     [...home.d.querySelectorAll('.portal-nav .menu .nav-panel')].every(p => /Open .+ →/.test(p.textContent)));



  /* Меню открывается нажатием на название раздела, а не на микро-стрелку. */

  const doorLink = home.d.querySelector('.nav-door > a');

  ok('название раздела — цель для клика', doorLink.getAttribute('aria-haspopup') === 'true');

  ok('закрыто по умолчанию', doorLink.getAttribute('aria-expanded') === 'false');

  click(home.w, doorLink);

  ok('клик по названию открывает меню', doorLink.getAttribute('aria-expanded') === 'true');

  ok('панель раскрыта', doorLink.closest('.nav-door').classList.contains('open'));

  ok('событие nav_menu_opened', home.w.Portal.events().some(e => e.event === 'nav_menu_opened'));

  click(home.w, doorLink);

  ok('повторный клик закрывает', doorLink.getAttribute('aria-expanded') === 'false');

  ok('отдельной кнопки-каретки больше нет', home.d.querySelectorAll('.nav-caret').length === 0);

  ok('название пункта осталось чистым', doorLink.textContent.trim() === 'Markets', doorLink.textContent);

  /* Клик с модификатором обязан вести в раздел, а не открывать меню. */

  const ev = new home.w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });

  doorLink.dispatchEvent(ev);

  ok('ctrl+клик по-прежнему открывает раздел', !ev.defaultPrevented);



  console.log('\n[Хаб раздела] Всё видно, глубина помечена');

  ok('полка отрисована', hub.d.querySelectorAll('#shelf .tv-card').length >= 3);

  ok('в полке есть статусы', /LIVE|PILOT|MAPPED/.test(hub.d.getElementById('shelf').textContent));

  /* Глубина теперь складывается в раскрывающийся блок «Advanced» (§7.1),

     но остаётся в DOM и в разделе — свёрнута, а не удалена. */

  const adv = hub.d.querySelector('#shelf .advanced');

  ok('глубина свёрнута в Advanced, а не удалена', Boolean(adv) && /Advanced —/.test(adv.textContent));

  ok('в блоке названо, сколько и в каком режиме', /more tools?,\s*shown first in/.test(adv.textContent),

     adv.textContent.trim().slice(0, 80));

  ok('свёрнутые пункты остались ссылками', adv.querySelectorAll('a[data-ia]').length > 0);

  ok('есть следующий логичный шаг', /NEXT LOGICAL STEP/.test(hub.d.getElementById('next').textContent));

  for (const p of ['/research', '/money', '/trade', '/learn', '/community']) {

    const s = await open(p, { wait: 1400 });

    ok(p + ' — без ошибок', !s.events.some(e => e.startsWith('ERR')), s.events.filter(e => e.startsWith('ERR'))[0]);

    /* /money — не хаб-раздел: это рабочий продукт со своим экраном,

       поэтому полки инвентаря там нет по замыслу. */

    if (p !== '/money') {

      ok(p + ' — полка и следующий шаг', s.d.querySelectorAll('#shelf .tv-card').length >= 2 && /NEXT LOGICAL STEP/.test(s.d.getElementById('next').textContent));

    } else {

      ok('/money — вход по задаче, а не полка', s.d.querySelectorAll('[data-choice]').length === 6);

    }

  }



  console.log('\n[Asset Hub]');

  // живой запрос котировки: 2.5 с иногда не хватает, и тогда карточка ещё пуста

  const ah = await open('/symbols/BTCUSD', { wait: 4000 });

  ok('символ взят из пути', ah.d.getElementById('assetName').textContent === 'Bitcoin', ah.d.getElementById('assetName').textContent);

  ok('в Simple пять вкладок открыто сразу', ah.d.querySelectorAll('#hubTabs > [data-tab]').length === 5,

     String(ah.d.querySelectorAll('#hubTabs > [data-tab]').length));

  ok('остальные не удалены, а под More', ah.d.querySelectorAll('#hubTabs .tab-more [data-tab]').length === 4,

     String(ah.d.querySelectorAll('#hubTabs .tab-more [data-tab]').length));

  ok('подпись объясняет, где остальные', /open from More here/.test(ah.d.getElementById('tabNote').textContent),

     ah.d.getElementById('tabNote').textContent);

  ok('чип события с действием', /FOMC/.test(ah.d.getElementById('eventChip').textContent) &&

     Boolean(ah.d.querySelector('#eventChip [data-act="follow"]')));

  ok('панель действий', ah.d.querySelectorAll('#actionBar a, #actionBar button').length >= 3);

  /* §ASSET-003 — «above their reference» ничего не сообщало: непонятно,

     относительно чего. Теперь названо, что именно меряет каждое чтение. */

  /* Проверяем смысл, а не вёрстку: перенос строки внутри абзаца не должен

     ронять тест — на этом уже попались дважды. */

  const rating = ah.d.getElementById('ratingBox').textContent.replace(/\s+/g, ' ');

  ok('сводка объяснена, а не сведена к вердикту',

     /put the current price above the level each one measures/.test(rating), rating.slice(0, 80));

  ok('названы пороги', /Thresholds: price vs the 5- and 20-day averages/.test(rating));

  ok('время взято из котировки, а не из часов браузера', /Quote as of/.test(rating));



  ok('назван таймфрейм', /Timeframe: daily closes/.test(rating));

  ok('названы противоречия', /Contradictions:/.test(ah.d.getElementById('ratingBox').textContent));

  ok('сказано, что это не рекомендация', /not a recommendation/.test(ah.d.getElementById('ratingBox').textContent));

  ok('нет голого Buy/Sell', !/\bBuy\b|\bSell\b/.test(ah.d.getElementById('ratingBox').textContent));



  const ahStore = new Map([['ui_mode', 'pro']]);

  const ahPro = await open('/symbols/BTCUSD', { store: ahStore, wait: 2500 });

  ok('в Pro девять вкладок', ahPro.d.querySelectorAll('#hubTabs button').length === 9,

     String(ahPro.d.querySelectorAll('#hubTabs button').length));

  ok('в Pro больше действий', ahPro.d.querySelectorAll('#actionBar a, #actionBar button').length >= 8);



  console.log('\n[My Money] Живое, а не обещанное');

  const capStore = new Map([['watchlist', JSON.stringify(['BTCUSD', 'AAPL'])]]);

  const cap = await open('/money', { store: capStore, wait: 2500 });

  /* §3.3 — вотчлист уехал в workspace за профилем: раздел про деньги

     больше не открывается списком инструментов. */

  ok('вотчлист доступен из workspace',

     /Watchlists/.test(cap.d.querySelector('.portal-nav').textContent));

  const capEmpty = await open('/money', { wait: 1800 });

  ok('пустое состояние предлагает действие',

     capEmpty.d.querySelectorAll('[data-choice]').length === 6,

     String(capEmpty.d.querySelectorAll('[data-choice]').length));



  console.log('\n[Палитра] Поиск и действия');

  click(home.w, home.d.querySelector('.portal-nav .search'));

  const cmd = home.d.querySelector('.cmd');

  ok('палитра открывается', Boolean(cmd));

  const input = cmd.querySelector('input');

  const probe = async (q, want) => {

    input.value = q;

    input.dispatchEvent(new home.w.Event('input', { bubbles: true }));

    await new Promise(r => setTimeout(r, 700));

    ok(`«${q}» находит ${want}`, new RegExp(want, 'i').test(cmd.textContent), cmd.querySelector('.row')?.textContent?.trim().slice(0, 70));

  };

  await probe('watchlist', 'watchlist');

  await probe('paper', 'paper trading');

  await probe('yield', 'yield');

  await probe('pro mode', 'Pro mode');

  await probe('xauusd', 'XAUUSD');

  input.value = 'add';

  input.dispatchEvent(new home.w.Event('input', { bubbles: true }));

  await new Promise(r => setTimeout(r, 500));

  ok('действия отделены от страниц', /Action/.test(cmd.textContent), cmd.querySelector('.row')?.textContent?.trim().slice(0, 70));



  console.log('\n[Единство] Шапка и футер на всех страницах');

  const navs = new Set(), footers = new Set();

  for (const p of PAGES) {

    const r = await open(p, { wait: 700 });

    ok(p + ' — без ошибок', !r.events.some(e => e.startsWith('ERR')), r.events.filter(e => e.startsWith('ERR'))[0]);

    navs.add(r.html.match(/<div class="menu">([\s\S]*?)<\/div>/)[1].replace(/ class="active"/g, '').replace(/\s+/g, ' ').trim());

    footers.add(r.html.match(/<footer class="portal-footer">([\s\S]*?)<\/footer>/)[1].replace(/\s+/g, ' ').trim());

    ok(p + ' — Copilot смонтирован', Boolean(r.d.querySelector('.cp-fab')));

    ok(p + ' — переключатель режима', Boolean(r.d.querySelector('.mode-switch')));

  }

  ok('навигация одинакова на 17 страницах', navs.size === 1, String(navs.size));

  ok('футер одинаков', footers.size === 1, String(footers.size));

  ok('в футере шесть групп', ([...footers][0].match(/<div class="col">/g) || []).length === 6);

  ok('нет мёртвых ссылок в футере', !/href="#"/.test([...footers][0]));



  console.log('\n[Сохранено] Ничего из прошлых релизов не потеряно');

  /* §9.1 — задача про деньги стала первой, плиток девять; выше сгиба

     в Simple видно три. */

  ok('главная — задачи и выход в воркспейс',

     home.d.querySelectorAll('.routes [data-route]').length >= 8 &&

     home.d.querySelector('.routes [data-route]').dataset.route === 'manage_money',

     home.d.querySelector('.routes [data-route]')?.dataset.route);

  ok('первый экран не ведёт в прайсинг', !/Get started|See plans/i.test(home.d.querySelector('main').textContent));

  const ac = await open('/learn/academy', { wait: 1500 });

  ok('Академия: шесть уроков', ac.d.querySelectorAll('.lesson').length === 6);

  const ex = await open('/capital/experts', { wait: 1200 });

  ok('Эксперты: форма заявки жива', Boolean(ex.d.getElementById('buildBrief')));

  const mk2 = await open('/markets', { wait: 2500 });

  ok('Рынки: 49 инструментов', mk2.d.querySelectorAll('#rows tr').length === 49,

     String(mk2.d.querySelectorAll('#rows tr').length));

  const sc = await open('/screeners', { wait: 2500 });

  ok('Скринер: пресеты-вопросы', sc.d.querySelectorAll('#presets .preset').length === 8);

  const ch = await open('/charts', { wait: 2500 });

  /* Прежняя гарантия «линия построена» описывала прототип из двадцати
     закрытий. Теперь страница рисует настоящие свечи по OHLCV — проверяем то,
     что есть, а не то, что удалено. */
  ok('График: свечи построены', ch.d.querySelectorAll('.ch-candle').length > 20,
     String(ch.d.querySelectorAll('.ch-candle').length));

  const sm = await open('/sitemap', { wait: 1500 });

  ok('Карта сайта: секции по разделам',

     ['overview', 'research', 'capital', 'trade', 'learn', 'community'].every(id => sm.d.getElementById(id)));



  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);

  process.exit(fail ? 1 : 0);

})();

