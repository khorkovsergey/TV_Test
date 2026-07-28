/* Проверка сценария приёмки Beginner Academy в jsdom.
   Прогоняем именно то, что записано в критериях спеки. */
const { JSDOM, VirtualConsole } = require('jsdom');
const B = process.env.TEST_BASE || 'http://127.0.0.1:3217';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
};

/* Общее хранилище между «переходами» — имитируем один браузер. */
const store = new Map();
function makeStorage() {
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
}

async function open(path) {
  const events = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => events.push('ERR ' + (e.message || e)));
  vc.on('log', (...a) => events.push(a.map(String).join(' ')));

  const res = await fetch(B + path);
  const html = await res.text();
  const dom = new JSDOM(html, {
    url: B + path, runScripts: 'outside-only', resources: 'usable',
    virtualConsole: vc, pretendToBeVisual: true
  });
  Object.defineProperty(dom.window, 'localStorage', { value: makeStorage(), configurable: true });
  // Скрипты уже могли выполниться — перевыполним их с нашим storage.
  for (const s of dom.window.document.querySelectorAll('script')) {
    if (s.src) {
      const r = await fetch(new URL(s.src, B + path).href);
      dom.window.eval(await r.text());
    } else {
      try { dom.window.eval(s.textContent); } catch (e) { events.push('ERR ' + e.message); }
    }
  }
  await new Promise(r => setTimeout(r, 60));
  return { dom, d: dom.window.document, w: dom.window, events };
}

const stateOf = (d, id) => {
  const el = d.querySelector(`.lesson[data-lesson="${id}"]`);
  return el ? [...el.classList].find(c => ['done','current','locked','available'].includes(c)) : null;
};

(async () => {
  console.log('\n[1] Новый пользователь открывает /academy.html');
  let { d, w, events } = await open('/learn/academy');
  ok('трек отрисован (6 уроков)', d.querySelectorAll('.lesson').length === 6,
     'найдено ' + d.querySelectorAll('.lesson').length);
  ok('шаги 4-6 заблокированы',
     ['4','5','6'].every(i => stateOf(d, i) === 'locked'),
     [4,5,6].map(i => i + ':' + stateOf(d, i)).join(' '));
  ok('шаг 1 — текущий', stateOf(d, 1) === 'current', '1:' + stateOf(d, 1));
  ok('шаги 2-3 доступны', ['2','3'].every(i => stateOf(d, i) === 'available'));
  ok('CTA «Save my progress» скрыт при нуле уроков', d.getElementById('saveCta').hidden);
  ok('режим по умолчанию beginner', w.Academy.mode() === 'simple', w.Academy.mode());
  ok('в beginner скрыты продвинутые пункты меню',
     [...d.querySelectorAll('[data-advanced]')].every(el => el.hidden));
  ok('дисклеймер на странице', /not investment advice/i.test(d.body.textContent));
  ok('нет ошибок исполнения', !events.some(e => e.startsWith('ERR')),
     events.filter(e => e.startsWith('ERR'))[0]);

  console.log('\n[2] Проходит урок 3 в /lesson.html');
  ({ d, w, events } = await open('/learn/academy/lesson'));
  ok('рельс инструментов: открыто 3 из 8',
     d.querySelectorAll('.toolrail .t:not([disabled])').length === 3,
     'открыто ' + d.querySelectorAll('.toolrail .t:not([disabled])').length);
  ok('заблокированный инструмент объясняет, когда откроется',
     /unlocks at step/i.test(d.querySelector('.toolrail .t[disabled]')?.getAttribute('title') || ''));
  ok('пресет Pro закрыт до прохождения шага 3',
     d.querySelector('[data-preset="pro"]').hasAttribute('disabled'));
  ok('кнопка Next заблокирована до решения', d.getElementById('nextBtn').disabled);

  // Промах: клик выше зоны поддержки
  const chart = d.getElementById('chart');
  chart.getBoundingClientRect = () => ({ top: 0, height: 430, left: 0, width: 760 });
  chart.dispatchEvent(new w.MouseEvent('click', { clientY: 100, bubbles: true }));
  ok('промах не засчитывается', d.getElementById('nextBtn').disabled);
  ok('урок не отмечен пройденным после промаха', !w.Academy.isDone(3));

  // Попадание: зона 250-300
  chart.dispatchEvent(new w.MouseEvent('click', { clientY: 275, bubbles: true }));
  ok('попадание разблокирует Next', !d.getElementById('nextBtn').disabled);
  ok('урок отмечен пройденным', w.Academy.isDone(3));
  ok('событие academy_lesson_completed отправлено',
     w.Academy.events().some(e => e.event === 'academy_lesson_completed' && e.lesson_id === 3));
  ok('рельс раскрылся после урока',
     d.querySelectorAll('.toolrail .t:not([disabled])').length > 3,
     'открыто ' + d.querySelectorAll('.toolrail .t:not([disabled])').length);
  ok('пресет Pro открылся', !d.querySelector('[data-preset="pro"]').hasAttribute('disabled'));

  console.log('\n[3] Возврат в хаб: прогресс пережил переход');
  ({ d, w, events } = await open('/learn/academy'));
  ok('шаг 3 отмечен пройденным', stateOf(d, 3) === 'done', '3:' + stateOf(d, 3));
  ok('шаг 4 разблокирован', stateOf(d, 4) !== 'locked', '4:' + stateOf(d, 4));
  ok('шаги 5-6 всё ещё закрыты', ['5','6'].every(i => stateOf(d, i) === 'locked'));
  ok('CTA «Save my progress» появился', !d.getElementById('saveCta').hidden);
  ok('счётчик показывает 1', d.getElementById('doneCount').textContent === '1');

  console.log('\n[4] Шаги активации: watchlist и alert');
  d.querySelector('[data-act="4"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('событие watchlist_created', w.Academy.events().some(e => e.event === 'watchlist_created'));
  ok('событие first_value_action (watchlist)',
     w.Academy.events().some(e => e.event === 'first_value_action' && e.type === 'watchlist'));
  ok('шаг 5 разблокирован после шага 4', stateOf(d, 5) !== 'locked', '5:' + stateOf(d, 5));
  d.querySelector('[data-act="5"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('событие alert_created', w.Academy.events().some(e => e.event === 'alert_created'));

  console.log('\n[5] Переключение режима');
  d.querySelector('[data-mode="standard"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('режим стал standard', w.Academy.mode() === 'standard', w.Academy.mode());
  ok('событие mode_switch', w.Academy.events().some(e => e.event === 'mode_switch' && e.to === 'standard'));
  ok('в standard продвинутые пункты видны',
     [...d.querySelectorAll('[data-advanced]')].every(el => !el.hidden));

  console.log('\n[6] Все пять обязательных событий');
  const need = ['academy_lesson_completed','first_value_action','watchlist_created','alert_created','mode_switch'];
  const got = new Set(w.Academy.events().map(e => e.event));
  for (const n of need) ok('событие ' + n, got.has(n));

  console.log(`\nИтог: пройдено ${pass}, провалено ${fail}`);
  process.exit(fail ? 1 : 0);
})();
