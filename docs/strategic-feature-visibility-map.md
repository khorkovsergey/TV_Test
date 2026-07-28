# Strategic feature visibility map

Where each feature is reachable from, after phase 3. Every row in the table is asserted by the
acceptance suite (`phase3-test.cjs`, 116 checks) — if a placement is removed, the suite fails.

## Surfaces

| Surface | What it is |
|---|---|
| `home` | The task-based front page, block *New ways to use the platform* |
| `megaMenu` | The six section panels in the header (data from `ia.js`) |
| `commandPalette` | Ctrl K / Cmd K / `/` — features are indexed alongside pages, instruments and actions |
| `search` | Same index; the header search field opens the palette |
| `assetHub` | `/symbols/<SYMBOL>` — the *Go deeper on this instrument* rail |
| `capital` | `/capital` — Expert Marketplace sits in the **Money** group, next to the Wealth Hub |
| `chart` | `/charts` toolbar and copilot context |
| `screener` | `/screeners` |
| `portfolio` | `/capital` — the promo strip above *Money* |
| `wealthHub` | `/capital/wealth` |
| `academy` | `/learn/academy` — under the expert tracks |
| `copilot` | The assistant panel, block *When AI is not enough* |
| `today` | `/overview` |
| `community` | `/community` |
| `onboarding` | First-visit guidance |
| `whatsNew` | `/new` |
| `showcase` | `/showcase` |

## Map

| Feature | Status | Surfaces | Count |
|---|---|---|---|
| NEW-01 Guided Academy | NEW | home, megaMenu, commandPalette, search, academy, whatsNew, showcase, onboarding | 8 |
| NEW-02 Research Copilot | NEW | home, megaMenu, commandPalette, search, assetHub, chart, screener, portfolio, academy, whatsNew, showcase | 11 |
| NEW-03 Everywhere | CONCEPT | whatsNew, showcase, commandPalette, search | 4 |
| NEW-04 GEO / AEO | CONCEPT | whatsNew, showcase, commandPalette, search | 4 |
| NEW-05 Wealth Hub | BETA | home, megaMenu, commandPalette, search, portfolio, today, copilot, whatsNew, showcase | 9 |
| NEW-06 AI Private | CONCEPT · PREMIUM | whatsNew, showcase, assetHub, portfolio, copilot, commandPalette, search | 7 |
| **NEW-07 Expert Marketplace** | **PROTOTYPE** | **home, megaMenu, commandPalette, search, assetHub, portfolio, wealthHub, academy, copilot, whatsNew, showcase** | **11** |
| NEW-08 Community Rewards | CONCEPT | megaMenu, commandPalette, search, community, academy, whatsNew, showcase | 7 |
| TUNE-10 Chart Research Copilot | BETA | chart, whatsNew, showcase, commandPalette, search, academy | 6 |
| CORE-01…05 | IMPROVED | whatsNew, showcase (+ they *are* the site) | 2 |

Before phase 3, NEW-07 was on 2 surfaces. The requirement was ≥8; it is on 11.

## Where Expert Marketplace lives, and why it moved

It was in Community, next to ideas, scripts and authors. It now sits in **Capital**, in the *Money*
group, immediately after the Wealth Hub, at route `/capital/experts` — with a 301 from the old
address.

Community is where a visitor reads other people's opinions. Someone looking for a human adviser is
not reading; they are looking at their own money and have hit the limit of doing it alone. The
feature belongs in the section that holds watchlists, the portfolio, the wealth profile and goals,
because that is the context an adviser would be given.

## Placement rules

A promo is not an advert. Each placement had to pass three questions before it was added:

1. **Is this the moment the person has the problem?** Expert Marketplace goes next to somebody's
   money (`portfolio`, `wealthHub`), at the end of self-teaching (`academy`), and where an AI answer
   runs out (`copilot`) — not on the chart, where the person is mid-task.
2. **Does it say what it solves, in their words?** Every promo renders `problem`/`audience` from the
   registry, or an override written for that context ("When a course is not the answer").
3. **Is it one component?** All of them are `Features.promo(id, surface, opts)`. Eight placements
   cannot drift into eight designs, and a status change propagates everywhere at once.

Contextual promos are not repeated inside a single page, and none of them block content or appear as
an interstitial. Concept features are never promoted on a working flow's critical path — a `CONCEPT`
badge in the middle of a task the visitor is trying to finish is noise.

## Analytics

Every placement emits `strategic_feature_impression` on render and `strategic_feature_opened` on
click, both carrying `feature_id`, `feature_status`, `surface`, `mode` and `route`. That is what
makes the surface question answerable rather than arguable: *which surface actually produces expert
bookings?* is a query, not an opinion.
