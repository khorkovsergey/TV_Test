/* =========================================================================
   Research Copilot — Claude integration.

   The widget never talks to Anthropic directly: the key stays here, on the
   server. The browser only ever sees normalised {text, sources, actions}.

   Two decisions worth knowing about:

   · Web search is enabled. The widget stamps every answer "AI · SOURCED" and
     prints a source line — without retrieval the model would have to invent
     those, which is exactly the kind of false-confidence the case argues
     against. With search on, citations are real, and when a turn produces
     none the server says so instead of pretending.

   · Tools are *proposed*, not executed. When Claude calls create_alert or
     add_watchlist we hand the call back to the UI as a button. The user
     confirms; the server never silently acts on someone's account.
   ========================================================================= */

import Anthropic from '@anthropic-ai/sdk';
import { logAiCall } from './db.js';

/* The handoff names claude-sonnet-4-5, which is a legacy model and would put
   the Copilot on a different tier from the rest of the service. Default to the
   service model; set COPILOT_MODEL to override (claude-sonnet-5 is the current
   cheaper/faster tier if latency matters more than depth here). */
const MODEL = process.env.COPILOT_MODEL || process.env.CLAUDE_MODEL || 'claude-opus-5';
const MAX_TOKENS = 1024;                       // capped per the handoff guardrails
const MAX_TURNS = 10;                          // last N turns of history
const MAX_TOOL_ROUNDS = 3;                     // stop the loop from running away
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client = null;
function anthropic() {
  if (!hasKey()) {
    const e = new Error('ANTHROPIC_API_KEY is not set on the server');
    e.code = 'NO_KEY';
    throw e;
  }
  if (!client) client = new Anthropic();
  return client;
}

/* ------------------------------------------------------------ system prompt */

/* Stable part first so it can be cached; the volatile per-request context goes
   into its own block after the breakpoint. */
const SYSTEM_STABLE = `
You are Research Copilot inside a market research portal. You explain why
instruments move, compare them, connect news and events to the chart, help set
up charts and alerts, and help with Pine Script.

How you answer:
- Under 120 words. No preamble, no restating the question.
- Reply in the language the user wrote in.
- Lead with the answer, then the reasoning.
- When a concrete next step fits, call the matching tool instead of describing
  the step in prose.

Sourcing:
- Search the web before making any claim about a specific price move, news
  event, or number. Say plainly when you could not find a source rather than
  filling the gap from memory.
- Never present an unverified recollection as a fact.

Hard limits:
- You do not give investment advice. Never say what the user should buy, sell,
  hold, or how much to allocate. No price targets, no "this looks like a good
  entry".
- You explain what happened and what things mean; the decision is the user's.
- If asked for a recommendation, say that you do not give one and offer the
  factual ground the user would need to decide for themselves.
- Never claim to know the user's portfolio, balance or personal situation.
`.trim();

function contextBlock(ctx = {}) {
  const level = ctx.mode === 'standard'
    ? 'Experienced: concise professional language is fine, no hand-holding.'
    : 'Beginner: plain language, define any term you use, no jargon.';
  const journey = Array.isArray(ctx.journey) && ctx.journey.length
    ? ctx.journey.slice(-5).join(' → ')
    : 'nothing yet';
  return [
    'Current context for this user:',
    `- Reader level: ${level}`,
    `- Page they are on: ${ctx.page || 'unknown'} (${ctx.url || '/'})`,
    `- Active symbol: ${ctx.symbol || 'none'}`,
    `- Chart range: ${ctx.chartRange || 'none'}`,
    `- Recent research steps: ${journey}`
  ].join('\n');
}

/* ------------------------------------------------------------------- tools */

/* Each tool maps to a button the widget renders. Descriptions matter: they are
   what makes Claude reach for the right one. */
export const TOOLS = [
  { name: 'create_alert',
    description: 'Propose a price or event alert for a symbol. Use when the user wants to be told when something happens.',
    input_schema: { type: 'object', properties: {
      symbol: { type: 'string' }, condition: { type: 'string' }, value: { type: 'number' }
    }, required: ['symbol', 'condition'] } },

  { name: 'open_chart',
    description: 'Open the chart for a symbol, optionally at a range and with an event marked. Use when the answer is easier to see than to read.',
    input_schema: { type: 'object', properties: {
      symbol: { type: 'string' }, range: { type: 'string' }, markEvent: { type: 'string' }
    }, required: ['symbol'] } },

  { name: 'compare',
    description: 'Open a side-by-side comparison of 2-4 symbols.',
    input_schema: { type: 'object', properties: {
      symbols: { type: 'array', items: { type: 'string' } }
    }, required: ['symbols'] } },

  { name: 'add_watchlist',
    description: 'Add a symbol to the user watchlist so they can follow it.',
    input_schema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },

  { name: 'pine_snippet',
    description: 'Return a short Pine Script v5 snippet with an explanation.',
    input_schema: { type: 'object', properties: { goal: { type: 'string' } }, required: ['goal'] } }
];

