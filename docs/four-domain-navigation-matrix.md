# Four-domain navigation matrix

Generated from `public/navigation.js`. The `lead` list per mode is what the menu **opens with**;
everything else in the domain sits under *More in <domain>*. No entry is in neither list.

## Top level

Four core domains, identical in every mode:

```
Home · Market · Symbols · Economy
```

Plus **Academy**, which is a domain but not part of that promise:

| mode | top row |
|---|---|
| Simple | `Home · Market · Symbols · Economy · Academy · More` |
| Standard | `Home · Market · Symbols · Economy · More` — Academy inside More |
| Professional | `Home · Market · Symbols · Economy · Screener · Chart · More` — Academy inside More |

This is a deliberate exception and it costs something: somebody who finds the Academy in Simple
loses it from the header on switching to Standard. What buys it back is that the domain is one
press away in `More` in every mode, carries the active state when you are inside it, and never
stops existing. `domainsAreStable()` was **narrowed** to the four core domains rather than deleted —
making the exception visible in the assertion instead of hiding it by removing the check.

Professional's two compact shortcuts — `Screener` and `Chart` — sit **beside** the domains and never
replace one. `More` also carries three utilities that were never domains: Product innovations, My
space, Full site map.

## Home — 23 entries, one named block

Home's menu carries a block: **Personal Wealth Hub**, shown in all three modes. The heading is a
heading, not a link — the hub is the sum of the pages under it, and pointing the heading at one of
them would make that one look like the whole thing. My Budget sits inside it.

```
Personal Wealth Hub
  My Budget · Transactions · Budget · Goals · Financial safety
  Accounts · Net worth · Investing · Scenarios
```

What a mode changes is how many of the block's rows lead: Simple opens with the three a beginner
can act on today, Professional opens with net worth, scenarios and investing.

**Expert Marketplace leads Home's menu in all three modes**, in the same place. Somebody with money
questions deserves the same door whether they call themselves a beginner or a professional — it is
the one entry deliberately exempt from per-mode ordering.

Learning and practice left Home in this release; they belong to Academy now.

## Home — leading entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Today | `/overview` | 1 | 1 | more |
| **My Budget** *(Simple: "Manage my money")* | `/money` | 2 | 2 | 8 |
| Transactions | `/money/transactions` | more | 3 | more |
| Budget | `/money/budget` | more | more | more |
| Goals | `/money/goals` | 3 | 4 | more |
| Financial safety | `/money/safety` | more | more | more |
| Accounts | `/money/accounts` | more | more | more |
| Net worth | `/money/net-worth` | more | 5 | 5 |
| Investing | `/money/investing` | more | more | 7 |
| Scenarios | `/money/scenarios` | more | more | 6 |
| Community *(Simple: "Ideas for beginners")* | `/community` | 4 | 6 | more |
| Saved work *(Simple: "Continue my work")* | `/money#saved` | 5 | 7 | 1 |
| **Expert Marketplace** | `/capital/experts` | 6 | 8 | 9 |
| What's New | `/new` | more | 9 | 11 |
| Recent symbols | `/symbols/BTCUSD` | more | more | more |
| Watchlists | `/money#watchlists` | more | more | 3 |
| Alerts | `/money#alerts` | more | more | 2 |
| Saved Screeners | `/screeners#saved` | more | more | 4 |
| Community Rewards | `/community/rewards` | more | more | more |
| My space | `/money#saved` | more | more | 10 |

Rows in **bold** are the two the release fixed in place: My Budget always inside the Personal
Wealth Hub block, Expert Marketplace always leading, in every mode.

Six leading rows in Simple, and that is a ceiling rather than a coincidence — a panel longer than
seven lines stops being a menu. Financial safety therefore sits in the block under *More in Home*
rather than pushing Expert Marketplace out of the opening view.

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

## Academy — 17 entries

| entry | destination | Simple | Standard | Professional |
|---|---|:--:|:--:|:--:|
| Guided Academy | `/learn/academy` | 1 | 1 | 6 |
| Interactive lesson | `/learn/academy/lesson` | more | more | more |
| Start here | `/learn#start` | 2 | more | more |
| All learning tracks | `/learn` | more | 2 | 7 |
| Personal-finance basics | `/learn#money` | 3 | more | more |
| Investing basics | `/learn#investing` | 4 | 3 | more |
| Trading basics | `/learn#trading` | more | 4 | more |
| Chart skills | `/learn#charts` | more | 5 | more |
| Pine Script | `/learn#pine` | more | more | 1 |
| Strategy testing | `/learn#strategy` | more | more | 2 |
| Expert-led tracks | `/learn/academy#tracks` | more | more | 5 |
| Structured Q&A | `/learn#qa` | 6 | 8 | more |
| Help centre | `/learn#help` | more | more | more |
| Paper Trading | `/trade#practice` | 5 | 6 | more |
| First practice scenario | `/trade#start` | more | more | more |
| Bar replay | `/charts` | more | more | 4 |
| Trading journal | `/trade#journal` | more | 7 | 3 |

Practice sits here rather than in Home because a paper trade is a lesson you are allowed to get
wrong. `/trade` is paper trading, not trading — the route is owned by Academy accordingly.

## Route ownership

`Navigation.ownerOf(pathname)` — longest prefix wins.

| prefix | owner |
|---|---|
| `/economy` | Economy |
| `/markets`, `/screeners` | Market |
| `/symbols`, `/charts`, `/research`, `/research/ai-private` | Symbols |
| `/learn`, `/learn/academy`, `/trade` | Academy |
| `/money`, `/community`, `/capital/experts`, `/new`, `/overview`, `/` | Home |

Used by the header's active state, by the command palette's result labels, by the site map's domain
block and by the `/research` directory's `OWNED BY` cards — one resolver, four surfaces, so they
cannot disagree.
