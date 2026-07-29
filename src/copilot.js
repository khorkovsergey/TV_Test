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
import * as market from './market.js';

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
- Always answer the question itself, in words, every single time. A tool call
  is never a substitute for the answer — the buttons are an extra offer on top
  of a reply that already stands on its own.
- Under 120 words. No preamble, no restating the question.
- Reply in the language the user wrote in.
- Lead with the answer, then the reasoning.
- When the user asks you to DO one of the things your tools cover — add a
  symbol to their watchlist, set an alert, open or compare charts — you must
  call that tool. That is the only way the button appears for them to confirm.
  Call one tool per thing they asked for, then say in a sentence what is
  waiting for their confirmation.
- When they are only asking a question, answer it. If the question is
  conceptual ("what is X", "why does Y happen"), answering is enough — do not
  reach for a tool at all.

Sourcing:
- If the question touches a specific price move, a dated event, a number, or
  recent news, search the web before you answer. Do not answer such questions
  from memory.
- For timeless conceptual questions no search is needed.
- Say plainly when you looked and found nothing, rather than filling the gap.
- Never present an unverified recollection as a fact.

Hard limits:
- You do not give investment advice. Never say what the user should buy, sell,
  hold, or how much to allocate. No price targets, no "this looks like a good
  entry".
- You explain what happened and what things mean; the decision is the user's.
- If asked for a recommendation, say that you do not give one and offer the
  factual ground the user would need to decide for themselves.
- Never claim to know the user's portfolio, balance or personal situation.

When the user has selected a candle or a period on the chart:
- The user may have selected a historical candle or range. Treat the selected
  candle time as the primary temporal context.
- Do not answer about the latest trading day unless the user asks for it.
- When the question asks why a historical move happened, search for information
  published around the selected session — not around today.
- Distinguish facts published before or during the session from retrospective
  analysis published later.
- Never claim a single cause unless the evidence supports it.
- Separate, and label, these classes of factor:
  1. company-specific;
  2. sector;
  3. broad market;
  4. macro;
  5. technical or flow.
- Correlation with the selected candle does not prove causation. Say
  "the most likely factor was X, while the sector fell Y" rather than
  "the shares fell because of X" when all you have is timing.
- Do not use "technical" or "profit-taking" as a convenient explanation when no
  news cause was found. If you did not find a credible catalyst, say so.
- Mention the selected candle or period in the first sentence, so it is obvious
  which session you are answering about.
- When you have found dated events, call report_move_factors so they can be
  classified and marked on the chart. Answer in words as well.
`.trim();

/* The live quote for whatever the user is looking at, so the model answers
   about the actual price instead of a remembered one. Fetched from the same
   cached snapshot the pages use, so it costs nothing extra, and it is labelled
   as delayed — an answer built on it must not claim to be real-time. */
async function quoteLine(symbol) {
  if (!symbol) return '- Live quote: no symbol in context';
  try {
    const q = await market.one(symbol);
    if (!q) return `- Live quote: ${symbol} is not in this pilot's instrument universe`;
    if (!q.ok) return `- Live quote for ${symbol}: unavailable (${q.error}) — do not invent one`;
    const pct = Number.isFinite(q.changePct) ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : 'unknown';
    const parts = [
      `- Live quote for ${q.symbol} (${q.name}): ${q.price} ${q.currency}, ${pct} today`,
      `  1 week ${q.perf?.w1?.toFixed(1) ?? '?'}%, 1 month ${q.perf?.m1?.toFixed(1) ?? '?'}%,`,
      ` 52-week range ${q.wk52Low ?? '?'}–${q.wk52High ?? '?'}.`,
      ` Source: ${q.source}, snapshot taken ${q.asOf}.`,
      ' These figures are delayed — say so if you quote them, and never present them as real-time.'
    ];
    return parts.join('');
  } catch {
    return `- Live quote for ${symbol}: lookup failed — do not invent one`;
  }
}

