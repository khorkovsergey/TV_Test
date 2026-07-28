/* Приёмка Progressive Complexity + Contextual Research Journey. */
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
  vc.on('log', (...a) => events.push(a.map(String).join(' ')));
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
  return { d: dom.window.document, w: dom.window, events };
}
const click = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const vis = el => el && !el.hidden && el.style.display !== 'none';

(async () => {

  console.log('\n[1] Воркспейс открывается в beginner');
  store.clear(); session.clear();
  let { d, w, events } = await open('/charts');
  ok('без ошибок исполнения', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('режим по умолчанию beginner', w.Portal.mode() === 'simple', w.Portal.mode());
  ok('активна кнопка Beginner', d.querySelector('#modePill .on').dataset.mode === 'simple');
  ok('открыто 3 инструмента из 9', d.querySelectorAll('.toolrail .t:not(.locked)').length === 3,
     String(d.querySelectorAll('.toolrail .t:not(.locked)').length));
  /* §CHART-002 — было «3 of 40 tools», а сорока инструментов здесь никогда
     не было: три рисовалки и восемь кнопок тулбара. Считать декоративные
     кнопки возможностями — та самая мелкая инфляция, из-за которой перестают
     верить крупным заявлениям. */
  ok('подпись рельса «3 of 11»', d.getElementById('toolCap').textContent === '3 of 11 controls',
     d.getElementById('toolCap').textContent);
  ok('боковая панель скрыта', d.getElementById('sidePanel').hidden);
  ok('пункты тулбара standard скрыты', [...d.querySelectorAll('[data-min="standard"]:not(.t)')].every(el => !vis(el)));
  // Инструменты не прячутся, а тушатся: видно, что впереди есть куда расти.
  ok('закрытые инструменты видны, но притушены',
     [...d.querySelectorAll('.toolrail .t.locked')].every(el => vis(el) && el.title));
  ok('слайдер плотности скрыт', !vis(d.querySelector('.density')));
  ok('pro-оверлей прозрачен', d.getElementById('proOverlay').style.opacity === '0');
  ok('модуль новостей диапазона скрыт', d.getElementById('rangeNews').hidden);
  ok('подсказка beginner видна', vis(d.getElementById('hintbar')));
  ok('событие mode_switch source=default при первом назначении',
     w.Portal.events().some(e => e.event === 'mode_switch' && e.source === 'default'));

  console.log('\n[2] Standard включается без перезагрузки');
  click(w, d.querySelector('#modePill [data-mode="standard"]'));
  ok('режим standard', w.Portal.mode() === 'standard');
  ok('открыто 6 инструментов', d.querySelectorAll('.toolrail .t:not(.locked)').length === 6,
     String(d.querySelectorAll('.toolrail .t:not(.locked)').length));
  ok('боковая панель показана', !d.getElementById('sidePanel').hidden);
  ok('сетка получила колонку панели', d.getElementById('shell').classList.contains('with-panel'));
  ok('Indicators/Alert/Replay видны', [...d.querySelectorAll('[data-min="standard"]')].every(vis));
  ok('pro-пункты всё ещё скрыты', [...d.querySelectorAll('[data-min="pro"]:not(.t)')].every(el => !vis(el)));
  ok('pro-инструменты остаются закрытыми', d.querySelectorAll('.toolrail .t.locked').length === 3);
  ok('новости диапазона появились', !d.getElementById('rangeNews').hidden);
  ok('подсказка beginner убрана', d.getElementById('hintbar').style.display === 'none');
  ok('событие mode_switch source=pill',
     w.Portal.events().some(e => e.event === 'mode_switch' && e.source === 'pill' && e.to === 'standard'));

  console.log('\n[3] «Full interface →» даёт pro мгновенно');
  click(w, d.getElementById('fullBtn'));
  ok('режим pro', w.Portal.mode() === 'pro');
  ok('открыты все 9 инструментов', d.querySelectorAll('.toolrail .t:not(.locked)').length === 9);
  ok('подпись «11 of 11»', d.getElementById('toolCap').textContent === '11 of 11 controls',
     d.getElementById('toolCap').textContent);
  ok('pro-пункты тулбара видны', [...d.querySelectorAll('.tb-item[data-min="pro"]')].every(vis));
  ok('multi-pane показан', d.getElementById('proOverlay').style.opacity === '1');
  ok('источник события full_button',
     w.Portal.events().some(e => e.event === 'mode_switch' && e.source === 'full_button' && e.to === 'pro'));

  console.log('\n[4] Дорога назад ничем не заблокирована');
  click(w, d.querySelector('.mode-switch [data-mode="simple"]'));
  ok('вернулись в beginner', w.Portal.mode() === 'simple');
  ok('инструментов снова 3', d.querySelectorAll('.toolrail .t:not(.locked)').length === 3);
  ok('панель снова скрыта', d.getElementById('sidePanel').hidden);
  ok('multi-pane снова скрыт', d.getElementById('proOverlay').style.opacity === '0');

  console.log('\n[5] Плотность');
  click(w, d.querySelector('#modePill [data-mode="standard"]'));
  const dens = d.getElementById('density');
  dens.value = '3';
  dens.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('атрибут data-density на оболочке', d.getElementById('shell').dataset.density === '3');
  ok('значение сохранено', w.Portal.density() === 3, String(w.Portal.density()));
  dens.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('событие density_changed', w.Portal.events().some(e => e.event === 'density_changed'));

  console.log('\n[6] feature_first_use');
  click(w, d.querySelector('[data-feature="tool_fib"]'));
  ok('первое использование инструмента засчитано',
     w.Portal.events().some(e => e.event === 'feature_first_use' && e.feature === 'tool_fib' && e.mode === 'standard'));
  const before = w.Portal.events().filter(e => e.event === 'feature_first_use').length;
  click(w, d.querySelector('[data-feature="tool_fib"]'));
  ok('повторное использование не дублируется',
     w.Portal.events().filter(e => e.event === 'feature_first_use').length === before);

  console.log('\n[7] chart_first_session_exit');
  w.dispatchEvent(new w.Event('pagehide'));
  ok('событие выхода с режимом',
     w.Portal.events().some(e => e.event === 'chart_first_session_exit' && e.mode === 'standard'),
     JSON.stringify(w.Portal.events().filter(e => e.event === 'chart_first_session_exit')));

  console.log('\n[8] Режим переживает переход и виден Академии');
  ({ d, w, events } = await open('/charts'));
  ok('режим восстановлен из localStorage', w.Portal.mode() === 'standard', w.Portal.mode());
  ok('плотность восстановлена', d.getElementById('shell').dataset.density === '3');
  ({ d, w, events } = await open('/learn/academy'));
  ok('Академия и шапка видят один режим', w.Portal.mode() === 'standard', w.Academy.mode());
  ok('ui_mode хранится без кавычек', store.get('ui_mode') === 'standard', store.get('ui_mode'));
  click(w, d.querySelector('.mode-switch [data-mode="simple"]'));
  ok('переключение из Академии меняет общий режим', w.Portal.mode() === 'simple');
  ok('mode_switch виден в буфере Академии',
     w.Academy.events().some(e => e.event === 'mode_switch' && e.to === 'simple'));

  console.log('\n[9] Страница символа: рельс исследования');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/symbols/ETHUSD'));
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);
  ok('символ из query', d.getElementById('assetName').textContent === 'Ethereum');
  ok('открытие символа само стало шагом', w.Portal.journey().includes('ETHUSD'), JSON.stringify(w.Portal.journey()));
  ok('в рельсе четыре рекомендации', d.querySelectorAll('#steps .next-step').length === 4);
  ok('трейл отрисован', d.getElementById('trail').textContent.includes('ETHUSD'));
  ok('есть подсказка следующего шага', /suggested:/.test(d.getElementById('trail').textContent));

  const peers = d.querySelector('[data-rule="peers"]');
  click(w, peers);
  ok('клик расширил трейл', /Peers in this class/.test(d.getElementById('trail').textContent),
     d.getElementById('trail').textContent);
  ok('шаг сохранён в research_journey',
     JSON.parse(store.get('research_journey')).some(x => /Peers/.test(x)));
  ok('событие journey_step с правилом',
     w.Portal.events().some(e => e.event === 'journey_step' && e.rule === 'peers' && e.from === 'symbol'));
  ok('следующая подсказка сменилась на sector',
     /Sector/.test(d.getElementById('trail').textContent), d.getElementById('trail').textContent);

  click(w, d.querySelector('[data-rule="related"]'));
  ok('правило News → related assets работает',
     w.Portal.events().some(e => e.event === 'journey_step' && e.rule === 'related'));

  ok('research_journey остаётся массивом строк — Copilot читает его как есть',
     JSON.parse(store.get('research_journey')).every(x => typeof x === 'string'));

  console.log('\n[10] Модуль «Chart → новости диапазона»');
  ({ d, w, events } = await open('/charts'));
  click(w, d.querySelector('#modePill [data-mode="standard"]'));
  const rn = d.getElementById('rangeNews');
  ok('модуль виден в standard', !rn.hidden);
  ok('помечен как AI · SOURCED', /AI · SOURCED/.test(rn.textContent));
  click(w, d.getElementById('explainMove'));
  ok('клик даёт journey_step правила range_news',
     w.Portal.events().some(e => e.event === 'journey_step' && e.rule === 'range_news'));

  console.log('\n[11] Трейл на главной');
  ({ d, w, events } = await open('/'));
  ok('главная показывает накопленный трейл', /ETHUSD/.test(d.getElementById('trail').textContent),
     d.getElementById('trail').textContent);
  ok('кнопка продолжения предлагает следующий шаг',
     /Suggested next:/.test(d.getElementById('continueText').textContent),
     d.getElementById('continueText').textContent);
  ok('маршрут 02 ведёт на страницу символа',
     d.querySelector('[data-route="research_asset"]').getAttribute('href').startsWith('/symbols/BTCUSD'));

  console.log('\n[12] Пустое состояние не ломается');
  store.clear(); session.clear();
  ({ d, w, events } = await open('/'));
  // С версии v2 карточка трейла прячется, пока истории нет: пустая «Continue →»
  // обещала бы нить, которую посетитель ещё не начинал.
  ok('карточка трейла скрыта у нового посетителя', d.getElementById('journeyCard').hidden);
  ok('без ошибок', !events.some(e => e.startsWith('ERR')), events.filter(e => e.startsWith('ERR'))[0]);

  console.log('\n[13] Регрессия навигации и Copilot');
  const NAV = ['Markets', 'Research', 'My Money', 'Learn', 'Community', 'Practice'];
  for (const p of ['/charts', '/symbols/BTCUSD']) {
    store.clear(); session.clear();
    const page = await open(p);
    const nav = [...page.d.querySelectorAll('.portal-nav .menu a:not(.nav-panel a)')].map(a => a.textContent.trim());
    ok(p + ' — 6 пунктов', JSON.stringify(nav) === JSON.stringify(NAV), nav.join(','));
    ok(p + ' — виджет Copilot', Boolean(page.d.querySelector('.cp-fab')));
    ok(p + ' — дисклеймер', /not investment advice/i.test(page.d.body.textContent));
  }

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
