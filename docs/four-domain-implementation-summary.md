# Four-domain IA — Implementation Result

## Four-domain model

```
Home      entry point; aggregates markets, news, ideas and personal services
Market    overview pages for asset classes
Symbols   individual instrument pages
Economy   macro data and events
```

The same four, in the same order, in Simple, Standard and Professional. That is the whole point of
the release, so it is asserted by the registry itself (`Navigation.domainsAreStable()`) and again
in the browser, rather than left as a claim in a comment.

## What a mode still changes

Which entries lead a domain's menu, in what order, how deeply the page composes, how much is
explained, which columns a table shows, which tabs lead, which form profile applies, which Copilot
register answers. What it no longer changes: the four domains, which domain owns a function, the
routes, and what is reachable.

## Navigation

`public/navigation.js` was rewritten. Six mixed sections — Markets, Research, My Money, Learn,
Community, Practice — became four domains, each holding the union of its entries plus a per-mode
`lead` list of ids. `menu(domain, mode)` returns rows from the lead list and **everything else** as
`more`. Nothing can fall out: an entry is in one list or the other, by construction, and
`everyEntryReachable(mode)` says so.

Before this, the top row was itself mode-dependent. Simple opened with `My Money · Learn · Markets ·
Research · Practice`, Professional with `Markets · Screeners · Charts · Research · Practice`. Two
people using the same product could not describe it to each other.

Professional keeps two compact shortcuts — Screener and Chart — **beside** the four domains. They
never replace one.

## Simple menus

Plain wording where the product's own name assumes knowledge a beginner has not been given:
`Manage my money`, `Learn without risk`, `Practise trading`, `Find instruments`, `Understand an
asset`, `What affects markets`. Elsewhere the label is the same in all three modes, because
somebody who learns "Screeners" in Standard should still recognise it in Professional. The
per-mode label lives on the entry as `plain`, so there is one entry with two wordings rather than
two entries that drift.

## Standard menus

The full daily portal. Every domain leads with its complete working set; only the genuinely
advanced entries sit under *More in …*.

## Professional menus

Tools first. Market leads with Screeners and the Map; Symbols leads with Chart, Technicals,
Financials, Options, Strategies and Pine; Economy leads with the calendar, rates and yield curves;
Home leads with saved work, alerts, watchlists and saved screeners.

## Home

Home is the entry point and the owner of the personal services — My Budget, Learn, Guided Academy,
Practice, Community, Expert Marketplace, Community Rewards, What's New. They are full products and
they are not top-level domains; §2.3 is explicit about the difference and this is where it lands.

## Market

Owns asset-class discovery and the Screener. The screener searches *across* instruments and a
selected result opens Symbols, which is why it belongs here and not there.

`ETFs & Funds` points at the screener with the reason attached: this pilot's 49-instrument universe
has no separate ETF class, and a heading with nothing behind it is worse than an honest redirect.

## Symbols

Owns instrument analysis, the chart and the Chart Research Copilot. A menu entry may now name a
tab — `/symbols/NVDA?tab=technicals` — with `technicals`, `fundamentals` and `financials` aliased
onto the tabs that actually exist. Without this every Symbols menu row landed on the same view and
the visitor had to find the tab themselves, which is the difference between a menu and a list of
links to one page.

## Economy

New: `public/economy.html`, `public/economy.js`, route `/economy`.

What is real: the four instruments the brief leads with (`US10Y`, `VIX`, `DXY`, `GOLD`) are live
from the same market layer as every other page, and **Historical Reaction is genuinely computed** —
it reads the OHLCV history endpoint and shows what the named instrument actually did over the last
month. When the endpoint does not answer it says so and shows nothing, because without the candles
there is nothing honest to say about a reaction.

What is not: the calendar is two fixed, dated entries. Countries, Macro Indicators, GDP,
Employment, Yield Curves, Dividends, IPO Calendar and Country Compare are `MAPPED` — address and
architecture now, data later. They are rendered as visible mapped cards rather than omitted,
because a reviewer needs to see where they would live, and rendered as mapped rather than filled
with plausible numbers, because inventing macro data would make the whole hub unusable as evidence.

Every module states four things in the same place: what it is, how mature it is, where the numbers
came from, and when. A module that cannot say all four does not get to look like one that can.

## Research transition

`/research` is not deleted. It became a transitional directory: a banner saying it is a launcher
rather than a domain, and four groups — Market Research, Symbols Research, Economy Research,
Personal & saved — with every card carrying `OWNED BY <domain>`. The grouping is computed from
`Navigation.ownerOf`, so a destination that changes domain moves here too instead of quietly
disagreeing with the menu.

## Overview transition

`/overview` stays and is positioned as Home → Today. Its modules keep linking to canonical owners.

## Global actions

The header lost two controls in this release.

**The search field is gone**, on all 27 pages. It could only ever jump to a destination it already
knew about, which is the smaller half of what somebody arriving with a question needs. The command
palette survives on `Ctrl`/`Cmd`+`K` and on `/`, and every result in it now carries the domain that
owns it, so a person reading the list learns the architecture while using it.

**The Copilot button is gone.** The header had a search field *and* a Copilot button *and* a
floating widget — three doors to two behaviours. One door is left: the widget, on every page.