/* ------------------------------------------------------- chart selection */

/* §11. Everything below arrives from a browser and is therefore untrusted.
   The company name in particular is never taken as authoritative — it is a
   display string the page happened to have, and the instrument universe is
   the thing that decides what NVDA is. */

const num = v => (typeof v === 'number' && Number.isFinite(v)) ? v : undefined;

/* A trading date (YYYY-MM-DD) or an ISO instant, and nothing else. A free-text
   "time" would go straight into a search query. */
function safeTime(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(s)) {
    return Number.isNaN(new Date(s).getTime()) ? null : s;
  }
  return null;
}

const INTERVALS = new Set(['1d', '1h', '15m']);
const MAX_SELECTION_CANDLES = 20_000;

export function validateChartContext(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const sym = String(raw.symbol || '').toUpperCase().slice(0, 12);
  const known = market.find(sym);
  if (!known) return null;                     // reconciled with the universe

  const sel = raw.selection && typeof raw.selection === 'object' ? raw.selection : { type: 'none' };
  let selection = { type: 'none' };

  if (sel.type === 'candle') {
    const time = safeTime(sel.time);
    const o = num(sel.open), hi = num(sel.high), lo = num(sel.low), c = num(sel.close);
    /* A high below its own low is not a candle. Rejecting the impossible here
       keeps a malformed payload from becoming a confidently wrong answer. */
    if (time && [o, hi, lo, c].every(v => v !== undefined) && hi >= lo
        && hi >= Math.max(o, c) - 1e-9 && lo <= Math.min(o, c) + 1e-9) {
      selection = {
        type: 'candle', time, open: o, high: hi, low: lo, close: c,
        volume: num(sel.volume),
        previousClose: num(sel.previousClose),
        change: num(sel.change),
        changePct: num(sel.changePct),
        averageVolume: num(sel.averageVolume),
        volumeRatio: num(sel.volumeRatio)
      };
    }
  } else if (sel.type === 'range') {
    const from = safeTime(sel.from), to = safeTime(sel.to);
    const count = num(sel.candleCount);
    if (from && to && from <= to && count && count > 0 && count <= MAX_SELECTION_CANDLES) {
      selection = {
        type: 'range', from, to, candleCount: Math.round(count),
        open: num(sel.open), close: num(sel.close), changePct: num(sel.changePct),
        high: num(sel.high), low: num(sel.low),
        totalVolume: num(sel.totalVolume), averageVolume: num(sel.averageVolume)
      };
    }
  }

  const vr = raw.visibleRange && typeof raw.visibleRange === 'object' ? raw.visibleRange : null;
  const vFrom = vr ? safeTime(vr.from) : null;
  const vTo = vr ? safeTime(vr.to) : null;

  return {
    page: 'chart_workspace',
    symbol: known.symbol,
    /* The universe's name wins over whatever the page sent. */
    companyName: known.name,
    exchange: typeof raw.exchange === 'string' ? raw.exchange.slice(0, 60) : undefined,
    currency: /^[A-Z]{3}$/.test(String(raw.currency || '')) ? raw.currency : 'USD',
    timezone: typeof raw.timezone === 'string' && raw.timezone.length <= 64 ? raw.timezone : 'UTC',
    interval: INTERVALS.has(raw.interval) ? raw.interval : '1d',
    chartRange: String(raw.chartRange || '1mo').slice(0, 8),
    visibleRange: (vFrom && vTo) ? { from: vFrom, to: vTo } : undefined,
    selection
  };
}

/* §13. The search window is derived from the selection, not from today. */
function searchWindow(chart) {
  const s = chart.selection;
  if (s.type === 'candle') {
    if (chart.interval === '1d') {
      return 'Search the window from the previous market close through the next market session, '
        + 'and also surface anything important published within 24 hours either side of '
        + `${s.time}. Do not use today's date as the default.`;
    }
    return `Search within roughly two hours either side of ${s.time}, and include pre-market `
      + 'and post-market news for that session.';
  }
  if (s.type === 'range') {
    return `Search for events inside ${s.from} to ${s.to}, plus anything important published the `
      + 'day before it starts. List retrospective articles separately from contemporaneous ones.';
  }
  return '';
}

