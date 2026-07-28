# TradingView portal prototype

A case-study prototype of a TradingView-style portal: six sections, three experience presets, a live
market layer over 49 instruments, an AI research assistant, and eight strategic product bets — of
which Expert Marketplace is one.

**Live:** https://traidingv.up.railway.app

This is an unaffiliated case study. It is not a real platform, it gives no investment advice, and
every screen says so.

## What it is

| | |
|---|---|
| Architecture | Six sections — Markets · Research · My Money · Learn · Community · Practice. 98 destinations in the inventory, none of them lost in any mode. |
| Experience presets | Simple / Standard / **Professional** are three compositions of one product: which sections lead the menu, what the home page opens with, module order, density, explanation depth, form layout and the Copilot's register. Never access, never the plan — the internal id stays `pro`. |
| Market layer | 49 instruments, delayed quotes from a public provider, 60-second cache, honest degradation — the last good snapshot survives a provider outage. Historical OHLCV per symbol/interval/range behind its own cache. |
| AI | Research Copilot on every page; on `/charts` it sees the candle you selected and searches around that session rather than today. Brief, matching and summary in the Expert Marketplace flow. Claude Opus 5. |
| Strategic features | Nine bets, labelled by maturity rather than by novelty — see [`docs/feature-maturity.md`](docs/feature-maturity.md). |
| Stack | Node 20, Express 4 (ESM), Postgres with an in-memory fallback, static HTML and vanilla JS. **No build step.** |

Two front doors for a reviewer: **`/new`** (what is new, and what is only an idea) and
**`/showcase`** (every idea, its status, the user problem, the metric and the route).

## Maturity, stated plainly

Nothing here is a product. The registry in `public/features.js` grades every feature `live`, `beta`,
`prototype` or `concept`, and the interface shows that grade rather than a flattering one. The most
important consequence: **Expert Marketplace is a prototype** — its consultants are demo records, its
licence identifiers are checked against no registry, and a booking is *held*, never confirmed.
`npm run check:copy` fails the build if any page claims otherwise.

## Running locally

```bash
npm install
npm start                 # http://localhost:3000
npm run dev               # with --watch
```

Nothing is required to start. Without `DATABASE_URL` the storage layer runs in memory and says so;
without `ANTHROPIC_API_KEY` the AI endpoints return 503 with a clear message; the rest of the portal
works either way.

### Environment

| Variable | Effect if unset |
|---|---|
| `DATABASE_URL` | in-memory storage — enquiries are lost on restart, logged loudly in production |
| `ANTHROPIC_API_KEY` | AI endpoints return 503 |
| `STAFF_TOKEN` | **staff endpoints return 503 in production**; open in development |
| `PUBLIC_INDEX` | `robots.txt` disallows everything (the default, and the right one for this stand) |
| `COPILOT_RPM` | 20 requests per minute per address |
| `HOME_AB` | off — `/` always serves the task home; `?home=classic` shows the control |
| `DEMO_EPHEMERAL` | acknowledges running production without a database on purpose |

## Testing

```bash
npm run check       # syntax across every module and inline block, plus the copy gate
npm test            # all browser suites against a real server
npm test -- mode    # one suite by name
npm run check:all   # everything
```

The suites boot `src/server.js` and drive real pages in jsdom — see
[`docs/test-strategy.md`](docs/test-strategy.md) for why that shape and what it does not cover.
Counts live in the test output rather than in this file, so nothing here can go stale.

## Deploying on Railway

Push to `main`. `railway.json` sets the start command and points the healthcheck at `/health/ready`,
which reports on the core portal only — an unconfigured AI key no longer makes the whole service
look unhealthy. Feature status is a separate endpoint, `/api/system/status`.

Set `DATABASE_URL = ${{Postgres.DATABASE_URL}}` in the **service's own** Variables tab, and set
`STAFF_TOKEN` — without it the staff area refuses every request in production, by design.

## Security and privacy

Summarised in [`docs/security-model.md`](docs/security-model.md) and
[`docs/data-retention.md`](docs/data-retention.md). The short version: staff endpoints fail closed,
enquiries are readable only with a per-request access token issued once, AI processing and
consultant sharing are consented to separately, errors return an id rather than an internal message,
and everything a visitor builds — watchlists, alerts, screens, Academy progress, the wealth profile —
never leaves their browser.

## Where Claude does the work

| Step | What the model does | How it is called |
|---|---|---|
| Copilot | Answers about the page you are on, with sources and confirmable actions | Streamed, context-aware, register set by the experience preset |
| Brief | Turns a free-form enquiry into structure: the request, stated goal vs actual question, horizon, experience level, topics, risk signals, what is missing | Structured output against `BRIEF_SCHEMA` |
| Match | Ranks an already-filtered shortlist and explains the order | Structured output against `MATCH_SCHEMA`, `effort: high` |
| Summary | Assembles the consultant's notes into Markdown with five fixed sections | Streamed, SSE through to the browser |

Engineering decisions, not decoration:

- **Hard rules live in code.** Jurisdiction, language and capital range are filtered in
  `hardFilter()`. The model ranks what already passed, and anything it returns outside the input
  list is dropped by an allowlist.
- **Prompt caching.** System blocks are byte-stable and carry `cache_control`; everything variable
  goes after the breakpoint. The effect is visible on `/metrics`.
- **Refusals are handled.** `stop_reason` is checked before reading `content`, and a declined
  request is re-run on a fallback model inside the same call.
- **The disclaimer is appended by the server**, not the model, so no prompt can remove it.

## Documentation

