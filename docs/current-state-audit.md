# Current-state audit

Taken before any change of this release. Everything below is what the repository
actually contained, not what it was supposed to contain.

## Stack

| Layer | What is there |
|---|---|
| Runtime | Node 20, ESM |
| Server | Express 4, no build step, no bundler |
| Views | Static HTML per page, vanilla JS, one shared CSS theme |
| State | `localStorage` / `sessionStorage` through `home.js` (`window.Portal`) |
| Data | `src/market.js` — 49 instruments from a free delayed quote source, 60 s cache |
| Persistence | `pg` when `DATABASE_URL` is set, in-memory fallback otherwise |
| AI | Anthropic SDK — `src/claude.js` (Expert Marketplace), `src/copilot.js` (Research Copilot) |
| Tests | jsdom acceptance suites, run against a local server |

There is no TypeScript, no router library and no component framework. The
migration in this release therefore reuses the existing pages and adds routing
on the server, rather than introducing a front-end framework — as §27.4 of the
brief requires.

## Pages, before

| Page | Route | What it does | Quality |
|---|---|---|---|
| `index.html` | `/`, `/index.html` | Task-based home: 7 routes + "skip the portal", live brief, value CTA, journey trail, ideas | good, reusable |
| `classic.html` | `/?home=classic` | A/B control — the old promo home | keep as control |
| `markets.html` | `/markets.html` | 49 instruments, class tabs, sortable table, movers, heatmap, events, IA shelf | good, reusable |
| `screener.html` | `/screener.html` | Filters over live quotes, 8 question presets, saved screens | good, reusable |
| `symbol.html` | `/symbol.html?symbol=` | Live quote, 8 key figures, month chart, technical readings, peers, journey rail | needs tabs → Asset Hub |
| `charts.html` | `/charts.html` | Chart workspace, progressive complexity, density, RSI pane, range-news module | good, reusable |
| `academy.html` | `/academy.html` | 6-step track, progress, mode pill, expert tracks, value CTA, completion state | good, reusable |
| `lesson.html` | `/lesson.html` | Interactive lesson 3 on a chart | good, reusable |
| `experts.html` | `/experts.html` | Expert Marketplace: request → AI brief → match → booking | good, functional |
| `staff.html` | `/staff.html` | Consultant desk, AI summary streaming | internal |
| `metrics.html` | `/metrics.html` | Pilot metrics, AI cost | internal |
| `directory.html` | `/directory.html` | Site map with per-destination status | good, reusable |

## Shared components, before

| File | Responsibility | Reuse |
|---|---|---|
| `home.js` (`window.Portal`) | analytics buffer, A/B variant, meaningful-action funnel, `ui_mode`, density, journey graph, watchlist | yes — the spine |
| `quotes.js` (`window.Quotes`) | quote fetching with a 3 s budget, bundled sample fallback, formatting, sparkline, source line | yes |
| `ia.js` (`window.IA`) | the information architecture as data (5 doors) | rewritten this release |
| `nav.js` | nav panels, ⌘K palette, My space | extended this release |
| `copilot.js` | the Copilot widget on every page | yes |
| `academy.js` (`window.Academy`) | lesson progress, gating, mode | yes |
| `portal.css`, `tv-theme.css`, `backgrounds.css` | the whole design layer | yes |

## What already existed of the target feature set

Present: task-based home, Beginner mode, Guided Academy, Research Copilot,
Expert Marketplace, trust labels, contextual research journey, value-first
conversion, progressive complexity in the chart, command palette.

Absent: Capital section (watchlists/alerts/portfolio as pages), Wealth Hub,
goals and scenarios, AI Private, Rewards, a Trade section, an Overview section,
a Community section, Asset Hub tabs, a three-level mode switch.

## Duplication found

- Watchlist appears on the home page, in the chart side panel and in My space.
- Ideas appear on the home page only, but the nav pointed at `/#ideas` from
  every page — an anchor into another document.
- Screener is reachable from Markets, from the nav panel and from the footer.
- Two different mode vocabularies: `beginner|standard` in the Academy and
  `beginner|standard|pro` in the chart.

## Functionality that must not be lost

1. The Expert Marketplace flow end to end, including the staff desk and metrics.
2. Copilot with live quote grounding, tool proposals and the advice filter.
3. The Academy track, its progress storage and the interactive lesson.
4. The live market layer with its honest failure and sample fallback.
5. Every analytics event already firing (25 of them).
6. The A/B control page and the `HOME_AB` switch.
7. The site map with per-destination status.

## Technical risks for this refactor

| Risk | Mitigation |
|---|---|
| Renaming `beginner` → `simple` desynchronises Academy, chart and Copilot | one canonical reader in `Portal.mode()` that maps the old value; asserted in tests |
| Six doors break every suite that asserts "five nav items" | suites updated in the same commit, with the reason recorded |
| New routes break internal links | old paths kept as redirects that preserve the query string; a test walks every internal link in the IA |
| Section pages become empty shells | each one renders from the IA data and from the live quote layer, and states what is a pilot stub |
