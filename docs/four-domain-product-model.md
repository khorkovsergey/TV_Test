# Four-domain product model

## The three layers

The portal is three layers, and confusing them is what produced the IA this release fixes.

### 1. Primary product domains — the only top-level menu

```
Home      What matters to me today, and what should I do next?
Market    What is happening across asset classes?
Symbols   What is happening with this instrument?
Economy   Which macro indicators and events are moving markets?
```

Four, always, in every mode. A person can describe the product to another person without first
asking which mode they are in.

### 2. Global actions — available everywhere, not menu sections

```
Command palette   Ctrl/Cmd+K, or /
Open Chart        from any instrument, any page
Copilot           the floating widget, on every page
Watchlists · Alerts
Mode switcher
My space (the avatar door)
```

These are things you *do*, not places you *go*. Putting them in the domain menu would have made the
menu a toolbar.

### 3. Personal and content services — full products, owned by Home

```
My Budget · Learn · Guided Academy · Practice / Paper Trading
Community · Expert Marketplace · Saved research · What's New · Community Rewards
```

Each is a real product with real depth. None is a top-level domain. The previous IA promoted three
of them to the top level in Simple mode, which made a beginner's product structurally different
from an expert's — the opposite of what a mode is supposed to do.

## Canonical ownership

Every function has exactly one owning domain. It may be *aggregated* elsewhere; it is never *owned*
twice.

The clearest case is the economic calendar:

```
Economy   owns it — the calendar, the impact, the historical reaction
Home      shows the next event, and links here
Symbols   shows the events for one ticker, and links here
```

Three surfaces, one source. Following an event from any of them lands on the owner.

The same rule settles two arguments that had no answer before:

**Screeners belong to Market, not Symbols.** A screener searches *across* instruments; a selected
result opens Symbols. The search is a market question and the answer is a symbol.

**Bonds appear in both Market and Economy, and that is correct.** Market → Bonds is bonds as
*tradable instruments*: prices, yields, bond ETFs, movers. Economy → Rates is *policy*: central-bank
decisions, yield curves, the macro reading. Same word, two questions, two owners.

## What a mode changes

| | Simple | Standard | Professional |
|---|---|---|---|
| top-level domains | Home · Market · Symbols · Economy | *identical* | *identical* |
| submenu depth | 5–6 leading entries, plain wording | the full working set | tools first, compact |
| shortcuts beside the domains | — | — | Screener · Chart |
| page composition | one lead module, rest folded | balanced | dense, nothing folded |
| explanation depth | guided | context | minimal |
| form layout | wizard | grouped | dense |
| table columns | 5 | 8 | 10 |
| Copilot register | teacher | researcher | analyst |

## What a mode never changes

The four domains. Which domain owns a function. The routes. The data. Saved work. Feature maturity.
What is reachable. Tool availability. Permissions.

`Navigation.domainsAreStable()` and `Navigation.everyEntryReachable(mode)` are the two functions
that make the first and last of those checkable rather than aspirational, and both are asserted in
the suite.

## Home aggregates, but does not absorb

Home shows the market summary, the next macro event, symbol ideas, news and your personal modules.
Every card carries a canonical destination and the deep action continues in the owning domain:

```
a market move    → Market
a macro event    → Economy
a symbol idea    → Symbols
Academy progress → Home / Learn
```

No Home card is allowed to become a dead-end copy of the page it summarises.

## Why the search field was removed

The header carried a search field, a Copilot button and a floating Copilot widget: three doors to
two behaviours. Worse, the field could only ever jump to a destination it already knew about —
which is the smaller half of what somebody arriving with a question needs. "Why is BTC up?" has no
destination.

One door is left. The widget is on every page, and the Home hero carries a wide ask box that sends
the question straight into the same Copilot thread. The command palette survives as a keyboard
shortcut for people who know it exists, and every result in it now names the domain that owns it —
so using it teaches the architecture.
