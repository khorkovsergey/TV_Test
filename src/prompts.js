/* =========================================================================
   Prompts and structured-output schemas.

   Kept in one file and byte-stable between requests: the system block is
   cached by prefix, so nothing dynamic (dates, request ids) may leak in here.
   Everything variable goes into the user message, after the cache breakpoint.
   ========================================================================= */

/* Shared responsibility frame — identical across all three tasks. */
const GUARDRAILS = `
Legal boundaries you must respect:
- You do not give investment advice and do not name specific instruments,
  portfolio weights, entry points, or exit points. That is the licensed
  consultant's job.
- You do not judge whether the client's idea is good, and you do not confirm
  their hypotheses.
- You structure what the person actually said, and you flag what is missing
  from it.
- If the text shows signs of pressure, urgency, promised returns, or borrowed
  money, record that as a risk signal without commenting on the substance.
- Never invent facts about the client. Anything unstated goes to missing_info.
- Do not request or infer personal data beyond what was submitted.
`.trim();

/* ------------------------------------------------------------------ brief */

export const BRIEF_SYSTEM = `
You are an assistant for a marketplace that connects private investors with
licensed consultants. Your only task at this step: turn the client's free-form
story into a structured brief the consultant can read in a minute before the
meeting.

What makes a brief good:
- It compresses the request into 2-3 sentences of neutral language, no judgement.
- It separates what the client named as a goal from what they actually asked.
- It states honestly what information is missing for a substantive conversation,
  so the consultant spends the session on the work rather than on intake.
- It infers the client's level from the words they use about markets, not from
  their self-assessment.

Topic taxonomy (choose only from this list for the topics field):
getting started, portfolio, equities, bonds, ETFs, crypto, taxes, risk,
diversification, concentrated position, retirement accounts, real estate,
currency exposure, inheritance.

${GUARDRAILS}
`.trim();

export const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    summary:                  { type: 'string', description: 'The request in 2-3 neutral sentences' },
    stated_goal:              { type: 'string', description: 'What the client called their goal, in their words' },
    actual_question:          { type: 'string', description: 'What they actually want to understand' },
    horizon:                  { type: 'string', enum: ['under 1 year', '1-3 years', '3-10 years', 'over 10 years', 'not stated'] },
    knowledge_level:          { type: 'string', enum: ['none', 'basic', 'intermediate', 'advanced'] },
    topics:                   { type: 'array', items: { type: 'string' }, description: 'From the taxonomy only' },
    risk_signals:             { type: 'array', items: { type: 'string' }, description: 'Signs of pressure, urgency, borrowed money, return expectations' },
    missing_info:             { type: 'array', items: { type: 'string' }, description: 'What is missing for a substantive conversation' },
    questions_for_consultant: { type: 'array', items: { type: 'string' }, description: 'What the consultant should clarify first' }
  },
  required: ['summary', 'stated_goal', 'actual_question', 'horizon', 'knowledge_level',
             'topics', 'risk_signals', 'missing_info', 'questions_for_consultant'],
  additionalProperties: false
};

export function briefUserMessage(req) {
  return [
    `Client country: ${req.country}`,
    `Language: ${req.language}`,
    `Stated capital range: ${req.capital_band}`,
    '',
    "Client's own words (do not edit the meaning):",
    '---',
    req.goal_text,
    '---'
  ].join('\n');
}

/* ------------------------------------------------------------------ match */

export const MATCH_SYSTEM = `
You rank consultants for a client. You receive the client's brief and a list of
consultants that has already passed a hard filter (jurisdiction, language,
capital range). Your task is to order that short list and explain the order.

Ranking rules:
- Judge only how well each consultant's specialisation fits the brief.
- Score 0 to 100. A gap under 10 points means "effectively tied" — say exactly
  that in the rationale rather than inventing a distinction.
- In concerns, state what this consultant does NOT cover in the request. If they
  cover everything, return an empty string.
- Do not rank by price and do not suggest picking the cheaper option.
- Do not add consultants that are not in the input list.

${GUARDRAILS}
`.trim();

export const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    ranked: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          consultant_id: { type: 'string' },
          score:         { type: 'integer' },
          rationale:     { type: 'string', description: 'Why this consultant fits the brief, 1-2 sentences' },
          concerns:      { type: 'string', description: 'What they do not cover; empty string if nothing' }
        },
        required: ['consultant_id', 'score', 'rationale', 'concerns'],
        additionalProperties: false
      }
    }
  },
  required: ['ranked'],
  additionalProperties: false
};

export function matchUserMessage(brief, consultants) {
  return [
    'Client brief:',
    JSON.stringify(brief, null, 2),
    '',
    'Available consultants (already past the hard filter):',
    JSON.stringify(consultants.map(c => ({
      consultant_id: c.id,
      specialties: c.specialties,
      jurisdiction: c.jurisdiction,
      languages: c.languages,
      bio: c.bio
    })), null, 2)
  ].join('\n');
}

/* ---------------------------------------------------------------- summary */

export const SUMMARY_SYSTEM = `
You turn a consultant's rough post-meeting notes into a standardised summary.
Two audiences read it: the client, and the marketplace's compliance function.

Respond in Markdown with exactly these sections, in this order:

## What we discussed
## What the consultant noted
## Agreements
## What the client does next
## Open questions

Rules:
- Include only what is in the notes. Do not extrapolate and do not generalise
  into advice.
- If a section has nothing to fill it, write exactly: "Not recorded in the notes."
- Write in the third person, neutrally: "the consultant noted", "the client said".
- No recommendations in your own voice, no new instruments, no new numbers.
- Under "What the client does next", list only actions the notes name explicitly.
- Do not add headings, sections, or lists beyond the five above.

${GUARDRAILS}
`.trim();

export function summaryUserMessage(brief, notes) {
  return [
    'Brief the client arrived with:',
    JSON.stringify(brief ?? { summary: 'no brief available' }, null, 2),
    '',
    "Consultant's rough notes after the meeting:",
    '---',
    notes,
    '---'
  ].join('\n');
}

/* The disclaimer is appended by the service, not generated by the model,
   so no prompt can talk it away. */
export const SUMMARY_DISCLAIMER = `

---

*This summary was generated automatically from the consultant's notes and is not
investment advice. Review the wording before sending it to the client: the
consultant is responsible for its content. Pilot mode — consultant licence
status is not automatically verified.*`;