**A wide ask box was added to the Home hero.** It sends the question straight into the Copilot
thread rather than into a result list, so `why is BTC up?` — a question with no destination — has
somewhere to go. Example questions under it follow the mode; they are examples, never a filter.
Asking before the deferred widget has loaded queues the question rather than losing it.

## Personal services

Reachable from Home's menu in every mode, and from the profile door. `Navigation.WORKSPACE` is
derived from Home's own entries so there is one list rather than two that drift.

## Strategic features

All nine strategic features and five core improvements keep their registry entries and their
maturity. NEW-05 is `My Budget` now (see below); the rest are unchanged. A mode changes how loudly
a feature is said and nothing else.

## Renaming

`My Money` → **`My Budget`**, everywhere it is visible: 23 files across `public/`, `src/`,
`tests/`, `docs/` and `README.md`. Storage keys are untouched — `money_store_v1` stays
`money_store_v1`, and every route under `/money/*` still resolves — so an existing visitor's data
and bookmarks survive the rename. One sentence in `navigation.js` still says "My Money" on purpose:
it describes the menu this release replaced, and rewriting it would be rewriting history rather
than the product.

## Route compatibility

Every existing route still resolves. `/economy` was added to the registry, `PAGE_OF` and the legacy
table (`/economy.html` → `/economy`). No redirect was made destructive: §24's Phase IA-3 aliases
are deliberately **not** in this release, because `/research#fundamentals` cannot redirect to a
symbol page without a symbol.

## State preservation

Mode switching still preserves route, symbol, timeframe, selected candle, chart panel, screener
filters, watchlists, alerts, saved research, My Budget data, Academy progress, the expert intake
and the Copilot thread. Economy gained its own state adapter — selected event, mapped fold, scroll
— bringing the count to nine.

## Files created

```
public/economy.html
public/economy.js
docs/four-domain-implementation-summary.md
docs/four-domain-navigation-matrix.md
docs/four-domain-remaining-backlog.md
```

## Files modified

`public/navigation.js` (rewritten) · `public/ia.js` (domain metadata) · `public/nav.js` (domain
labels in the palette) · `public/mode-surfaces.js` (Economy surface) · `public/symbol.html`
(`?tab=`) · `public/research.html` (transitional directory) · `public/directory.html` (domain
block) · `public/index.html` (hero ask) · `public/portal.css` (hero ask styling) ·
`public/chart/chart-page.js` (header button removed) · `src/routes.js` (`/economy`) · 27 page
shells (static menu, search field, Copilot button) · `tests/browser/modes-v2-test.cjs`

## Tests added

No new suite. `modes-v2-test.cjs` absorbed the four-domain checks, as §28.3 asks: the four stable
labels, the identical top-level set across modes, `/economy` reachable, key routes reachable, no
lost destinations, and the header carrying neither a search field nor a Copilot button.

Six existing checks were **rewritten**, in each case because they asserted the architecture this
release deliberately replaces:

- "Simple leads with money and learning" and "Standard equals yesterday's six sections" → the four
  domains are identical in every mode.
- "the top menu is rebuilt per mode" → the domain row is stable; Professional *adds* shortcuts.
- "displaced sections live under More" → nothing at the top level is displaced any more; More
  carries utilities, which were never domains.
- "without JS the markup shows Standard's six sections" → four domains.
- "Professional gets Pine, Options and Strategies leading Research" → leading Symbols.

## Bugs found while doing this

**Removing the search field silently killed `Ctrl`/`Cmd`+`K` on every page.** The keyboard listener
was registered *inside* `wireSearch()`, behind `if (!box) return` — so deleting the box deleted the
shortcut with it. The palette is not the field; the field was one way in, and it was not the only
one that had to survive. The listener is now registered first and unconditionally, and a check
opens the palette on a page that has no search field and never will.

Caught by a test, not by reading the diff.

**`Navigation.WORKSPACE` was dropped in the first draft of the rewrite.** The avatar door reads it
on every page, so the profile menu would have broken site-wide. It is back, derived from Home's own
entries so there is one list rather than two that drift.

**The Screener's first four-domain markup put `data-form-surface` on the form element itself.**
`apply()` looks for `.ff-form` among descendants, so it could never find itself.

**A stale test server on port 3217 served `/economy` as 404** long after the route existed, which
looked exactly like a routing bug for two runs. Verified against a fresh server on another port
before changing anything.

## Commands run

```
npm run check     — 66 files/blocks parsed, 0 failed · 65 files scanned, 0 problems
npm test          — 13 suites
```

## Known limitations

Economy has no macro data feed, and eight of its areas are mapped rather than built. This is the
one backlog §29 permits: it needs external data that does not exist on this stand.

`/research` is still a real page rather than a redirect. Parity has not been reached — Options,
Strategies and Pine have no canonical Symbols page yet — and redirecting before parity would lose
the content.

`/money/*` still serves one shell for eight routes.

The palette is keyboard-only now that the search field is gone. On a touch device without a
keyboard the Copilot widget is the only global entry point; a visible palette affordance for touch
is not built.

`Profile` appears in the four-domain matrix's Professional Home column. It is **not** rendered as a
menu entry: §23 is explicit that Profile is not a fifth domain, and this prototype has no profile
page. The avatar door carries `My space` instead, and Home's menu carries the same entry.
