/* =========================================================================
   Expert Marketplace — concierge-MVP.

   Путь: заявка → AI-бриф → жёсткий фильтр + ранжирование → бронирование
         → заметки консультанта → стандартизированный итог (стримингом).

   Границы пилота (осознанные, не «недоделки»):
   · платежей нет — бронирование фиксирует слот, деньги вне контура
   · реестра лицензий нет — статус консультанта помечен как непроверенный
   · AI не даёт рекомендаций, только структурирует; дисклеймеры добавляет сервер
   ========================================================================= */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import {
  buildBrief, rankMatches, hardFilter, streamSummary,
  hasKey, MODEL, RefusalError
} from './claude.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '256kb' }));
app.use(express.static(path.join(here, '..', 'public')));

const PORT = process.env.PORT || 3000;
const STAFF_TOKEN = process.env.STAFF_TOKEN || '';

/* Простейшая защита внутренних экранов. Не заменяет аутентификацию —
   на проде сюда встаёт нормальный SSO, здесь достаточно отсечь случайных. */
function staffOnly(req, res, next) {
  if (!STAFF_TOKEN) return next();          // локально можно без токена
  const given = req.get('x-staff-token') || req.query.token;
  if (given === STAFF_TOKEN) return next();
  res.status(401).json({ error: 'Нужен staff-токен' });
}

const wrap = fn => (req, res) => fn(req, res).catch(err => fail(res, err));

function fail(res, err) {
  if (err instanceof RefusalError) {
    return res.status(422).json({
      error: 'Модель отклонила запрос по политикам безопасности',
      details: err.details || null
    });
  }
  if (err?.code === 'NO_KEY') {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY не задан на сервере' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: err?.message || 'Внутренняя ошибка' });
}

/* ------------------------------------------------------------------ health */

/* Отдаёт состояние конфигурации, но не сами секреты: длина и наличие — да,
   значения — нет. Нужен, чтобы проверять деплой не заходя в дашборд. */
app.get('/api/health', wrap(async (_req, res) => {
  const problems = [];
  if (db.MODE === 'memory') problems.push('DATABASE_URL не задан: данные исчезнут при рестарте');
  if (!hasKey()) problems.push('ANTHROPIC_API_KEY не задан: AI-шаги вернут 503');
  if (!STAFF_TOKEN) problems.push('STAFF_TOKEN не задан: кабинет консультанта и метрики открыты всем');
  else if (STAFF_TOKEN.length < 12) problems.push('STAFF_TOKEN короче 12 символов — подберут перебором');

  res.json({
    ok: problems.length === 0,
    storage: db.MODE,
    storage_note: db.MODE === 'memory'
      ? 'DATABASE_URL не задан — данные не переживут перезапуск'
      : 'Postgres подключён',
    ai: hasKey() ? 'ready' : 'ANTHROPIC_API_KEY не задан',
    model: MODEL,
    staff_protected: Boolean(STAFF_TOKEN),
    problems,
    ready_for_pilot: problems.length === 0
  });
}));

/* ------------------------------------------------------------- заявка + бриф */

const BANDS = ['до 500 тыс.', '500 тыс. – 3 млн', '3 – 15 млн', 'более 15 млн', 'не указываю'];

app.post('/api/requests', wrap(async (req, res) => {
  const b = req.body || {};
  const errors = [];
  if (!b.contact_name?.trim()) errors.push('Укажите имя');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contact_email || '')) errors.push('Укажите корректный email');
  if (!b.country?.trim()) errors.push('Укажите страну');
  if (!BANDS.includes(b.capital_band)) errors.push('Выберите диапазон капитала');
  if ((b.goal_text || '').trim().length < 40) errors.push('Опишите задачу подробнее — минимум 40 символов');
  if (b.consent !== true) errors.push('Нужно согласие на передачу контекста консультанту');
  if (errors.length) return res.status(400).json({ errors });

  const request = {
    contact_name:  String(b.contact_name).trim().slice(0, 120),
    contact_email: String(b.contact_email).trim().slice(0, 200),
    country:       String(b.country).trim().slice(0, 4).toUpperCase(),
    language:      String(b.language || 'ru').trim().slice(0, 5),
    capital_band:  b.capital_band,
    goal_text:     String(b.goal_text).trim().slice(0, 6000),
    consent:       true
  };

  const id = await db.createRequest(request);

  // Бриф строим сразу: без него консультанту нечего показывать.
  let brief = null, briefError = null;
  try {
    brief = await buildBrief({ id, ...request });
  } catch (err) {
    briefError = err instanceof RefusalError
      ? 'Модель отклонила запрос по политикам безопасности'
      : (err?.code === 'NO_KEY' ? 'AI-ключ не настроен на сервере' : String(err?.message || err));
  }
  await db.setBrief(id, brief, briefError);

  res.status(201).json({ id, brief, brief_error: briefError });
}));

