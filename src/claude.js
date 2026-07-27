/* =========================================================================
   Claude API integration.

   Three tasks, one call each:
     1) buildBrief    — structured output against a JSON schema (client brief)
     2) rankMatches   — structured output against a JSON schema (ranking)
     3) streamSummary — streamed Markdown (consultation summary)

   Common to all three:
   · the system block carries cache_control — it is byte-stable, so it is
     cached across requests; verify via usage.cache_read_input_tokens
   · server-side fallbacks are on: if the safety classifiers decline a request,
     Anthropic re-runs it on a fallback model inside the same call
   · stop_reason is checked BEFORE reading content — on a refusal content is empty
   · every call is written to the audit log (model, tokens, cache, duration)
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

/* Server-side fallbacks on a classifier refusal: Anthropic picks the fallback
   model by refusal category, so there is no model list for us to maintain. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;
function anthropic() {
  if (!hasKey()) {
    const e = new Error('ANTHROPIC_API_KEY is not set — AI steps unavailable');
    e.code = 'NO_KEY';
    throw e;
  }
  if (!client) client = new Anthropic();  // key comes from the environment, never from code
  return client;
}

/* The system block is identical from request to request — that is where the
   cache breakpoint goes. Everything variable lives in the user message,
   after the breakpoint. */
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
    super('Request declined by the model safety policies');
    this.code = 'REFUSAL';
    this.details = details || null;
  }
}

/* With structured output the first text block is valid JSON. */
function parseStructured(msg) {
  const block = msg.content.find(b => b.type === 'text');
  if (!block) throw new Error('Model returned no text block');
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

  // Checked BEFORE reading content: on a refusal content is empty or partial.
  if (msg.stop_reason === 'refusal') throw new RefusalError(msg.stop_details);

  return parseStructured(msg);
}

/* ----------------------------------------------------------------- 1. brief */

export async function buildBrief(request) {
  return structuredCall({
    kind: 'brief',
    system: BRIEF_SYSTEM,
    user: briefUserMessage(request),
    schema: BRIEF_SCHEMA,
    requestId: request.id
  });
}

/* ----------------------------------------------------------------- 2. match */

/* The hard filter is plain code, not the model: jurisdiction, language, capital
   range. Rules of this kind must be deterministic and auditable.
   Keys must stay identical to CAPITAL_BANDS in server.js and to the <select>
   options on the request form. */
const CAPITAL_MIDPOINT = {
  'under $50k':    25000,
  '$50k-$250k':    150000,
  '$250k-$1M':     600000,
  'over $1M':      3000000,
  'prefer not to say': null
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
  // Nothing to rank with a single candidate — don't spend a model call.
  if (candidates.length === 1) {
    return [{
      consultant_id: candidates[0].id,
      score: 100,
      rationale: 'The only consultant that cleared the hard filter on jurisdiction, language and capital range.',
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

  // The model must not invent consultants — drop anything outside the input list.
  const allowed = new Set(candidates.map(c => c.id));
  return (out.ranked || [])
    .filter(m => allowed.has(m.consultant_id))
    .sort((a, b) => b.score - a.score);
}

/* --------------------------------------------------------------- 3. summary */

/* Streamed: the summary is long, and waiting for it whole is bad both for the
   user and for request timeouts. onDelta fires per chunk; the function returns
   the complete summary. */
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

  // The disclaimer is appended by the service, not the model — no prompt removes it.
  return text + SUMMARY_DISCLAIMER;
}

export { RefusalError, MODEL };