function chartBlock(chart) {
  if (!chart) return '';
  const s = chart.selection;
  const lines = [
    'Selected chart context:',
    `- Symbol: ${chart.symbol}`,
    `- Company: ${chart.companyName}`,
    `- Exchange timezone: ${chart.timezone}`,
    `- Interval: ${chart.interval === '1d' ? '1 day' : chart.interval}`
  ];

  if (s.type === 'candle') {
    lines.push(`- Selected session: ${s.time}`);
    lines.push(`- Open: ${s.open}`);
    lines.push(`- High: ${s.high}`);
    lines.push(`- Low: ${s.low}`);
    lines.push(`- Close: ${s.close}`);
    if (s.changePct !== undefined) {
      lines.push(`- Change vs previous close: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`);
    }
    if (s.volume !== undefined) lines.push(`- Volume: ${s.volume}`);
    if (s.volumeRatio !== undefined) {
      lines.push(`- Volume vs recent average: ${s.volumeRatio.toFixed(2)}x`);
    }
  } else if (s.type === 'range') {
    lines.push(`- Selected period: ${s.from} to ${s.to} (${s.candleCount} candles)`);
    if (s.changePct !== undefined) {
      lines.push(`- Change over the period: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`);
    }
    if (s.high !== undefined) lines.push(`- High: ${s.high}`);
    if (s.low !== undefined) lines.push(`- Low: ${s.low}`);
  } else {
    lines.push('- No candle or period is selected. If the question is about a specific move, '
      + 'ask which day they mean rather than assuming today.');
  }

  const win = searchWindow(chart);
  if (win) lines.push(`- Search window: ${win}`);
  if (s.type !== 'none') {
    lines.push('- The live quote below is TODAY and is NOT the selected session. '
      + 'Do not quote it as the price on the selected date.');
  }
  return lines.join('\n');
}

/* §24 — one Copilot, three registers. The mode used to change only how many
   suggested prompts the widget offered; the answer itself was identical. That
   made the register a label rather than a difference, which is the same defect
   the navigation had.

   `copilotProfile` is the central name for it, and it decides the SHAPE of the
   answer — its length, whether terms are defined, how many actions follow.
   What it must never change: the sources, the facts, the disclaimers, the
   causal guardrails or the consent rules. A beginner and a professional get
   the same evidence, described differently. */
const REGISTERS = {
  teacher: {
    name: 'teacher',
    voice: 'Beginner: plain language, define any term the moment you use it, no jargon at all.',
    shape: 'Answer in one or two sentences first. Then, if it helps, three short lines of '
      + 'explanation. Separate company, sector and market plainly — say "the company itself", '
      + '"other companies like it", "the whole market" rather than naming the categories. '
      + 'End with exactly one clear next step.',
    actions: 'Offer at most three actions, and only ones the reader could sensibly take today.'
  },
  researcher: {
    name: 'researcher',
    voice: 'Experienced: concise professional language is fine, no hand-holding, but define '
      + 'anything unusual.',
    shape: 'Lead with the answer. Then group the factors — company, sector, broad market, macro, '
      + 'technical — and say which mattered most and why. Give the timeline where it clarifies '
      + 'causality.',
    actions: 'Offer up to five actions: comparisons, alerts, chart actions, saved research.'
  },
  analyst: {
    name: 'analyst',
    voice: 'Professional: assume fluency. Exact terms, quantified where possible, no '
      + 'encouragement and no preamble.',
    shape: 'Compact and structured. Evidence before narrative. Quantify: percentages, ratios, '
      + 'volume against average. State confidence and what would change it. Give the chronology '
      + 'of sources when the sequence is the argument.',
    actions: 'Offer up to eight compact actions, including multi-step workflows.'
  }
};