app.get('/api/requests/:id', wrap(async (req, res) => {
  const r = await db.getRequest(req.params.id);
  if (!r) return res.status(404).json({ error: 'Заявка не найдена' });
  res.json(r);
}));

app.get('/api/requests', staffOnly, wrap(async (_req, res) => {
  res.json(await db.listRequests());
}));

/* ---------------------------------------------------------------- подбор */

app.post('/api/requests/:id/match', wrap(async (req, res) => {
  const request = await db.getRequest(req.params.id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });

  const all = await db.listConsultants();
  const candidates = hardFilter(request, all);

  if (candidates.length === 0) {
    return res.json({
      ranked: [],
      note: 'Под жёсткий фильтр (юрисдикция, язык, диапазон капитала) не подошёл ни один консультант. ' +
            'В пилоте ростер маленький — это ожидаемое состояние, а не ошибка.'
    });
  }

  const brief = typeof request.brief === 'string' ? JSON.parse(request.brief) : request.brief;
  const ranked = await rankMatches(request, brief, candidates);
  await db.saveMatches(request.id, ranked);

  const byId = new Map(all.map(c => [c.id, c]));
  res.json({
    ranked: ranked.map(m => ({ ...m, consultant: byId.get(m.consultant_id) })),
    filtered_out: all.length - candidates.length
  });
}));

app.get('/api/consultants', wrap(async (_req, res) => {
  res.json(await db.listConsultants());
}));

/* ------------------------------------------------------------ бронирование */

app.post('/api/bookings', wrap(async (req, res) => {
  const { request_id, consultant_id, slot } = req.body || {};
  if (!request_id || !consultant_id || !slot) {
    return res.status(400).json({ error: 'Нужны request_id, consultant_id и slot' });
  }
  const request = await db.getRequest(request_id);
  if (!request) return res.status(404).json({ error: 'Заявка не найдена' });
  const consultant = await db.getConsultant(consultant_id);
  if (!consultant) return res.status(404).json({ error: 'Консультант не найден' });

  const id = await db.createBooking(request_id, consultant_id, String(slot).slice(0, 40));
  res.status(201).json({ id, consultant: consultant.name, slot });
}));

app.get('/api/bookings', staffOnly, wrap(async (_req, res) => {
  const [bookings, requests, consultants, consultations] = await Promise.all([
    db.listBookings(), db.listRequests(200), db.listConsultants(), db.listConsultations()
  ]);
  const reqById = new Map(requests.map(r => [r.id, r]));
  const conById = new Map(consultants.map(c => [c.id, c]));
  const sumByBooking = new Map(consultations.map(c => [c.booking_id, c]));
  res.json(bookings.map(b => ({
    ...b,
    request: reqById.get(b.request_id) || null,
    consultant: conById.get(b.consultant_id) || null,
    has_summary: sumByBooking.has(b.id)
  })));
}));

/* -------------------------------------------- итог консультации (стриминг) */

app.post('/api/bookings/:id/summary', staffOnly, wrap(async (req, res) => {
  const booking = await db.getBooking(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Бронирование не найдено' });

  const notes = String(req.body?.notes || '').trim();
  if (notes.length < 30) {
    return res.status(400).json({ error: 'Заметки слишком короткие — минимум 30 символов' });
  }

  const request = await db.getRequest(booking.request_id);
  const brief = typeof request?.brief === 'string' ? JSON.parse(request.brief) : request?.brief;

  // Server-Sent Events: отдаём текст по мере генерации.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const summary = await streamSummary({
      brief, notes, requestId: booking.request_id,
      onDelta: delta => send('delta', { text: delta })
    });
    await db.saveConsultation(booking.id, notes, summary);
    await db.setBookingStatus(booking.id, 'completed');
    send('done', { summary });
  } catch (err) {
    const message = err instanceof RefusalError
      ? 'Модель отклонила запрос по политикам безопасности'
      : (err?.code === 'NO_KEY' ? 'ANTHROPIC_API_KEY не задан на сервере' : String(err?.message || err));
    send('error', { message });
  }
  res.end();
}));

