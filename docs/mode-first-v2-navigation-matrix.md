# Mode-first v2 — navigation matrix

## Top level

Routes are never duplicated: a direct entry points at a path `src/routes.js` already owns.

| | Simple | Standard | Professional |
|---|---|---|---|
| 1 | My Money | Markets | Markets |
| 2 | Learn | Research | **Screeners** *(direct)* |
| 3 | Markets | My Money | **Charts** *(direct)* |
| 4 | Research | Learn | Research |
| 5 | Practice | Community | Practice |
| 6 | More | Practice | More |
| 7 | | More | |

**Standard is the compatibility baseline** and is byte-for-byte the menu that shipped yesterday.
It is also the static markup in all 25 pages, which makes it the no-JS fallback: with scripts
disabled every visitor gets the Standard bar, which is the correct thing to fall back to.

Everything a mode displaces lands under `More`, which carries the active state when the open page
is one of them. Nothing becomes unreachable — asserted by `Navigation.everySectionReachable(mode)`
for all three modes.

## Why Simple leads with money and learning

Both are things somebody new can act on today, and neither needs a market opinion to be useful.
Markets and Research stay in the bar because a beginner does look at prices — they simply do not
lead.

## Why Professional gets Screeners and Charts as direct routes

They are destinations a professional types towards. Making them a row inside a panel costs a click
on every single use. They are direct anchors: no caret, no mega panel, because pretending a single
destination has a submenu is how a menu stops being a map.

## Panel priority

Before this release, `Navigation.menu()` split a section's entries by level under a fixed cap. The
measured consequence:

| Section | simple | standard | pro |
|---|---|---|---|
| Markets | 4 | 6 | 6 — identical to Standard |
| Research | 4 | 6 | 6 — identical to Standard |
| My Money | 4 | 6 | 6 — identical to Standard |
| Learn | 4 | 6 | 6 — identical to Standard |
| Community | 3 | 5 | 6 |
| Practice | 2 | 4 | 4 — identical to Standard |

Five of six panels were the same in Standard and Professional.

`PANEL_PRIORITY` now names which entries lead a section in a given mode, and `menu()` **promotes
across the split** — sorting inside the buckets was not enough, because Pine, Options and
Strategies live in `more` and would never have reached the leading rows however they were ordered.

After:

```
research  standard   Find an asset | Screener | Chart | Fundamentals | Compare | Saved research
research  pro        Screener | Chart | Options | Strategies & testing | Pine | Fundamentals

money     standard   This month | Transactions | Goals | Financial safety | Net worth | Investing
money     pro        Net worth | Accounts | Investing | Scenarios | This month | Transactions
```

Zero sections now have identical Standard and Professional panels, and no entry is lost in any
mode — both checked by test.

## Runtime behaviour

`nav.js` rebuilds the bar from `Navigation.topNav(mode)` on load and on every mode change, without
a reload. Anchors are **rebuilt rather than reused**: reusing them kept the previous build's click
listener attached, so after one mode switch a door opened and closed on the same press. Focus is
restored by label after the rebuild, which is what reuse was for.
