# Implementation Summary

One release. Six sections, three modes, an Asset Hub, clean routes, and no page
left behind.

## What was in the original project

A working portal on Node 20 + Express 4 with static HTML and vanilla JS — no
framework, no build step. Twelve pages, a live quote layer over 49 instruments,
two Claude integrations (Expert Marketplace, Research Copilot), an A/B home,
progressive complexity in the chart, a research-journey graph, trust labels and
a command palette. Full inventory in `current-state-audit.md`.

## What changed

**Six top-level sections** — Overview, Research, Capital, Trade, Learn,
Community — each answering a question rather than naming a product. `Products`,
`More`, `Brokers`, `Screeners`, `Ideas`, `Pine`, `Wealth Hub`, `AI Private` and
`Expert Marketplace` are gone from the top level and none of them lost a home.

**Three modes.** `Simple / Standard / Pro` in the header, one word for one
thing: the Academy's "beginner" and the chart's "beginner" are now both
"simple", and the old stored value still reads correctly. Mode changes what is
offered first — menus, hub shelves, Asset Hub tabs and the action bar all read
it — and never what is reachable. Moving up explains what appeared; moving down
is one click.

**Asset Hub.** The symbol page became `/symbols/:symbol` with nine tabs (five in
Simple, named — not hidden — for the rest), an event chip with an action, a
contextual action bar that reorders by mode, and a technical rating that
explains itself: which readings formed it, how much they agree, over what
timeframe, where they contradict, when it was computed and why it is not a
recommendation.

**Section hubs.** Six new pages rendering from the IA, each with the full shelf
of its section, statuses per destination, and a next logical step.

**The IA is one data structure.** `ia.js` feeds the nav panels, the palette, the
hub shelves, the site map and the footer. That is the only way "each
destination listed once" survives a change.

## New route map

```
/                     task-based home
/overview             Today · markets · why it moves · news · events
/research             search · asset hub · screeners · charts · study · check
/capital              watchlists · alerts · portfolio · wealth · goals · saved
/trade                start · practice · brokers · comparison · terminal
/learn                start here · academy · tracks · Q&A · modes
/community            editors' picks · ideas · scripts · authors · experts · rewards
/markets              all instruments, movers, heatmap, events, tools
/screeners            filters over live quotes
/symbols/:symbol      Asset Hub
/charts               chart workspace
/learn/academy        guided track
/learn/academy/lesson interactive lesson
/community/experts    Expert Marketplace
/sitemap              every destination with status
/staff /metrics       internal
```

## Preserved old sections

Task-based home, Beginner (now Simple) mode, Guided Academy, Research Copilot,
Expert Marketplace, trust labels, contextual research journey, value-first
conversion, progressive complexity, the A/B control and `HOME_AB`, the live
market layer with its sample fallback, and the site map.

## Merged sections

Watchlist (three places → Capital, surfaced elsewhere), screener entrances
(three → Research), mode vocabularies (two → one), brokers menu (→ Trade),
Store/Gifts/Referral (four entrances → Community → Rewards).

## Redirects

Every old `.html` path returns 301 to its new route and keeps the query string:
`/markets.html?cls=crypto` → `/markets?cls=crypto`,
`/symbol.html?symbol=BTCUSD` → `/symbols/BTCUSD`, and so on for eleven paths.
Nothing 404s.

## New components

`hub.js` (section renderer, pilot cards, next-step card), `ia.js` (rewritten for
six sections with levels), `nav.js` (six panels, mode switch, palette with
actions, My space), six section pages, Asset Hub tabs, contextual action bar,
event chip, rating explainer.

## Mock and data architecture

The live layer is real: `src/market.js` fetches 49 instruments from a free
delayed source, caches for a minute, warms at boot, and fails honestly —
`ok:false` with a reason, plus a bundled snapshot labelled `SAMPLE · NOT LIVE`
when the source is slow. Everything else that is not built is a labelled pilot
card, not a fake screen.

## Analytics

Existing events kept. Added: `mode_changed`, `nav_menu_opened`, `nav_menu_item`,
`section_opened`, `section_item_opened`, `asset_tab_opened`, `event_followed`,
`watchlist_added`, `watchlist_removed`, `command_palette_opened`,
`command_palette_search`, `command_palette_selected`, `my_space_opened`,
`alert_intent`, `copilot_from_asset`.

## Tests

jsdom acceptance suites run against a local server. This release adds 144
checks: six sections and no forbidden top-level item, 56 real-site topics still
having a home, every new route and every legacy redirect, the three modes and
the legacy value, panel size, hub shelves, Asset Hub tabs and rating, Capital
with a live watchlist and an empty state that offers an action, the palette
finding a page, an instrument and an action, and identical nav and footer on 17
pages. Earlier suites were re-run and their superseded assertions updated with
the reason recorded.

## Known limitations

- Not TypeScript and not React: §27.4 forbids a full rewrite, so the acceptance
  items about `tsc`, lint and build do not apply. Coverage is jsdom instead.
- Portfolio, Wealth Hub, goals, terminal, brokers, news feed and calendars are
  labelled pilot cards — the flow and the place are real, the depth is not.
- `DATABASE_URL` still does not reach the Railway service, so bookings do not
  survive a restart.
- Mobile is responsive but has no bottom navigation yet.

## Next step

Wire one news source into Overview and the Asset Hub — it is the single missing
piece that would make "why it moves" a fact rather than a description, and every
other module already has a place to hang it.