| Document | What it covers |
|---|---|
| [`docs/source-audit-confirmed-findings.md`](docs/source-audit-confirmed-findings.md) | Every defect reproduced in the source, and the ones that did not reproduce |
| [`docs/source-audit-implementation-summary.md`](docs/source-audit-implementation-summary.md) | What the audit release changed |
| [`docs/source-audit-remaining-backlog.md`](docs/source-audit-remaining-backlog.md) | What it deliberately did not |
| [`docs/security-model.md`](docs/security-model.md) | Threat model, staff auth, request ownership, consent, limits, headers |
| [`docs/data-retention.md`](docs/data-retention.md) | What is collected, what is not, how long, and what the visitor is told |
| [`docs/feature-maturity.md`](docs/feature-maturity.md) | Maturity, release marker and commercial tier as three separate facts |
| [`docs/market-data-resilience.md`](docs/market-data-resilience.md) | The cache-overwrite bug and what replaced it |
| [`docs/test-strategy.md`](docs/test-strategy.md) | Why browser suites against a real server |
| [`docs/mode-architecture.md`](docs/mode-architecture.md) | One policy, three presets, and the visibility vocabulary |
| [`docs/mode-first-v2-product-model.md`](docs/mode-first-v2-product-model.md) | Why a mode changes hierarchy and never access |
| [`docs/mode-first-v2-current-source-audit.md`](docs/mode-first-v2-current-source-audit.md) | What the modes measurably were before v2 |
| [`docs/mode-first-v2-navigation-matrix.md`](docs/mode-first-v2-navigation-matrix.md) | The three top-level profiles and the panel priority |
| [`docs/mode-first-v2-surface-matrix.md`](docs/mode-first-v2-surface-matrix.md) | Sixteen surfaces, three compositions each |
| [`docs/mode-first-v2-state-preservation.md`](docs/mode-first-v2-state-preservation.md) | Why a mode switch must not eat a half-typed sentence |
| [`docs/mode-first-v2-implementation-summary.md`](docs/mode-first-v2-implementation-summary.md) | The mode-first v2 P0 release |
| [`docs/mode-first-v2-remaining-backlog.md`](docs/mode-first-v2-remaining-backlog.md) | What P0 deliberately did not do |
| [`docs/mode-page-behaviour-matrix.md`](docs/mode-page-behaviour-matrix.md) | Per-page behaviour in all three modes, before and after |
| [`docs/mode-logic-current-state-audit.md`](docs/mode-logic-current-state-audit.md) | What the modes actually did before the refactor |
| [`docs/mode-migration.md`](docs/mode-migration.md) | How stored preferences are repaired |
| [`docs/mode-refactor-summary.md`](docs/mode-refactor-summary.md) | The mode release |
| [`docs/strategic-feature-registry.md`](docs/strategic-feature-registry.md) | The registry behind every badge, card and promo |
| [`docs/strategic-feature-visibility-map.md`](docs/strategic-feature-visibility-map.md) | Where each feature is reachable from, and the placement rules |
| [`docs/presentation-feature-gap-audit.md`](docs/presentation-feature-gap-audit.md) | Which ideas from the case a reviewer could actually find |
| [`docs/phase-3-implementation-summary.md`](docs/phase-3-implementation-summary.md) | The feature-visibility release |
| [`docs/phase-3-remaining-backlog.md`](docs/phase-3-remaining-backlog.md) | Its backlog, including the localisation estimate |
| [`docs/information-architecture-migration.md`](docs/information-architecture-migration.md) | The six-section regroup and the route map |
| [`docs/current-state-audit.md`](docs/current-state-audit.md) | What the stand contained before the architecture work |
| [`docs/implementation-summary.md`](docs/implementation-summary.md) | The architecture release |
| [`docs/expert-marketplace.md`](docs/expert-marketplace.md) | The original concierge-MVP rationale for hypothesis 07 |
| [`docs/chart-workspace-architecture.md`](docs/chart-workspace-architecture.md) | The chart modules, and why the renderer is SVG rather than canvas |
| [`docs/chart-context-contract.md`](docs/chart-context-contract.md) | What the browser sends about a selected candle, and what the server refuses |
| [`docs/historical-market-data.md`](docs/historical-market-data.md) | The OHLCV endpoint, its clamps, its cache and its failure modes |
| [`docs/chart-copilot-research-method.md`](docs/chart-copilot-research-method.md) | How "why did it move" is answered without inventing a cause |
| [`docs/chart-copilot-current-state-audit.md`](docs/chart-copilot-current-state-audit.md) | What `/charts` actually was before the rebuild |
| [`docs/chart-copilot-implementation-summary.md`](docs/chart-copilot-implementation-summary.md) | The chart Copilot release |
| [`docs/chart-copilot-remaining-backlog.md`](docs/chart-copilot-remaining-backlog.md) | What it deliberately did not do |

## Design

The UI uses `public/tv-theme.css` — the design system supplied in the project handoff package.
System fonts only, nothing loaded from external hosts. Numbers use tabular figures throughout, and
disclaimers appear on every screen.

## Known limitations

- No authentication. Nothing of value requires an account, so nothing asks for one.
- No brokerage, payment or advisory connection anywhere. Everything money-shaped is a prototype and
  says so on the screen.
- Quotes are delayed and come from a free public endpoint; a production service needs a supported
  vendor.
- Consultant rosters and licences are demonstration data.
- Retention is a written policy, not yet an automated job.
- No CSP yet — the inline scripts have to come out first, and a policy with `unsafe-inline` would
  permit exactly what it exists to prevent. `/charts` and `/money` are out; six pages remain.
- The chart's drawing tools take the click so selection is not hijacked, and draw nothing. The
  indicator library and replay are prototype controls, marked as such before they are pressed.
- Not investment advice.
