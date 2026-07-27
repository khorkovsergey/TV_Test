# Information architecture — migration map

Six top-level sections. Every page that existed before this release has a
decision; nothing was deleted silently, and every old path still resolves.

Section labels are English because the portal is English by standing
instruction; the brief names them in Russian only because the brief is Russian.

```
Overview      what is happening, and what of it matters to me
Research      how do I find, study and check an opportunity
Capital       how are my watching, investments and goals connected
Trade         how do I test an idea without risk, or place a trade
Learn         how do I master the market without being overwhelmed
Community     what do other people think, build and recommend
```

## Page decisions

| Before | After | Decision | Why |
|---|---|---|---|
| `/` (task home) | `/` | preserve | the task home is the answer to "what do I want to do"; it stays the entry |
| `/index.html` | `/` | redirect | one canonical home |
| `/classic.html` | `/?home=classic` | preserve | A/B control, unchanged on purpose |
| `/markets.html` | `/markets` | move + redirect | lives under Overview; the page itself is reused whole |
| `/screener.html` | `/screeners` | move + redirect | lives under Research |
| `/symbol.html?symbol=X` | `/symbols/X` | refactor + redirect | becomes the Asset Hub with tabs; old query form still works |
| `/charts.html` | `/charts` | move + redirect | lives under Research; the workspace is unchanged |
| `/academy.html` | `/learn/academy` | move + redirect | lives under Learn |
| `/lesson.html` | `/learn/academy/lesson` | move + redirect | a step of the track |
| `/experts.html` | `/community/experts` | move + redirect | the marketplace is community-supplied expertise, per §13.8 |
| `/staff.html` | `/staff` | preserve | internal, out of the public IA |
| `/metrics.html` | `/metrics` | preserve | internal |
| `/directory.html` | `/sitemap` | move + redirect | the map of everything, linked from the footer |
| — | `/overview` | new | section hub: Today, markets, news, events, why it moves |
| — | `/research` | new | section hub: search, Asset Hub, charts, screeners, maps, fundamentals, macro, options, strategies, Pine |
| — | `/capital` | new | section hub: watching, alerts, portfolio, wealth, goals, saved research |
| — | `/trade` | new | section hub: start, practice, brokers, comparison, accounts, terminal |
| — | `/learn` | new | section hub: start here, academy, investing, trading, Pine, Q&A, help |
| — | `/community` | new | section hub: for you, editors' picks, ideas, discussions, scripts, authors, experts, competitions, rewards |

## Merges

| Merged | Into | Why |
|---|---|---|
| Watchlist on home, in the chart panel, in My space | `Capital → Watching`, surfaced in the other two | one owner, two views |
| Screener entrances (Markets page, nav panel, footer) | `Research → Screeners` | one door per task |
| `beginner` / `standard` / `pro` vocabularies | `simple` / `standard` / `pro` | one word for one thing |
| Brokers menu | `Trade` | trading is a task, and now it has a section |
| Products, Community, More menus | dissolved across the six sections and the footer | the seller's model replaced by the visitor's |

## Removed from the top level

`Products`, `More`, `Brokers`, `Screeners`, `Ideas`, `Pine`, `Wealth Hub`,
`AI Private`, `Expert Marketplace` — all still reachable, none as a top-level
item, exactly as §4 of the brief requires.

## Legacy routes

Every old `.html` path issues a 301 to its new route and keeps the query string,
so `/symbol.html?symbol=BTCUSD` lands on `/symbols/BTCUSD` and a bookmarked
`/markets.html?cls=crypto` keeps its filter. No old path returns 404.