/* The client sends `copilotProfile` from the central policy. The mode is kept
   as a fallback so an older page, or one that has not adopted the profiles
   yet, still gets a sensible register rather than the beginner one by default. */
function registerFor(ctx = {}) {
  if (REGISTERS[ctx.copilotProfile]) return REGISTERS[ctx.copilotProfile];
  if (ctx.mode === 'pro') return REGISTERS.analyst;
  if (ctx.mode === 'standard') return REGISTERS.researcher;
  return REGISTERS.teacher;
}

function contextBlock(ctx = {}) {
  const reg = registerFor(ctx);
  const journey = Array.isArray(ctx.journey) && ctx.journey.length
    ? ctx.journey.slice(-5).join(' → ')
    : 'nothing yet';
  return [
    'Current context for this user:',
    `- Reader level: ${reg.voice}`,
    `- Answer shape: ${reg.shape}`,
    `- Actions: ${reg.actions}`,
    '- The register changes how you say it. It never changes the facts, the sources, the '
      + 'disclaimers or what you are allowed to claim.',
    `- Page they are on: ${ctx.page || 'unknown'} (${ctx.url || '/'})`,
    `- Active symbol: ${ctx.symbol || 'none'}`,
    `- Chart range: ${ctx.chartRange || 'none'}`,
    `- Recent research steps: ${journey}`,
    ctx.chart ? chartBlock(ctx.chart) : '',
    ctx.quote || ''
  ].filter(Boolean).join('\n');
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
    input_schema: { type: 'object', properties: { goal: { type: 'string' } }, required: ['goal'] } },

  /* §16/§17. These exist only when the user is looking at a chart selection.
     They are what turns an answer back into something on the chart rather than
     a paragraph the reader has to translate into a date themselves. */
  { name: 'report_move_factors',
    description: 'Classify what moved the selected candle or period. Call this after searching, '
      + 'whenever you have identified one or more factors. Every factor must be one of the listed '
      + 'categories, and "technical" must not be used as a fallback when no news was found.',
    input_schema: { type: 'object', properties: {
      factors: { type: 'array', items: { type: 'object', properties: {
        category: { type: 'string', enum: ['company', 'earnings', 'regulation', 'sector', 'market', 'macro', 'technical', 'flow'] },
        title: { type: 'string' },
        description: { type: 'string' },
        startedAt: { type: 'string', description: 'YYYY-MM-DD or ISO timestamp, when known' },
        relevance: { type: 'string', enum: ['high', 'medium', 'low'] },
        confidence: { type: 'number', description: '0 to 1' }
      }, required: ['category', 'title', 'relevance'] } }
    }, required: ['factors'] } },

  { name: 'mark_chart_events',
    description: 'Put dated events on the chart the user is looking at. Only use timestamps you '
      + 'actually found in sources; never approximate a date to make a marker fit.',
    input_schema: { type: 'object', properties: {
      events: { type: 'array', items: { type: 'object', properties: {
        time: { type: 'string', description: 'YYYY-MM-DD or ISO timestamp' },
        title: { type: 'string' },
        category: { type: 'string', enum: ['company', 'earnings', 'regulation', 'sector', 'market', 'macro', 'technical', 'flow'] },
        url: { type: 'string' }
      }, required: ['time', 'title'] } }
    }, required: ['events'] } },

  { name: 'compare_selected_period',
    description: 'Add a comparison series over the selected period — an index, a sector proxy or a peer.',
    input_schema: { type: 'object', properties: {
      symbols: { type: 'array', items: { type: 'string' } }
    }, required: ['symbols'] } },

  { name: 'create_event_alert',
    description: 'Propose an alert tied to an event or to a volume anomaly rather than to a price level.',
    input_schema: { type: 'object', properties: {
      symbol: { type: 'string' },
      kind: { type: 'string', enum: ['event', 'volume'] },
      description: { type: 'string' },
      value: { type: 'number', description: 'for a volume alert, the multiple of average volume' }
    }, required: ['symbol', 'kind', 'description'] } },

  { name: 'save_research',
    description: 'Offer to save this question, the answer and its sources against the selected candle.',
    input_schema: { type: 'object', properties: { title: { type: 'string' } } } }
];

