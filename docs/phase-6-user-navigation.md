# User navigation

## The distinction this file exists to make

A **product inventory** answers *what capabilities exist*. A **user navigation**
answers *what can I achieve here*. The portal had one registry doing both, and the
inventory won.

`public/ia.js` holds 98 destinations: 38 live, 20 pilot, **40 mapped-but-unbuilt**. That is the
right shape for the command palette, the site map, the showcase and the coverage tests — and the
wrong shape for a mega menu. Sixty of those ninety-eight do not work, and rendering them as equal
navigation entries made the product feel larger and heavier than it is.

`public/navigation.js` is the second registry. Only canonical, task-oriented entries that lead
somewhere real. Nothing in it carries `PILOT` or `MAPPED`, because nothing in it is unbuilt.

## The two registries

| | `ia.js` | `navigation.js` |
|---|---|---|
| Answers | what exists | what you can do |
| Size | 98 | 6 sections × ~10 entries |
| Contains unbuilt destinations | yes, deliberately | no |
| Carries status labels | yes | no |
| Powers | palette, site map, showcase, tests | mega menus, section pages |

Both stay. Removing the inventory would lose the case; rendering it as navigation was the mistake.

## Top level

```
Markets · Research · My Budget · Learn · Community · Practice
```

**Overview left the top level.** Home already answers "what is happening now", and having both
produced Logo → Home → Overview → Today → Market brief as five doors to one idea. The `/overview`
page stays — three Markets entries point at its sections — it is simply no longer a top-level
peer of Research.

**Capital became My Budget.** "Capital" is an abstract, investment-oriented word for a section whose
job is to help someone see where their salary went. The strategic name — Personal Wealth Hub —
stays on the page and in the feature registry.

**Trade became Practice.** Paper trading works; broker connection does not exist anywhere on this
stand. Naming the section after the thing that works is honest; it goes back to `Trade` when the
real flow has depth, not before.

## What each menu opens with

Every section leads with tasks, and the rest sits under one `More` disclosure. The split is by
level — Simple opens with fewer rows — but **nothing is ever removed**: `more` is depth, not a
list of things that do not exist.

| Section | Opens with |
|---|---|
| Markets | Market overview · Why markets moved · Stocks · Crypto |
| Research | Find an asset · Screener · Chart · Ask Copilot |
| My Budget | This month · Transactions · Goals · Financial safety |
| Learn | Start here · Personal-finance foundations · Guided Academy · Paper Trading |
| Community | Editors' Picks · Expert Marketplace · Community Rewards |
| Practice | Paper Trading · First practice scenario |

**My Budget does not open with Watchlists.** That was the old `Capital` order, and it is backwards:
somebody opening a section about their money is looking at their money, not at instruments they
follow.

## Workspace

Watchlists, alerts, saved research, saved screeners, recent assets and What's new moved behind the
profile, as `My workspace`. They are things you *keep* — they are not a topic, and they should not
be the first thing any section shows.

## What a normal menu never shows

`MAPPED`, `PILOT`, `PRO`, `LIVE`, depth ratings, surface counts, case hypothesis ids, metrics.

Those describe implementation state, novelty, commercial tier and complexity — four different
things that competed with each other and with the actual task. The complete status map lives in
Showcase and on the site map, where it is the point rather than the noise.
