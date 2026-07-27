/* =========================================================================
   Интеграция с Claude API.

   Три задачи, каждая — отдельный вызов:
     1) buildBrief   — структурный вывод по JSON-схеме (бриф клиента)
     2) rankMatches  — структурный вывод по JSON-схеме (ранжирование)
     3) streamSummary— стриминг Markdown (итог консультации)

   Общее для всех:
   · системный блок помечен cache_control — он стабилен, значит кэшируется
     между запросами; проверять эффект по usage.cache_read_input_tokens
   · включены серверные фолбэки: если классификаторы отклонят запрос,
     Anthropic переиграет его на запасной модели внутри того же вызова
   · stop_reason проверяется ДО чтения content — на отказе content пуст
   · каждый вызов пишется в аудит (модель, токены, кэш, длительность)
   ========================================================================= */

import Anthropic from '@anthropic-ai/sdk';
import {
  BRIEF_SYSTEM, BRIEF_SCHEMA, briefUserMessage,
  MATCH_SYSTEM, MATCH_SCHEMA, matchUserMessage,
  SUMMARY_SYSTEM, summaryUserMessage, SUMMARY_DISCLAIMER
} from './prompts.js';
import { logAiCall } from './db.js';

const MODEL  = process.env.CLAUDE_MODEL  || 'claude-opus-5';
const EFFORT = process.env.CLAUDE_EFFORT || 'medium';

/* Серверные фолбэки на отказ классификатора: Anthropic сам подбирает
   запасную модель по категории отказа, нам нечего сопровождать. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;
function anthropic() {
  if (!hasKey()) {
    const e = new Error('ANTHROPIC_API_KEY не задан — AI-шаги недоступны');
    e.code = 'NO_KEY';
    throw e;
  }
  if (!client) client = new Anthropic();  // ключ берётся из окружения, в коде его нет
  return client;
}

/* Системный блок один и тот же от запроса к запросу — ставим точку кэширования
   на него. Всё изменчивое уходит в user-сообщение, после точки кэша. */
const cachedSystem = text => [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];

function usageOf(msg) {
  const u = msg?.usage || {};
  return {
    input_tokens:  u.input_tokens  || 0,
    output_tokens: u.output_tokens || 0,
    cache_read:    u.cache_read_input_tokens     || 0,
    cache_write:   u.cache_creation_input_tokens || 0
  };
}

class RefusalError extends Error {
  constructor(details) {
    super('Запрос отклонён политиками безопасности модели');
    this.code = 'REFUSAL';
    this.details = details || null;
  }
}

/* Достаём JSON из ответа со structured output: первый text-блок — валидный JSON. */
function parseStructured(msg) {
  const block = msg.content.find(b => b.type === 'text');
  if (!block) throw new Error('Модель не вернула текстовый блок');
  return JSON.parse(block.text);
}

async function structuredCall({ kind, system, user, schema, requestId, effort }) {
  const started = Date.now();
  const msg = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: cachedSystem(system),
    output_config: {
      effort: effort || EFFORT,
      format: { type: 'json_schema', schema }
    },
    messages: [{ role: 'user', content: user }]
  });

  await logAiCall({
    kind, model: msg.model || MODEL, request_id: requestId,
    stop_reason: msg.stop_reason, ms: Date.now() - started, ...usageOf(msg)
  });

  // Проверяем ДО чтения content: на отказе content пуст либо частичен.
  if (msg.stop_reason === 'refusal') throw new RefusalError(msg.stop_details);

  return parseStructured(msg);
}

/* ------------------------------------------------------------------ 1. бриф */

export async function buildBrief(request) {
  return structuredCall({
    kind: 'brief',
    system: BRIEF_SYSTEM,
    user: briefUserMessage(request),
    schema: BRIEF_SCHEMA,
    requestId: request.id
  });
}

/* ---------------------------------------------------------------- 2. подбор */

/* Жёсткий фильтр — обычный код, а не модель: юрисдикция, язык, диапазон капитала.
   Правила такого рода должны быть детерминированными и проверяемыми. */
const CAPITAL_MIDPOINT = {
  'до 500 тыс.':      250000,
  '500 тыс. – 3 млн': 1750000,
  '3 – 15 млн':       9000000,
  'более 15 млн':     30000000,
  'не указываю':      null
};

export function hardFilter(request, consultants) {
  const mid = CAPITAL_MIDPOINT[request.capital_band] ?? null;
  return consultants.filter(c => {
    if (!c.active) return false;
    if (c.jurisdiction !== request.country) return false;
    if (!c.languages.includes(request.language)) return false;
    if (mid !== null) {
      if (mid < Number(c.capital_min)) return false;
      if (c.capital_max != null && mid > Number(c.capital_max)) return false;
    }
    return true;
  });
}

export async function rankMatches(request, brief, candidates) {
  if (candidates.length === 0) return [];
  // Одного кандидата ранжировать нечего — не тратим вызов модели.
  if (candidates.length === 1) {
    return [{
      consultant_id: candidates[0].id,
      score: 100,
      rationale: 'Единственный консультант, прошедший жёсткий фильтр по юрисдикции, языку и диапазону капитала.',
      concerns: ''
    }];
  }

  const out = await structuredCall({
    kind: 'match',
    system: MATCH_SYSTEM,
    user: matchUserMessage(brief, candidates),
    schema: MATCH_SCHEMA,
    requestId: request.id,
    effort: 'high'
  });

  // Модель не должна изобретать консультантов — отбрасываем всё, чего нет в списке.
  const allowed = new Set(candidates.map(c => c.id));
  return (out.ranked || [])
    .filter(m => allowed.has(m.consultant_id))
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ 3. итог */

/* Стриминг: итог длинный, ждать его целиком плохо и для UX, и для таймаутов.
   onDelta вызывается на каждом куске текста; функция возвращает полный итог. */
export async function streamSummary({ brief, notes, requestId, onDelta }) {
  const started = Date.now();
  let text = '';

  const stream = anthropic().beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: cachedSystem(SUMMARY_SYSTEM),
    output_config: { effort: EFFORT },
    messages: [{ role: 'user', content: summaryUserMessage(brief, notes) }]
  });

  stream.on('text', delta => { text += delta; onDelta?.(delta); });

  const msg = await stream.finalMessage();

  await logAiCall({
    kind: 'summary', model: msg.model || MODEL, request_id: requestId,
    stop_reason: msg.stop_reason, ms: Date.now() - started, ...usageOf(msg)
  });

  if (msg.stop_reason === 'refusal') throw new RefusalError(msg.stop_details);

  // Дисклеймер добавляет сервис, а не модель — так его нельзя убрать промптом.
  return text + SUMMARY_DISCLAIMER;
}

export { RefusalError, MODEL };