/* Human-readable button labels. Anything not listed is unsupported in the pilot. */
function actionFor(name, input) {
  switch (name) {
    case 'create_alert': {
      // The condition is written by the model and often already states the
      // number, so appending value blindly produced labels ending in a stray
      // digit. Only add it when it is not already in the sentence.
      const cond = String(input.condition || '').trim();
      const needsValue = input.value != null && !cond.includes(String(input.value));
      return {
        id: name,
        label: `Alert me: ${input.symbol} — ${cond}${needsValue ? ' ' + input.value : ''}`,
        payload: input
      };
    }
    case 'open_chart':
      return { id: name, label: `Open ${input.symbol} chart${input.range ? ' · ' + input.range : ''}`, payload: input };
    case 'compare':
      return { id: name, label: `Compare ${(input.symbols || []).join(' vs ')}`, payload: input };
    case 'add_watchlist':
      return { id: name, label: `Add ${input.symbol} to my watchlist`, payload: input };
    case 'pine_snippet':
      return null;   // answered as text, no button needed

    /* Factors are not a button: they are rendered beside the answer. Returning
       null here keeps them out of the action row while `factorsOf` picks them
       up from the same tool call. */
    case 'report_move_factors':
      return null;

    case 'mark_chart_events': {
      const events = Array.isArray(input.events) ? input.events : [];
      if (!events.length) return null;
      return {
        id: name,
        label: `Show these ${events.length} event${events.length > 1 ? 's' : ''} on the chart`,
        payload: { events }
      };
    }
    case 'compare_selected_period': {
      const syms = (input.symbols || []).filter(Boolean);
      if (!syms.length) return null;
      return { id: name, label: `Compare with ${syms.join(', ')}`, payload: { symbols: syms } };
    }
    case 'create_event_alert':
      return {
        id: name,
        label: `Alert me: ${input.symbol} — ${input.description}`,
        payload: input
      };
    case 'save_research':
      return { id: name, label: input.title ? `Save: ${input.title}` : 'Save this research', payload: input };

    default:
      return null;
  }
}

/* §16. Pulled out of the same tool calls the buttons come from, so the panel
   shows exactly what the model classified — not a second, re-derived list. */
function factorsOf(messages) {
  const out = [];
  for (const msg of messages) {
    for (const block of msg.content || []) {
      if (block.type !== 'tool_use' || block.name !== 'report_move_factors') continue;
      const list = Array.isArray(block.input?.factors) ? block.input.factors : [];
      list.forEach((f, i) => {
        if (!f || !f.title) return;
        out.push({
          id: `f${out.length + i}`,
          category: f.category || 'company',
          title: String(f.title).slice(0, 200),
          description: String(f.description || '').slice(0, 400),
          startedAt: f.startedAt || null,
          relevance: ['high', 'medium', 'low'].includes(f.relevance) ? f.relevance : 'medium',
          confidence: Number.isFinite(f.confidence) ? Math.max(0, Math.min(1, f.confidence)) : null
        });
      });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.relevance] - order[b.relevance]).slice(0, 8);
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

/* §15. Sources used to be reduced to a list of hostnames, which threw away
   the title, the link and the publication time — everything that lets a reader
   check the answer instead of trusting it. Three hostnames is not a citation.

   Deduping is by canonical URL, not by host: two different Reuters pieces are
   two sources, and collapsing them to "reuters.com" hides the second one. */

const PRIMARY_HOSTS = /(^|\.)(sec\.gov|investor\.|ir\.|federalreserve\.gov|ecb\.europa\.eu|bls\.gov)/i;
const NEWS_HOSTS = /(^|\.)(reuters|bloomberg|ft|wsj|cnbc|apnews|barrons|marketwatch)\./i;

function canonical(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    /* Tracking parameters make the same article look like several. */
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|ref|src|fbclid|gclid|cmpid)/i.test(p)) u.searchParams.delete(p);
    }
    return u.toString();
  } catch { return String(url || ''); }
}

