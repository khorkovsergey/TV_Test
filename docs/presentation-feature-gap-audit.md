# Presentation ↔ feature gap audit

State at the start of phase 3, measured against the presentation the case is built on. The question
this audit answers: *of the ideas the case argues for, which ones can a reviewer actually find and
try on the stand, and which ones exist only in the deck?*

## Method

Walked the deployed portal at every route in `ia.js` (95 destinations), in all three modes, as an
anonymous visitor. For each idea in the presentation I recorded: is it built, how deep, and from how
many surfaces is it reachable without knowing the URL.

## Result

| # | Idea | Built? | Depth 1–5 | Surfaces before | Verdict |
|---|---|---|---|---|---|
| NEW-01 | Beginner Mode + Guided Academy | yes | 4 | 4 | fine |
| NEW-02 | Personal Research Copilot | yes | 4 | 6 | fine |
| NEW-03 | TradingView Everywhere | no | 0 | 0 | **missing entirely** |
| NEW-04 | GEO / AEO answerable pages | no | 0 | 0 | **missing entirely** |
| NEW-05 | Personal Wealth Hub | named only | 1 | 1 | **a pilot card, no product** |
| NEW-06 | AI Private | no | 0 | 0 | **missing entirely** |
| NEW-07 | Expert Marketplace | yes, deepest thing on the stand | 5 | **2** | **built and hidden** |
| NEW-08 | Community Rewards | no | 0 | 0 | **missing entirely** |
| CORE-01 | Task-based Home | yes | 5 | — | unlabelled |
| CORE-02 | Progressive Complexity | yes | 5 | — | unlabelled |
| CORE-03 | Contextual Research Journey | yes | 4 | — | unlabelled |
| CORE-04 | Trust-first labelling | yes | 4 | — | unlabelled |
| CORE-05 | Value-first conversion | yes | 4 | — | unlabelled |

## The headline finding

**Expert Marketplace was the most complete feature on the stand and reachable from two places.**
The full flow exists — matching by country and capital, regulator and licence verification, explicit
consent over what context is shared, a standardised written result — and the only ways in were the
Community section of the mega-menu and a single link inside the Academy. A reviewer following any
of the journeys the case actually argues for (a beginner hitting the limit of self-teaching; someone
looking at their money; someone whose AI answer was not enough) would never meet it.

That is not an architecture problem. It is the *cost* of the architecture fix: phase 2 made every
destination equal, and equality is exactly wrong for a feature that is the answer to the case's
central question.

## Second finding

Four of the eight strategic bets did not exist on the stand at all (NEW-03, 04, 06, 08) and one
existed as a card with a title (NEW-05). Five of eight ideas the case is *about* were, on the site,
indistinguishable from ideas nobody had had. A deck claiming eight bets in front of a stand showing
three is worse than a stand showing three and claiming three.

## Third finding

The five reworked journeys (CORE-01…05) were built and invisible in a different way: they *are* the
site, so there is nothing to click, and a reviewer who never used the old TradingView cannot see
that anything changed. They needed labelling, not building — which is what showcase mode does.

## What phase 3 did about it

- Built NEW-05 into a working flow (profile → analysis → scenarios → saved comparison → expert handoff).
- Built honest concept demos for NEW-03, NEW-04, NEW-06, NEW-08 — each shows a real mechanism and says
  in its own body copy that it is a concept.
- Raised Expert Marketplace from 2 surfaces to 11, using one shared promo component.
- Added a status vocabulary and one badge component, so "works here" and "idea" can no longer be confused.
- Added `/new` and `/showcase` as the two front doors for a reviewer.
- Added showcase mode: case notes under blocks, off by default, never changing product behaviour.

Post-phase surface counts and per-feature placements are in
[`strategic-feature-visibility-map.md`](strategic-feature-visibility-map.md).
