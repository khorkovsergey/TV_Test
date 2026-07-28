# Four-domain IA — remaining backlog

The whole agreed scope of the four-domain prompt was implemented in one release. §29 allows a
backlog only for functions that objectively do not exist in the current code **and** require new
external data. This file is that list, plus the honest limitations of what was built.

## Data-dependent — the only permitted backlog

These have an address, a place in the architecture and a visible `MAPPED` card on `/economy`
saying what they would contain and what they need. None of them can be built on this stand without
a feed that does not exist here.

| area | anchor | needs |
|---|---|---|
| Country pages | `/economy#countries` | a macro data feed |
| Macro indicators (with release schedule and revisions) | `/economy#indicators` | a macro data feed |
| GDP series | `/economy#indicators` | a macro data feed |
| Employment series | `/economy#indicators` | a macro data feed |
| Yield curves (whole curve, not one tenor) | `/economy#curves` | full-curve yield data |
| Dividends calendar | `/economy#dividends` | a corporate-actions feed |
| IPO calendar | `/economy#ipo` | a listings feed |
| Country comparison | `/economy#compare` | a macro data feed |
| Earnings calendar | `/economy#earnings` | a corporate-actions feed |

The economic calendar itself is a **pilot**, not mapped: two dated entries exist and are wired to
the modules below them, so the flow (event → affected markets → affected symbols → historical
reaction) is real end to end. Only the list of events is fixed.

## Limitations of what was built

**`/research` is a directory, not a redirect.** §24's Phase IA-3 aliases are deliberately absent.
Options, Strategies and Pine have no canonical Symbols page yet, so redirecting `/research#options`
would lose the content rather than move it. `/research#fundamentals` cannot redirect to a symbol
page at all without a symbol — §24 names this case and asks for a launcher, which is what the
directory now is.

**`/money/*` still serves one shell for eight routes.** Carried over; the router decides which
module leads, but there is one page behind all eight addresses.

**The command palette is keyboard-only.** The header's search field was removed this release. On a
touch device without a keyboard the Copilot widget is the only global entry point — a visible
palette affordance for touch is not built.

**`Profile` is not a menu entry.** The four-domain matrix lists it in Professional's Home column;
§23 says Profile must not become a fifth domain, and this prototype has no profile page. The
avatar door carries `My space`, and Home's menu carries the same entry. Stated rather than quietly
dropped.

**Historical Reaction shows one month, not the reaction to the named event.** It reads real OHLCV
and says so — "here is the record, look at it yourself". Aligning the window to the event date
needs the calendar to carry real dates, which needs the feed above.

**Scroll is restored to the same pixel offset**, not to the same element, after a recomposition.
Carried over from the previous release.

## Carried over, unchanged

Mobile bottom navigation for the site as a whole. The permanent prototype strip. The six-column
footer. Six monolith pages still blocking a real CSP.

## Checks from §32 of the previous release still not written

The chart's mode compositions (62–67), Learn (78–82), Community/Practice (83–91), the Copilot's
register rendered in a real answer (95–99), and the responsive/accessibility set (107–112).

## Owner actions

`DATABASE_URL` still does not reach the Railway service — `/api/system/status` reports
`storage: memory`. The variable has to be added in the service's own Variables tab.

The stand is public and carries brand assets it does not own.