function sourceType(host, url) {
  if (PRIMARY_HOSTS.test(host) || /\/(sec|filing|8-k|10-q|10-k)\b/i.test(url)) return 'regulatory';
  if (/investor|press-release|newsroom/i.test(url)) return 'company';
  if (NEWS_HOSTS.test(host)) return 'news';
  if (/finance\.yahoo|marketdata|tradingview/i.test(host)) return 'market-data';
  return 'analysis';
}

/* Where a piece sits relative to the session being asked about. This is the
   distinction the brief cares about most: an article written a month later
   explaining a fall is a different kind of evidence from a wire story filed
   during it, and presenting them as equals is how a retrospective narrative
   becomes a "cause". */
function relationTo(publishedAt, chart) {
  if (!chart || chart.selection.type === 'none' || !publishedAt) return undefined;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return undefined;

  const s = chart.selection;
  const dayStart = d => new Date(`${String(d).slice(0, 10)}T00:00:00Z`).getTime();
  const start = s.type === 'candle' ? dayStart(s.time) : dayStart(s.from);
  const end = (s.type === 'candle' ? dayStart(s.time) : dayStart(s.to)) + 24 * 3600 * 1000;

  if (t < start) return 'before-session';
  if (t <= end) return 'during-session';
  /* More than a week later is no longer "the day after" — it is somebody
     looking back. */
  if (t <= end + 7 * 24 * 3600 * 1000) return 'after-session';
  return 'retrospective';
}

