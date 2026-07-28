# Four-domain navigation matrix

Generated from `public/navigation.js`. The `lead` list per mode is what the menu **opens with**;
everything else in the domain sits under *More in <domain>*. No entry is in neither list.

## Top level — identical in every mode

```
Home · Market · Symbols · Economy
```

Professional adds two compact shortcuts **beside** them — `Screener` and `Chart` — and never
replaces a domain. `More` carries three utilities that were never domains: Product innovations,
My space, Full site map.

## Home — 15 entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Today | `/overview` | 1 | 1 | more |
| My Budget *(Simple: "Manage my money")* | `/money` | 2 | 2 | 6 |
| Learn *(Simple: "Learn without risk")* | `/learn` | 3 | 3 | more |
| Guided Academy | `/learn/academy` | more | more | more |
| Practice *(Simple: "Practise trading")* | `/trade` | 4 | 4 | more |
| Community *(Simple: "Ideas for beginners")* | `/community` | 5 | 5 | more |
| Saved work *(Simple: "Continue my work")* | `/money#saved` | 6 | 6 | 1 |
| Recent symbols | `/symbols/BTCUSD` | more | more | 5 |
| Watchlists | `/money#watchlists` | more | more | 3 |
| Alerts | `/money#alerts` | more | more | 2 |
| Saved Screeners | `/screeners#saved` | more | more | 4 |
| Expert Marketplace | `/capital/experts` | more | 7 | more |
| Community Rewards | `/community/rewards` | more | more | more |
| My space | `/money#saved` | more | more | 7 |
| What's New | `/new` | more | 8 | 8 |

## Market — 15 entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Market overview | `/markets` | 1 | 1 | more |
| Stocks | `/markets?cls=stocks` | 2 | 2 | 3 |
| Crypto | `/markets?cls=crypto` | 3 | 3 | 4 |
| Forex *(Simple: "Currencies")* | `/markets?cls=forex` | 4 | 4 | 5 |
| Futures & Commodities | `/markets?cls=commodities` | more | 5 | 6 |
| Bonds | `/markets?cls=rates` | more | 6 | 7 |
| ETFs & Funds | `/screeners` | more | 7 | 8 |
| Indices | `/markets?cls=indices` | more | 8 | 9 |
| Screeners *(Simple: "Find instruments")* | `/screeners` | 6 | 9 | 1 |
| Market Map | `/markets#heatmap` | 5 | 10 | 2 |
| Movers | `/overview#brief` | more | 11 | more |
| Market breadth | `/overview#modules` | more | more | 10 |
| Market News | `/overview#news` | more | 12 | more |
| Saved market views | `/screeners#saved` | more | more | 11 |
| Compare Markets | `/markets` | more | more | more |

**Bonds vs macro rates (§8.5).** `/markets?cls=rates` is bonds and volatility as *instruments* —
prices you can trade. Central-bank rates, yield curves and policy decisions belong to Economy. The
same word, two domains, and the split is deliberate.

## Symbols — 18 entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Find Symbol *(Simple: "Find an asset")* | `/research#search` | 1 | 1 | more |
| Asset Hub *(Simple: "Understand an asset")* | `/symbols/BTCUSD` | 2 | 2 | more |
| Chart *(Simple: "Open Chart")* | `/charts` | 3 | 3 | 1 |
| Overview | `?tab=overview` | more | 4 | more |
| Why it moved | `?tab=why` | 4 | more | more |
| Fundamentals | `?tab=metrics` | more | 5 | more |
| Financials | `/research#fundamentals` | more | 6 | 3 |
| Technicals | `?tab=why` | more | 7 | 2 |
| News | `?tab=news` | more | 8 | more |
| Ideas | `?tab=ideas` | more | 9 | more |
| Events *(Simple: "News and events")* | `?tab=events` | 6 | 10 | more |
| Peers / Compare *(Simple: "Compare assets")* | `/markets` | 5 | 11 | 7 |
| Options | `/research#options` | more | more | 4 |
| Strategies & Testing | `/research#strategies` | more | more | 5 |
| Pine | `/research#pine` | more | more | 6 |
| AI Private | `/research/ai-private` | more | more | 8 |
| Saved Research | `/money#saved` | more | more | 9 |
| Chart Copilot | `/charts` | more | more | 10 |

`?tab=` is read by `symbol.html`; `technicals`, `fundamentals` and `financials` are aliased onto
the tabs that exist rather than pointing at tabs that do not.

## Economy — 19 entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Economy Overview *(Simple: "What affects markets")* | `/economy` | 1 | 1 | more |
| Economic Calendar | `/economy#events` | 2 | 8 | 1 |
| Central Bank Rates *(Simple: "Rates and inflation")* | `/economy#rates` | 3 | 4 | 2 |
| Inflation | `/economy#rates` | more | 5 | more |
| Why Markets Moved | `/economy#why` | more | more | more |
| Earnings Calendar *(Simple: "Earnings")* | `/economy#earnings` | 4 | 9 | 6 |
| Affected Markets | `/economy#markets` | more | more | more |
| Affected Symbols | `/economy#symbols` | more | more | more |
| Historical Reaction | `/economy#reaction` | more | more | 10 |
| Event Impact | `/economy#markets` | more | 11 | 9 |
| Countries | `/economy#countries` | 5 | 2 | more |
| Macro Indicators *(Simple: "More indicators")* | `/economy#indicators` | 6 | 3 | 5 |
| GDP | `/economy#indicators` | more | 6 | more |
| Employment | `/economy#indicators` | more | 7 | more |
| Yield Curves | `/economy#curves` | more | more | 3 |
| Dividends | `/economy#dividends` | more | more | 7 |
| IPO Calendar | `/economy#ipo` | more | more | 8 |
| Country Compare | `/economy#compare` | more | more | 4 |
| Macro News | `/overview#news` | more | 10 | more |

Eight of these are `MAPPED` on the page itself: Countries, Macro Indicators, GDP, Employment, Yield
Curves, Dividends, IPO Calendar, Country Compare. The menu entry is real and the anchor lands on a
card that says what it would contain and what feed it needs.

## Route ownership

`Navigation.ownerOf(pathname)` — longest prefix wins.

| prefix | owner |
|---|---|
| `/economy` | Economy |
| `/markets`, `/screeners` | Market |
| `/symbols`, `/charts`, `/research`, `/research/ai-private` | Symbols |
| `/money`, `/learn`, `/community`, `/trade`, `/capital/experts`, `/new`, `/overview`, `/` | Home |

Used by the header's active state, by the command palette's result labels, by the site map's domain
block and by the `/research` directory's `OWNED BY` cards — one resolver, four surfaces, so they
cannot disagree.
