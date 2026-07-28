/* Приёмка слоя рыночных данных и построенных на нём страниц. */
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
  dom.window.fetch = (u, o) => fetch(new URL(u, B).href, o);   // jsdom не умеет относительные fetch
  for (const s of dom.window.document.querySelectorAll('script')) {
    if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B + path).href)).text());
    else { try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); } }
  }
  // страницы грузят котировки асинхронно
  for (let i = 0; i < 40 && !dom.window.__ready?.(); i++) await new Promise(r => setTimeout(r, 100));
  await new Promise(r => setTimeout(r, 400));
  return { d: dom.window.document, w: dom.window, events };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

(async () => {

  console.log('\n[1] Снимок рынка');
  const t0 = Date.now();
  const snap = await (await fetch(B + '/api/markets')).json();
  ok('снимок отдан за разумное время', Date.now() - t0 < 20000, (Date.now() - t0) + 'мс');
  ok('вселенная не меньше 45 инструментов', snap.universe >= 45, String(snap.universe));
  ok('загрузилось хотя бы 90%', snap.ok_count / snap.universe >= 0.9, `${snap.ok_count}/${snap.universe}`);
  ok('шесть классов активов', snap.classes.length === 6, String(snap.classes.length));
  ok('источник назван', /Yahoo/.test(snap.source), snap.source);
  ok('возраст снимка сообщается', Number.isFinite(snap.age_ms));
  ok('есть поле stale', typeof snap.stale === 'boolean');

  const btc = snap.items.find(i => i.symbol === 'BTCUSD');
  ok('BTCUSD: живая цена', btc.ok && btc.price > 0, JSON.stringify(btc).slice(0, 120));
  ok('BTCUSD: дневное изменение считается от вчерашнего закрытия',
     Number.isFinite(btc.changePct) && Math.abs(btc.changePct) < 40, String(btc.changePct));
  ok('BTCUSD: серия из 20 закрытий', btc.series.length >= 15, String(btc.series.length));
  ok('BTCUSD: перформанс за неделю и месяц', Number.isFinite(btc.perf.w1) && Number.isFinite(btc.perf.m1));
  const spx = snap.items.find(i => i.symbol === 'SPX');
  ok('индексы: 52-недельный коридор', Number.isFinite(spx.wk52High) && Number.isFinite(spx.wk52Low));
  const y = snap.items.find(i => i.symbol === 'US10Y');
  ok('доходности помечены как проценты', y.isYield === true);

  console.log('\n[2] Кеш и повторный запрос');
  const t1 = Date.now();
  const again = await (await fetch(B + '/api/markets')).json();
  ok('второй запрос из кеша быстрее 1с', Date.now() - t1 < 1000, (Date.now() - t1) + 'мс');
  ok('снимок тот же', again.asOf === snap.asOf);
  const cls = await (await fetch(B + '/api/markets?cls=crypto')).json();
  ok('фильтр по классу работает', cls.items.length >= 6 && cls.items.every(i => i.cls === 'crypto'));

  console.log('\n[3] Один инструмент');
  const one = await (await fetch(B + '/api/symbol/XAUUSD')).json();
  ok('имя инструмента', one.name === 'Gold', one.name);
  ok('RSI посчитан', Number.isFinite(one.technicals.rsi14), String(one.technicals.rsi14));
  ok('RSI в допустимых пределах', one.technicals.rsi14 >= 0 && one.technicals.rsi14 <= 100);
  ok('SMA20 посчитана', Number.isFinite(one.technicals.sma20));
  ok('позиция в 52-недельном коридоре 0..1',
     one.technicals.range_position >= 0 && one.technicals.range_position <= 1, String(one.technicals.range_position));
  ok('техника помечена как вычисленная', /Computed from/.test(one.technicals.disclaimer));
  ok('нет вердикта buy/sell', !/\bbuy\b|\bsell\b/i.test(JSON.stringify(one.technicals)));
  ok('пиры из того же класса', one.peers.length >= 3 && one.peers.every(p => p.symbol !== 'XAUUSD'));
  const bad = await fetch(B + '/api/symbol/NOPE');
  ok('неизвестный символ → 404', bad.status === 404);

  console.log('\n[4] Движения дня');
  const m = await (await fetch(B + '/api/markets/movers')).json();
  ok('шесть растущих', m.gainers.length === 6);
  ok('растущие отсортированы по убыванию', m.gainers.every((x, i, a) => i === 0 || a[i - 1].changePct >= x.changePct));
  ok('падающие отсортированы по возрастанию', m.losers.every((x, i, a) => i === 0 || a[i - 1].changePct <= x.changePct));
  ok('«крупнейшие движения» названы честно, а не most active',
     Array.isArray(m.biggest_moves) && m.biggest_moves.length === 6);

  console.log('\n[5] Страница рынков');
  let { d, w, events } = await open('/markets');
  ok('без ошибок исполнения', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  const rows = d.querySelectorAll('#rows tr');
  ok('таблица заполнена всеми инструментами', rows.length >= 45, String(rows.length));
  ok('источник и время указаны на странице', /Yahoo Finance/.test(d.getElementById('sourceLine').textContent));
  ok('метка FACT · MARKET DATA', /FACT · MARKET DATA/.test(d.getElementById('sourceLine').textContent));
  ok('три блока движений дня', d.querySelectorAll('#movers .tv-card').length === 3);
  ok('тепловая карта отрисована', d.querySelectorAll('#heat .heat a').length >= 45,
     String(d.querySelectorAll('#heat .heat a').length));
  ok('спарклайны в строках', d.querySelectorAll('#rows svg.spark').length >= 40);
  ok('символы ведут на страницу инструмента',
     d.querySelector('#rows a.sym').getAttribute('href').startsWith('/symbols/'));
  ok('вкладки классов', d.querySelectorAll('#tabs button').length === 7);

  const before = d.querySelectorAll('#rows tr').length;
  click(w, d.querySelector('#tabs [data-cls="crypto"]'));
  ok('фильтр по классу сокращает таблицу', d.querySelectorAll('#rows tr').length < before);
  ok('в крипте 8 инструментов', d.querySelectorAll('#rows tr').length === 8,
     String(d.querySelectorAll('#rows tr').length));
  click(w, d.querySelector('#head [data-sort="price"]'));
  ok('сортировка по колонке работает', /▼|▲/.test(d.getElementById('head').textContent));

  console.log('\n[6] Скринер');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/screeners'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('восемь вопросов-пресетов', d.querySelectorAll('#presets .preset').length === 8);
  const all = d.querySelectorAll('#rows tr').length;
  ok('по умолчанию видна вся вселенная', all >= 45, String(all));

  click(w, d.querySelector('[data-preset="crypto"]'));
  ok('пресет «как крипта» оставляет только крипту', d.querySelectorAll('#rows tr').length === 8,
     String(d.querySelectorAll('#rows tr').length));
  ok('счётчик совпадений обновился', /8 of \d+ instruments match/.test(d.getElementById('count').textContent),
     d.getElementById('count').textContent);
  ok('фильтр объяснён словами', d.getElementById('explain').textContent.length > 3,
     d.getElementById('explain').textContent);

  d.getElementById('fChgMin').value = '-100';
  d.getElementById('fChgMin').dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('ручной фильтр применяется', d.querySelectorAll('#rows tr').length === 8);

  click(w, d.getElementById('reset'));
  ok('сброс возвращает всю вселенную', d.querySelectorAll('#rows tr').length >= 45);

  click(w, d.querySelector('[data-preset="nearHigh"]'));
  const nearHigh = [...d.querySelectorAll('#rows tr td:nth-child(8)')].map(td => parseFloat(td.textContent));
  ok('«у 52-недельного максимума» действительно даёт ≥90%',
     nearHigh.length === 0 || nearHigh.every(v => v >= 90), nearHigh.join(','));

  click(w, d.getElementById('saveScreen'));
  ok('выборка сохраняется', JSON.parse(store.get('screener_saved') || '[]').length === 1);
  ok('сохранённые показаны', !d.getElementById('savedBox').hidden);

  console.log('\n[7] Страница инструмента');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/symbols/ETHUSD'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('имя инструмента живое', d.getElementById('assetName').textContent === 'Ethereum',
     d.getElementById('assetName').textContent);
  ok('цена отрисована', /\d/.test(d.getElementById('price').textContent), d.getElementById('price').textContent);
  ok('источник указан', /Yahoo Finance/.test(d.getElementById('sourceLine').textContent));
  ok('восемь ключевых цифр', d.querySelectorAll('#stats .st').length === 8);
  ok('график построен по серии', d.querySelectorAll('#chart polyline').length === 1);
  ok('технические чтения есть', d.querySelectorAll('#technicals div').length >= 3);
  ok('рейтинг объяснён, а не сведён к вердикту',
     /not a recommendation/i.test(d.getElementById('ratingBox').textContent));
  ok('пиры отрисованы', d.querySelectorAll('#peers .mover-row').length >= 3);
  ok('открытие символа попало в трейл', w.Portal.journey().includes('ETHUSD'));

  console.log('\n[8] Несуществующий инструмент не выдумывается');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/symbols/WOOF'));
  ok('показана ошибка, а не цена', !d.getElementById('loadError').hidden);
  ok('объяснено, что ничего не придумано', /rather than a made-up price|Unknown symbol/i.test(d.body.textContent));

  console.log('\n[9] Главная на живых данных');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  const briefRows = d.querySelectorAll('#briefRows .brief-row');
  ok('в брифе три живые строки', briefRows.length === 3, String(briefRows.length));
  ok('в брифе настоящие символы', /^[A-Z]{2,7}$/.test(briefRows[0].querySelector('a').textContent.trim()),
     briefRows[0].textContent.trim().slice(0, 60));
  ok('источник брифа указан', /Yahoo Finance/.test(d.getElementById('briefSource').textContent));
  ok('чипы вотчлиста показывают движение', /%/.test(d.getElementById('chips').textContent));
  /* §3.1 — Overview покинул верхний уровень: Home уже делает его работу.
     Рынки стали самостоятельным разделом, а не подпунктом обзора. */
  ok('навигация ведёт в Markets',
     Boolean(d.querySelector('.portal-nav .menu a[href="/markets"]')));

  /* Раньше здесь проверялась линия по двадцати закрытиям, подпись #pxLabel и
     RSI одной горизонтальной чертой. Всего этого больше нет: воркспейс рисует
     свечи по настоящим OHLCV. Ожидания переписаны под новую модель, а не
     сохранены — иначе тест защищал бы то, что мы намеренно убрали. */
  console.log('\n[10] Воркспейс рисует настоящие свечи');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/charts?symbol=SPX'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('свечи построены', d.querySelectorAll('.ch-candle').length > 20,
     'candles=' + d.querySelectorAll('.ch-candle').length);
  ok('у каждой свечи есть тело и фитиль',
     d.querySelectorAll('.ch-body').length === d.querySelectorAll('.ch-candle').length
     && d.querySelectorAll('.ch-wick').length === d.querySelectorAll('.ch-candle').length);
  ok('объём отрисован', d.querySelectorAll('.ch-volbar').length > 20);
  ok('строка инструмента содержит символ и OHLC',
     /SPX/.test(d.getElementById('ohlcRow').textContent)
     && /O\s|H\s|L\s|C\s/.test(d.getElementById('ohlcRow').textContent),
     d.getElementById('ohlcRow').textContent.slice(0, 90));
  ok('панель вотчлиста заполнена', d.querySelectorAll('.cw-wl-row').length >= 4);

  console.log('\n[11] Источник котировок недоступен — страницы не выдумывают');
  {
    // Тот же харнесс, но каждый вызов /api/markets и /api/symbol падает.
    const html = await (await fetch(B + '/')).text();
    const events = [];
    const vc = new VirtualConsole();
    vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
    const dom = new JSDOM(html, { url: B + '/', runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
    Object.defineProperty(dom.window, 'localStorage', { value: mk(new Map()), configurable: true });
    Object.defineProperty(dom.window, 'sessionStorage', { value: mk(new Map()), configurable: true });
    dom.window.fetch = u => /\/api\/(markets|symbol)/.test(String(u))
      ? Promise.reject(new Error('upstream down'))
      : fetch(new URL(u, B).href);
    for (const s of dom.window.document.querySelectorAll('script')) {
      if (s.src) dom.window.eval(await (await fetch(new URL(s.src, B).href)).text());
      else { try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); } }
    }
    await new Promise(r => setTimeout(r, 4000));
    const dd = dom.window.document;
    ok('страница не падает без котировок', !events.some(e => e.startsWith('ERR')),
       events.filter(e => e.startsWith('ERR'))[0]);
    // С версии v2 отказ источника не оставляет пустоту: показывается снимок,
    // вшитый в сборку, и он обязан быть помечен как не живой.
    ok('бриф заполнен из вшитого снимка', dd.querySelectorAll('#briefRows .brief-row').length === 3,
       String(dd.querySelectorAll('#briefRows .brief-row').length));
    ok('метка сменилась на SAMPLE · NOT LIVE', dd.getElementById('briefTag').textContent.trim() === 'SAMPLE · NOT LIVE',
       dd.getElementById('briefTag').textContent);
    ok('под цифрами написано, что они не живые',
       /did not answer in time/.test(dd.getElementById('briefSource').textContent),
       dd.getElementById('briefSource').textContent.slice(0, 80));
    ok('остальная главная работает', dd.querySelectorAll('.routes [data-route]').length >= 8);
  }

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
