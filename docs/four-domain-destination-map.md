# Four-domain destination map

Where each of the inventory's 98 destinations ended up, and who owns it now.

## How ownership is decided

Not by a hand-written list. `IA.ownerDomain(url)` calls `Navigation.ownerOf(pathname)`, which
resolves the **longest matching route prefix**. A destination therefore cannot drift out of sync
with where it actually goes: change its URL and its owner changes with it.

```js
IA.withDomains()          // every destination, with ownerDomain and scope
IA.byDomain('economy')    // one domain's destinations
IA.everyDestinationOwned()// the invariant: nothing is unowned
```

`scope` is a second, independent axis — what a destination is *about*, which is not the same as who
owns it. A watchlist is `personal` but owned by Home; a screener is `market`-scoped but reached
from Market. Search ranks on scope; navigation groups on owner.

## Domain by domain

### Home — the entry point and the personal services

```
/                     the portal entry
/overview             Today — market brief, why it moved, news, events
/money, /money/*      My Budget: this month, transactions, budget, accounts,
                      goals, safety, net worth, investing, scenarios
/learn                Learn — the six guided steps
/learn/academy        Guided Academy
/learn/academy/lesson one lesson
/community            ideas, discussions, authors, scripts
/community/rewards    Community Rewards
/trade                Practice — paper trading, replay, journal
/capital/experts      Expert Marketplace
/new, /new/*          What's New, Everywhere, GEO/AEO
```

Personal services are full products under Home. They are not top-level domains, and §2.3 of the
brief is explicit about the difference.

### Market — asset classes and the screener

```
/markets              overview, and six classes by ?cls=
/markets#heatmap      Market Map
/screeners            Screeners, and #saved
```

`ETFs & Funds` has no class in this pilot's 49-instrument universe. It points at the screener with
the reason attached rather than at a heading with nothing behind it.

### Symbols — one instrument at a time

```
/symbols/:symbol        Asset Hub, nine tabs, now addressable with ?tab=
/charts                 the chart workspace and the Chart Research Copilot
/research#search        find a symbol
/research#fundamentals  Fundamentals / Financials       (not yet moved)
/research#options       Options                          (not yet moved)
/research#strategies    Strategies & Testing             (not yet moved)
/research#pine          Pine                             (not yet moved)
/research/ai-private    AI Private
```

Four of these are *owned* by Symbols and *labelled* as such everywhere, but still live on
`/research`. That is the honest state: ownership moved, the page has not. See
[`four-domain-route-migration.md`](four-domain-route-migration.md).

### Economy — macro data and events

```
/economy            the hub
/economy#events     Economic Calendar          PILOT
/economy#rates      Central Bank Rates, Inflation   PARTLY LIVE
/economy#why        Why Markets Moved          PILOT
/economy#markets    Affected Markets, Event Impact  PILOT
/economy#symbols    Affected Symbols           LIVE
/economy#reaction   Historical Reaction        LIVE
/economy#earnings   Earnings Calendar          MAPPED
/economy#countries  Countries                  MAPPED
/economy#indicators Macro Indicators, GDP, Employment   MAPPED
/economy#curves     Yield Curves               MAPPED
/economy#dividends  Dividends                  MAPPED
/economy#ipo        IPO Calendar               MAPPED
/economy#compare    Country Compare            MAPPED
```

### Utility and internal — owned by nobody, and that is correct

```
/sitemap   /showcase   /staff   /metrics   /classic
```

They are reachable, they are listed on the site map, and they are not in the domain menu. `/sitemap`
and `/new` sit in the header's `More` door because they are utilities, not domains — which is
exactly why `More` still exists after the top level stopped being mode-dependent.

## What moved conceptually, without moving physically

| destination | was under | now owned by | moved on disk? |
|---|---|---|---|
| Screeners | Research | **Market** | no |
| Market maps | Research | **Market** | no |
| Fundamentals, Options, Strategies, Pine | Research | **Symbols** | no |
| Macro & rates | Research | **Economy** | the links were repointed at `/economy` |
| Earnings, dividends, IPO calendars | Overview | **Economy** | now have real anchors |
| My Budget, Learn, Community, Practice | top level | **Home** | no |
| Expert Marketplace | top level (Simple) | **Home** | no |

Nothing was deleted. Every destination ID in the inventory is intact — `IA.allItems().length` is
asserted in the suite, alongside `IA.everyDestinationOwned()`.
