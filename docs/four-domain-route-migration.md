# Four-domain route migration

## Policy

No route was removed, renamed or redirected in this release. One was added. Ownership metadata was
added on top of the existing tree, which is what §3.5 and §5 of the prompt ask for: no second
portal, no `/simple/*`, no parallel IA.

## Phase IA-1 — done

- four domains in the registry, the header and the static no-JS fallback on all 27 pages;
- `ownerDomain` and `scope` on every inventory destination, **derived from the URL** rather than
  hand-listed, so a destination cannot drift out of sync with where it goes;
- `/economy` added to `ROUTES`, `PAGE_OF` and `LEGACY` (`/economy.html` → `/economy`);
- the site map leads with the four domains;
- the command palette labels every result with its owning domain;
- `/research` became a transitional directory that names each entry's owner;
- no broad redirects.

## Phase IA-2 — partly done

| domain | owns | state |
|---|---|---|
| Market | asset-class discovery, screeners, map | done — `/markets` and `/screeners` are canonical |
| Symbols | instrument analysis, chart, Chart Copilot | done — plus `?tab=` so a menu entry can name a tab |
| Economy | macro data and events | done — `/economy` is canonical and new |
| Home | aggregation and personal services | done — `/` and `/overview`, with personal routes unchanged |

What is **not** done: Options, Strategies and Pine still live on `/research#…` rather than on a
canonical Symbols page. They are correctly *owned* by Symbols and correctly *labelled* as such
everywhere, but they have not moved.

## Phase IA-3 — deliberately not started

Redirect aliases require parity, and parity has not been reached. Two specific reasons:

```
/research#options       → no canonical Symbols page exists yet; redirecting would lose it
/research#fundamentals  → cannot resolve without a symbol
```

§24 names the second case itself and asks for a Symbols launcher when context is missing. That is
what the transitional directory now is. Redirecting before the destination exists would be moving
a link, not moving a page.

## The one candidate that is ready

```
/research#macro → /economy
```

Economy exists and owns macro. It is still not a redirect in this release, because `/research#macro`
is linked from the Markets menu and from Overview modules; those links were repointed at `/economy`
instead. When nothing links to the anchor any more, the alias costs nothing and can be added on its
own.

## Route ownership table

`Navigation.ownerOf(pathname)` — longest matching prefix wins, so `/research/ai-private` resolves
to Symbols before `/research` is considered, and `/learn/academy` resolves to Home.

| route | owner | treatment |
|---|---|---|
| `/` | Home | canonical |
| `/overview` | Home | transitional — positioned as Home → Today |
| `/money`, `/money/*` | Home | canonical (renamed **My Budget**; paths unchanged) |
| `/learn`, `/learn/academy`, `/learn/academy/lesson` | Home | canonical |
| `/community`, `/community/rewards` | Home | canonical |
| `/trade` | Home | canonical |
| `/capital/experts` | Home | canonical |
| `/new`, `/new/everywhere`, `/new/geo-aeo` | Home | canonical |
| `/markets` | Market | canonical |
| `/screeners` | Market | canonical |
| `/symbols/:symbol` | Symbols | canonical, now accepts `?tab=` |
| `/charts` | Symbols | canonical |
| `/research` | Symbols | **transitional directory** |
| `/research/ai-private` | Symbols | canonical |
| `/economy` | Economy | **created** |
| `/sitemap`, `/showcase`, `/staff`, `/metrics` | utility / internal | unchanged |
| `/capital`, `/capital/wealth`, `/classic`, all `*.html` | legacy | redirects preserved |

## Rename

`My Money` → `My Budget` is a **label** change only.

```
unchanged: /money and all eight /money/* routes
unchanged: money_store_v1 and every other storage key
unchanged: the redirect /capital → /money
```

An existing visitor's bookmarks, saved transactions, goals and net-worth entries all survive,
because nothing they depend on was touched.

## State preserved across navigation

Mode, symbol, timeframe, selected candle and range, chart panel, screener filters, watchlists,
alerts, saved research, My Budget data, Academy progress, the expert intake and the Copilot thread.
Nine state adapters now, Economy included.