/* Human-readable button labels. Anything not listed is unsupported in the pilot. */
function actionFor(name, input) {
  switch (name) {
    case 'create_alert':
      return { id: name, label: `Alert me: ${input.symbol} ${input.condition}${input.value != null ? ' ' + input.value : ''}`, payload: input };
    case 'open_chart':
      return { id: name, label: `Open ${input.symbol} chart${input.range ? ' · ' + input.range : ''}`, payload: input };
    case 'compare':
      return { id: name, label: `Compare ${(input.symbols || []).join(' vs ')}`, payload: input };
    case 'add_watchlist':
      return { id: name, label: `Add ${input.symbol} to my watchlist`, payload: input };
    case 'pine_snippet':
      return null;   // answered as text, no button needed
    default:
      return null;
  }
}

/* ------------------------------------------------------------ safety filter */

/* Belt and braces: the system prompt forbids advice, this catches the phrasing
   if it slips through anyway. Returns the cleaned text and whether it fired. */
const ADVICE_PATTERNS = [
  /\byou should (buy|sell|short|hold|invest|allocate)\b/gi,
  /\bI (recommend|suggest|advise) (buying|selling|shorting|holding|investing)\b/gi,
  /\b(buy|sell) (now|today|immediately)\b/gi,
  /\bthis is a good (entry|buy|time to buy|opportunity to buy)\b/gi
];

export function stripAdvice(text) {
  let out = text, hit = false;
  for (const re of ADVICE_PATTERNS) {
    if (re.test(out)) {
      hit = true;
      out = out.replace(re, 'the decision here is yours');
    }
    re.lastIndex = 0;
  }
  if (hit) {
    out += '\n\n(Rephrased: this assistant does not tell you what to buy or sell.)';
  }
  return { text: out, filtered: hit };
}

/* ------------------------------------------------------------------ helpers */

const textOf = msg => msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

/* Pull real citations out of the web-search result blocks. */
function sourcesOf(allMessages) {
  const seen = new Map();
  for (const msg of allMessages) {
    for (const block of msg.content || []) {
      if (block.type !== 'web_search_tool_result') continue;
      const results = Array.isArray(block.content) ? block.content : [];
      for (const r of results) {
        if (!r?.url) continue;
        let host = r.url;
        try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch {}
        if (!seen.has(host)) seen.set(host, r.title || host);
      }
    }
  }
  return [...seen.keys()].slice(0, 5);
}

function usageOf(msg) {
  const u = msg?.usage || {};
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_read: u.cache_read_input_tokens || 0,
    cache_write: u.cache_creation_input_tokens || 0
  };
}

/* ------------------------------------------------------------------- main */

export async function ask({ messages, context }) {
  const started = Date.now();
  const history = (messages || []).slice(-MAX_TURNS).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));
  if (!history.length) throw Object.assign(new Error('No message to answer'), { code: 'EMPTY' });

  const system = [
    { type: 'text', text: SYSTEM_STABLE, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextBlock(context) }
  ];

  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
    ...TOOLS
  ];

  const convo = [...history];
  const produced = [];          // every assistant message, for source extraction
  const actions = [];
  const totals = { input_tokens: 0, output_tokens: 0, cache_read: 0, cache_write: 0 };
  let final = null;
  let refused = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const msg = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system,
      tools,
      messages: convo
    });

    const u = usageOf(msg);
    for (const k of Object.keys(totals)) totals[k] += u[k];
    produced.push(msg);

    if (msg.stop_reason === 'refusal') { refused = true; final = msg; break; }

    // A server-side tool ran out of its own iteration budget — resume it.
    if (msg.stop_reason === 'pause_turn') {
      convo.push({ role: 'assistant', content: msg.content });
      continue;
    }

    if (msg.stop_reason !== 'tool_use') { final = msg; break; }

    // Claude wants to act. We turn each call into a button and tell it so.
    convo.push({ role: 'assistant', content: msg.content });
    const results = [];
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue;
      const action = actionFor(block.name, block.input || {});
      if (action) actions.push(action);
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: action
          ? 'Prepared. The user will see this as a button and confirm it themselves. Do not claim it is already done.'
          : 'Not available in this pilot. Say so briefly and answer in text instead.'
      });
    }
    if (!results.length) { final = msg; break; }
    convo.push({ role: 'user', content: results });
  }

  await logAiCall({
    kind: 'copilot',
    model: (final || produced.at(-1))?.model || MODEL,
    stop_reason: (final || produced.at(-1))?.stop_reason,
    ms: Date.now() - started,
    ...totals
  });

  if (refused) {
    return {
      text: 'I can\'t help with that one — it falls outside what this assistant is allowed to answer.',
      sources: [], actions: [], refused: true
    };
  }

  const raw = final ? textOf(final) : '';
  const { text, filtered } = stripAdvice(raw || 'I could not produce an answer for that. Try rephrasing?');
  const sources = sourcesOf(produced);

  // Dedupe actions by id+payload so a repeated tool call renders one button.
  const uniq = [];
  const seen = new Set();
  for (const a of actions) {
    const k = a.id + JSON.stringify(a.payload);
    if (!seen.has(k)) { seen.add(k); uniq.push(a); }
  }

  return { text, sources, actions: uniq.slice(0, 4), filtered };
}

export { MODEL };