function sourcesOf(allMessages, chart) {
  const byUrl = new Map();
  for (const msg of allMessages) {
    for (const block of msg.content || []) {
      if (block.type !== 'web_search_tool_result') continue;
      const results = Array.isArray(block.content) ? block.content : [];
      for (const r of results) {
        if (!r?.url) continue;
        const url = canonical(r.url);
        if (byUrl.has(url)) continue;
        let host = url;
        try { host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
        const publishedAt = r.page_age || r.published_date || r.published_at || null;
        byUrl.set(url, {
          title: r.title || host,
          url,
          domain: host,
          publishedAt: publishedAt || undefined,
          accessedAt: new Date().toISOString(),
          sourceType: sourceType(host, url),
          relation: relationTo(publishedAt, chart)
        });
      }
    }
  }

  /* Primary and regulatory material ranks above secondary analysis: the filing
     outranks the article about the filing. */
  const rank = { regulatory: 0, company: 1, news: 2, 'market-data': 3, analysis: 4 };
  return [...byUrl.values()]
    .sort((a, b) => rank[a.sourceType] - rank[b.sourceType])
    .slice(0, 8);
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

/* One code path, streamed.

   `ask()` used to call `messages.create` and hand back the whole answer at
   once. With up to four web searches inside a single turn that is ten to
   thirty seconds of a motionless "thinking …" — and the SDK's own guidance is
   to stream anything with a high `max_tokens` regardless, to stay under the
   HTTP timeout.

   So there is no separate streaming function: `ask()` streams always, and
   `onEvent` is how a caller listens. A caller that passes nothing gets exactly
   the old return value, which is why the non-streaming endpoint did not have
   to change. */
export async function ask({ messages, context, onEvent }) {
  const emit = typeof onEvent === 'function'
    ? (e) => { try { onEvent(e); } catch { /* a listener must never break the answer */ } }
    : () => {};
  const started = Date.now();
  const history = (messages || []).slice(-MAX_TURNS).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 4000)
  }));
  if (!history.length) throw Object.assign(new Error('No message to answer'), { code: 'EMPTY' });

  /* The quote is looked up before the call so the model never has to guess a
     price it could have been told. It goes after the cache breakpoint, since
     it changes every minute. */
  const quote = await quoteLine(context?.symbol);

  /* The chart context is validated before it can reach the prompt. Anything
     that fails validation becomes absent rather than "unknown": a malformed
     candle must not turn into a sentence the model then reasons about. */
  const chart = context?.page === 'chart_workspace'
    ? validateChartContext({ ...context, ...(context.chartSelection ? { selection: context.chartSelection } : {}) })
    : null;

  const system = [
    { type: 'text', text: SYSTEM_STABLE, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contextBlock({ ...context, quote, chart }) }
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

  /* Progress, not just an answer. A visitor should be able to tell
     "searching the web" from "stuck" — those look identical when the only
     signal is a spinner. */
  async function runRound(params) {
    const stream = anthropic().beta.messages.stream(params);
    for await (const ev of stream) {
      if (ev.type === 'content_block_start') {
        const b = ev.content_block || {};
        if (b.type === 'server_tool_use') emit({ type: 'status', phase: 'searching' });
        else if (b.type === 'web_search_tool_result') emit({ type: 'status', phase: 'reading' });
        else if (b.type === 'tool_use') emit({ type: 'status', phase: 'preparing' });
        else if (b.type === 'text') emit({ type: 'status', phase: 'writing' });
      } else if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        emit({ type: 'delta', text: ev.delta.text });
      }
    }
    return stream.finalMessage();
  }

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const msg = await runRound({
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

  /* Logged once at the end so the wrap-up call below is counted too — the
     metrics page must show what a turn actually cost, not part of it. */
  const audit = () => logAiCall({
    kind: 'copilot',
    model: (final || produced.at(-1))?.model || MODEL,
    stop_reason: (final || produced.at(-1))?.stop_reason,
    ms: Date.now() - started,
    ...totals
  });

  if (refused) {
    await audit();
    return {
      text: 'I can\'t help with that one — it falls outside what this assistant is allowed to answer.',
      sources: [], actions: [], refused: true
    };
  }

  let raw = final ? textOf(final) : '';

  /* The model can spend every round on tool calls and never write a word — the
     user would get an empty bubble. Ask once more with tools switched off so a
     reply always comes back in words. */
  if (!raw) {
    const wrap = await runRound({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system,
      messages: [...convo, {
        role: 'user',
        content: 'Answer my question now, in plain text. Do not call any tools.'
      }]
    });
    const u = usageOf(wrap);
    for (const k of Object.keys(totals)) totals[k] += u[k];
    produced.push(wrap);
    if (wrap.stop_reason !== 'refusal') raw = textOf(wrap);
  }

  await audit();

  const { text, filtered } = stripAdvice(raw || 'I could not produce an answer for that. Try rephrasing?');
  const sources = sourcesOf(produced, chart);
  const factors = factorsOf(produced);

  // Dedupe actions by id+payload so a repeated tool call renders one button.
  const uniq = [];
  const seen = new Set();
  for (const a of actions) {
    const k = a.id + JSON.stringify(a.payload);
    if (!seen.has(k)) { seen.add(k); uniq.push(a); }
  }

  /* §98 — how many actions come back is the register's number, not a constant.
     Five for everyone meant a beginner got the same wall of buttons as an
     analyst, which is the shape of answer the register exists to change. */
  const ACTION_CAP = { teacher: 3, researcher: 5, analyst: 8 };
  const cap = ACTION_CAP[registerFor(context || {}).name] || 5;

  return { text, sources, factors, actions: uniq.slice(0, cap), register: registerFor(context || {}).name, filtered };
}

export { MODEL };