app.get('/api/bookings/:id/summary', staffOnly, wrap(async (req, res) => {
  const c = await db.getConsultation(req.params.id);
  if (!c) return res.status(404).json({ error: 'Итог ещё не составлен' });
  res.json(c);
}));

/* ---------------------------------------------------------------- метрики */

/* Метрики ровно те, что заявлены в гипотезе 07: booking rate, завершённые
   консультации, повторные брони — плюс стоимость AI, без которой юнит-экономику
   пилота не посчитать. */
app.get('/api/metrics', staffOnly, wrap(async (_req, res) => {
  const [requests, bookings, consultations, calls] = await Promise.all([
    db.listRequests(1000), db.listBookings(), db.listConsultations(), db.listAiCalls(1000)
  ]);

  const withBooking = new Set(bookings.map(b => b.request_id));
  const perRequest = {};
  for (const b of bookings) perRequest[b.request_id] = (perRequest[b.request_id] || 0) + 1;
  const repeat = Object.values(perRequest).filter(n => n > 1).length;

  const tok = calls.reduce((a, c) => ({
    input:  a.input  + (c.input_tokens  | 0),
    output: a.output + (c.output_tokens | 0),
    read:   a.read   + (c.cache_read    | 0),
    write:  a.write  + (c.cache_write   | 0)
  }), { input: 0, output: 0, read: 0, write: 0 });

  // Тариф Claude Opus 5: $5 / $25 за миллион токенов; кэш-чтение ~0.1x,
  // кэш-запись ~1.25x от входной ставки.
  const usd = (tok.input / 1e6) * 5 + (tok.output / 1e6) * 25
            + (tok.read / 1e6) * 0.5 + (tok.write / 1e6) * 6.25;

  const cacheTotal = tok.read + tok.write;

  // Кэш переиспользуется только между вызовами ОДНОГО типа: у brief, match и
  // summary разные системные промпты. Пока каждый тип вызывался по разу,
  // нулевой hit rate — норма, а не симптом. Считаем повторы, чтобы страница
  // метрик не поднимала ложную тревогу.
  const perKind = {};
  for (const c of calls) perKind[c.kind] = (perKind[c.kind] || 0) + 1;
  const repeatKindCalls = Object.values(perKind).reduce((a, n) => a + Math.max(0, n - 1), 0);

  res.json({
    requests: requests.length,
    briefs_ok: requests.filter(r => r.brief).length,
    briefs_failed: requests.filter(r => r.brief_error).length,
    bookings: bookings.length,
    booking_rate: requests.length ? Math.round(withBooking.size / requests.length * 100) : 0,
    completed: consultations.filter(c => c.summary_md).length,
    completion_rate: bookings.length
      ? Math.round(consultations.filter(c => c.summary_md).length / bookings.length * 100) : 0,
    repeat_bookings: repeat,
    ai_calls: calls.length,
    refusals: calls.filter(c => c.stop_reason === 'refusal').length,
    tokens: tok,
    cache_hit_rate: cacheTotal ? Math.round(tok.read / cacheTotal * 100) : 0,
    repeat_kind_calls: repeatKindCalls,
    est_cost_usd: Number(usd.toFixed(4)),
    est_cost_per_request_usd: requests.length ? Number((usd / requests.length).toFixed(4)) : 0
  });
}));

app.get('/api/ai-calls', staffOnly, wrap(async (_req, res) => {
  res.json(await db.listAiCalls(100));
}));

/* -------------------------------------------------------------------- boot */

const server = await (async () => {
  await db.init();
  return app.listen(PORT, () => {
    console.log(`Expert Marketplace на порту ${PORT}`);
    console.log(`  хранилище: ${db.MODE}${db.MODE === 'memory' ? ' (непостоянное — задайте DATABASE_URL)' : ''}`);
    console.log(`  AI: ${hasKey() ? MODEL : 'ключ не задан, AI-шаги вернут 503'}`);
    if (!STAFF_TOKEN) console.log('  STAFF_TOKEN не задан — внутренние экраны открыты');
  });
})();

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
