# Strategic Feature Registry

The registry is code, not a document: [`public/features.js`](../public/features.js). Every badge,
launchpad card, contextual promo, command-palette entry and acceptance test reads from it. This
file explains what the fields mean and why the registry exists at all; it is not a second copy of
the data, because a second copy would go stale within a week.

## Why a registry

Phase 2 solved hierarchy. Ninety-five navigation entries were grouped into six sections and
labelled `live / pilot / mapped`. It worked — and it buried the product thinking. A visitor could
walk the whole portal and never learn that Expert Marketplace was the deepest thing on it, because
the nav treated "Expert Marketplace" and "Cookie policy" as the same kind of object: a link with a
status dot.

The registry restores the second dimension. `ia.js` answers *where can I go*. `features.js` answers
*what is new here, what problem does it solve, how far is it actually built, and how would you
judge the bet*.

## Fields

| Field | Meaning |
|---|---|
| `id` | `NEW-01…08` for the strategic bets, `CORE-01…05` for reworked journeys. Stable — analytics and docs key on it. |
| `name` / `shortName` | Full name; short name for cards and palette rows where space is tight. |
| `status` | `new · beta · concept · premium · improved`. See below. |
| `priority` | `strategic` (a new bet) or `core` (a rebuilt existing journey). |
| `problem` | The user's problem, in the user's terms. Not a feature description. |
| `solution` | What this prototype does about it. |
| `audience` | Who it is for. Used in contextual promos. |
| `route` | Where it lives. Every route is asserted to return 200 in the acceptance suite. |
| `surfaces` | Every place the feature must be reachable from. The suite verifies each one. |
| `related` | Other feature ids. Validated — a typo fails the suite. |
| `metric` | The measurement that would decide whether the bet worked. |
| `depth` | 1–5, how much of it is really built. Concepts are capped at 3 by test. |
| `searchTerms` | The words a person would actually type ("human help", "savings", "answer engine"). |

## Statuses, and why the distinction matters

| Badge | Promise to the visitor |
|---|---|
| `NEW` | A new capability that **works here**. You can use it right now. |
| `BETA` | Works, but the flow is incomplete. |
| `CONCEPT` | A strategic idea **demonstrated as a prototype**. It is not a product and does not pretend to be. |
| `PREMIUM` | A paid tier, shown as a concept with an interest signal. Nothing is charged, no payment door is real. |
| `IMPROVED` | A major rebuild of a journey that already existed. |

A stand that dresses an idea up as a working feature is worse than one with fewer features — the
reviewer stops trusting everything else on it. Hence `CONCEPT` and `PREMIUM` are as loud as `NEW`,
and the concept pages repeat the disclosure in their own body copy rather than relying on the badge.

## The thirteen entries

**Strategic bets** — NEW-01 Guided Academy · NEW-02 Research Copilot · NEW-03 TradingView
Everywhere · NEW-04 GEO/AEO · NEW-05 Personal Wealth Hub · NEW-06 AI Private · NEW-07 Expert
Marketplace · NEW-08 Community Rewards.

**Reworked journeys** — CORE-01 Task-based Home · CORE-02 Progressive Complexity · CORE-03
Contextual Research Journey · CORE-04 Trust-first labelling · CORE-05 Value-first conversion.

Statuses, depths, routes and surfaces for each are in `features.js`; the site itself renders the
full table at [`/showcase`](https://traidingv.up.railway.app/showcase).

## The API

```js
Features.ALL          // every entry
Features.byId('NEW-07')
Features.onSurface('assetHub')          // what belongs on this kind of page
Features.strategic() / core()
Features.working() / concepts()
Features.badge(status)                  // the one badge component (§VIS-002)
Features.promo(id, surface, opts)       // the one contextual promo component (§VIS-006)
Features.track(event, feature, props)   // impression / open, with surface and mode
Features.isShowcase() / setShowcase(on) // reviewer's case-note mode
```

Two components, one registry. That is the whole enforcement mechanism for §VIS-001: a page cannot
invent its own badge design or its own copy of a feature's status, because it never has the data —
it asks the registry.
