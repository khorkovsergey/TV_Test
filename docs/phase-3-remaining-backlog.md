# Phase 3 — remaining backlog

What phase 3 deliberately did not do, in the order it should be picked up. Everything here is a
scope decision, not an oversight: a concept that is honest about its depth is worth more on this
stand than a half-built feature that claims to work.

## P1 — the next release

**NEW-06 AI Private — one full workflow.** Today there is a written sample report and a labelled
simulated door. The next step is one workflow the visitor drives end to end: pick a company, pick a
question type (earnings quality, scenario, portfolio risk), watch the steps run, get a structured
result with sources. It stays `PREMIUM`/concept — the point is showing the mechanism, not selling it.

**NEW-03 Everywhere — more entry points.** Three demonstrated deep links today. Worth adding: an
embedded-chart entry, an article entry with the reading position preserved, and a Telegram-card
entry that lands on the asset hub with the original question already in the copilot.

**NEW-08 Community Rewards — the loop, not the ledger.** The points ledger is simulated. Missing:
the earning event actually firing from a real action on the stand (publish an idea, complete a
lesson, refer), and progress that survives a reload.

**Personal ranking of features.** `Features.onSurface()` returns everything that belongs on a page.
It should be ordered by what the visitor has already done — someone who finished the Academy should
meet Expert Marketplace before AI Private; someone who built a wealth profile should meet the
opposite. The journey graph in `home.js` already has the data.

## P2 — worth doing, not urgent

**NEW-04 GEO/AEO breadth.** One answerable page exists with real `FAQPage` markup. The bet is only
testable at breadth: a generated set across instruments and concepts, plus `Dataset`/`Article`
markup where it fits, and a measurable "AI citation → research action" path.

**Expert-led Academy tracks.** The academy has six guided lessons; the expert tracks are static
placeholders. Connecting a track to a real adviser in the marketplace is the shortest path from
NEW-01 to NEW-07 and would be the strongest journey on the stand.

**A/B infrastructure.** The `HOME_AB` gate exists and is off. Real experiment infrastructure —
variant assignment, exposure logging, a results view on `/metrics` — would turn every `metric` field
in the registry from a claim into something the stand can actually report.

**Localisation.** Estimated at 1.5–2 hours: 1701 strings / ~3900 words across 25 files, done in three
steps (extract to `i18n.js` → translate → `?lang=ru` plus cookie and `Accept-Language`). Open
question for the owner: does Russian **replace** English or sit **alongside** it? The legal
disclaimers will not be auto-translated without explicit approval — a mistranslated disclosure is
worse than an English one.

## Not in scope, on purpose

**Real brokerage, payment or advisory connections.** Everything money-shaped on this stand is a
prototype and says so. Wiring a real one would make the disclosures false.

**A React/TypeScript rewrite.** §27.4 of the brief forbids it, and the stand does not need it. The
acceptance suites run against a real server in jsdom instead of a type checker.

## Outside the code — owner actions

**`DATABASE_URL` does not reach the Railway service.** `/api/health` still reports
`storage: memory`, so form submissions live only in process memory and are lost on redeploy. Fix:
in the Railway **service's own** Variables tab, add `DATABASE_URL = ${{Postgres.DATABASE_URL}}`.

**Stand security is undecided.** The site is public, carries real brand assets and collects names,
emails and a capital band. Two options, both quick: password-gate the whole stand, or de-brand it.
Awaiting a decision.
