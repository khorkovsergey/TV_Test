# Expert Marketplace — concierge MVP

A working service for hypothesis 07 of the PM case: the marketplace connects a private investor
with a licensed consultant, hands the consultant a **structured context** of the client, and after
the meeting assembles a **standardised summary**.

Full flow: request → AI brief → hard filter + ranking → booking → consultant notes →
streamed summary → pilot metrics.

## Why a concierge MVP rather than a full product

The case's own validation plan prescribes, for this bet: legal/compliance red-flag scan →
fake door → concierge pilot over 20-30 manual consultations → unit economics. The domain is
regulated: licences, jurisdictions, personal financial data. So the following are **deliberately
absent**:

- payments — a booking holds a slot, money is settled outside the platform;
- a licence registry — consultant status is labelled unverified everywhere it appears;
- any investment advice from the model.

These are pilot boundaries, not unfinished work.

## Where Claude does the work

| Step | What the model does | How it is called |
|---|---|---|
| Brief | Turns the client's free-form story into structure: the request, stated goal vs actual question, horizon, experience level, topics, risk signals, what is missing | Structured output against `BRIEF_SCHEMA` |
| Match | Ranks an already-filtered shortlist and explains the order | Structured output against `MATCH_SCHEMA`, `effort: high` |
| Summary | Assembles the consultant's notes into Markdown with five fixed sections | Streamed, SSE through to the browser |

Engineering decisions, not decoration:

- **Hard rules live in code.** Jurisdiction, language and capital range are filtered in
  `hardFilter()`. The model ranks what already passed, and anything it returns outside the input
  list is dropped by an allowlist.
- **Prompt caching.** System blocks are byte-stable and carry `cache_control`. Everything variable
  goes into the user message, after the breakpoint. The effect is visible on `/metrics.html`.
- **Refusals are handled.** `stop_reason` is checked before reading `content`, and server-side
  fallbacks are enabled — a declined request is re-run on a fallback model inside the same call.
- **The disclaimer is appended by the server**, not the model, so no prompt can remove it.
- **Audit.** Every call is written to `ai_calls`: model, tokens, cache, duration, stop reason.
  Cost per request and per consultation are derived from it.

## Running locally

```bash
npm install
cp .env.example .env        # set ANTHROPIC_API_KEY
npm start                   # http://localhost:3000
```

Without `DATABASE_URL` the service starts on in-memory storage — data will not survive a restart,
and `/api/health` says so plainly. Without `ANTHROPIC_API_KEY` the service runs but AI steps
return 503.

## Deploying on Railway

Connect the repository as a service, add a PostgreSQL database, then set the service variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `ANTHROPIC_API_KEY` | your key |
| `STAFF_TOKEN` | a long random string |

Set them on the **service**, not in the project's Shared Variables — shared variables require an
explicit share and are easy to miss. `railway.json` already configures the healthcheck on
`/api/health` and restart-on-failure. `PORT` is supplied by Railway.

Verify without opening the dashboard: `/api/health` returns `ready_for_pilot: true` and an empty
`problems` array when all three are in place.

## Screens

| Path | Who | What |
|---|---|---|
| `/` | client | request → brief → match → booking |
| `/staff.html` | consultant | bookings with the brief, notes entry, summary generation |
| `/metrics.html` | operator | booking rate, funnel, repeat bookings, AI cost |

The internal screens are gated by `STAFF_TOKEN`. Without it they are open — acceptable locally only.

## API

```
GET  /api/health                      storage and AI state, configuration problems
POST /api/requests                    create a request and build the brief
GET  /api/requests/:id                request with its brief
POST /api/requests/:id/match          hard filter + ranking
GET  /api/consultants                 roster
POST /api/bookings                    hold a slot
POST /api/bookings/:id/summary        SSE stream of the summary (staff)
GET  /api/bookings/:id/summary        stored summary (staff)
GET  /api/metrics                     pilot metrics (staff)
GET  /api/ai-calls                    model call audit (staff)
```

## Design

The UI uses `public/tv-theme.css` — the design system supplied in the project handoff package.
System fonts only, nothing loaded from external hosts. Numbers use tabular figures throughout,
and disclaimers appear on every screen.

## Verified

The whole path has been run against the live API: the brief conforms to its schema, ranking obeys
the prompt rules (it fills in "what they don't cover" and refuses to invent distinctions under a
10-point gap), and the summary arrives streamed with all five sections plus the disclaimer.
One full cycle of three model calls cost roughly **$0.09**.

The hard filter is covered by a check across all 20 country × capital-band combinations; every
combination returns at least one candidate against the demo roster.

A note on the cache metric: the share read from cache stays at zero while each call kind has run
only once — brief, match and summary have different system prompts, so there is nothing to reuse.
The metrics page only raises a warning once calls of the same kind have repeated without any reads.

## The wider portal, and where it is documented

The marketplace is one hypothesis of the case; it now sits inside a full portal prototype with six
sections, three complexity modes, a live market layer and a strategic-feature registry.

| Document | What it covers |
|---|---|
| [`docs/current-state-audit.md`](docs/current-state-audit.md) | What the stand contained before the architecture work |
| [`docs/information-architecture-migration.md`](docs/information-architecture-migration.md) | The six-section regroup and the route map |
| [`docs/implementation-summary.md`](docs/implementation-summary.md) | The architecture release |
| [`docs/presentation-feature-gap-audit.md`](docs/presentation-feature-gap-audit.md) | Which ideas from the case a reviewer could actually find — and which were missing |
| [`docs/strategic-feature-registry.md`](docs/strategic-feature-registry.md) | The registry behind every badge, card and promo |
| [`docs/strategic-feature-visibility-map.md`](docs/strategic-feature-visibility-map.md) | Where each feature is reachable from, and the placement rules |
| [`docs/phase-3-implementation-summary.md`](docs/phase-3-implementation-summary.md) | The feature-visibility release |
| [`docs/phase-3-remaining-backlog.md`](docs/phase-3-remaining-backlog.md) | What was deliberately left undone, and why |

Two front doors for a reviewer: **`/new`** (what is new here, and what is only an idea) and
**`/showcase`** (every idea, its status, the user problem, the metric and the route).

## Limitations

- The consultant roster is demonstration data and licences are not verified.
- Booking slots are fictional; there is no calendar.
- Cost is estimated from Claude Opus 5 list rates and is approximate.
- Not investment advice.
