# Mode page behaviour matrix

What each mode does on each page — before the refactor, and after. "Before" is what the deployed
stand actually did, not what it was supposed to do.

Legend for the target column: **shown** = open by default · **more** = under a More affordance ·
**drawer** = behind Advanced tools · **folded** = present, collapsed.

| Page | Simple before | Standard before | Pro before | Problem | Target |
|---|---|---|---|---|---|
| **Global nav** | 6 sections, but only items at level `simple`; 44 destinations vanished | more items | all items | categories disappeared with the mode; no way to know | all 98 destinations in every mode: first rows shown, the rest under **More tools** |
| **Home** | 4 of 7 task routes + *More* | all 7 | **byte-identical to Standard** | Pro had no purpose here | Pro opens with a compact desk strip: followed instruments, alerts, saved screens, and six workspace entries |
| **Today / Overview** | hub shelves filtered by level | more rows | all rows | deeper rows folded, acceptable | shelves keep folding; nothing dropped |
| **Markets** | fewer table columns | normal | all columns | correct in principle | columns by `tableDensity`; **row count identical in all modes** |
| **Asset Hub** | 5 tabs, other 4 deleted; 3 actions, other 6 deleted; active tab reset on switch | 7 tabs, 5 actions | 9 tabs, 9 actions | state loss + deletion | 9 tabs always rendered, above-level ones under **More**; actions capped by `maxPrimaryActions`, rest under **More actions**; active tab survives the switch |
| **Chart** | 3 tools, panels hidden, rest `locked` | 6 tools, panels, density | 40 tools, overlay | locked with no way in | one route, three presets; **Advanced tools** drawer opens everything for this page without changing the mode; *Back to the preset* and *Make it my default* |
| **Screener** | goal presets, all 10 columns, all filters open | identical | identical | mode did nothing at all | 5 / 8 / 10 columns; the numeric filter block folded in Simple and Standard, open in Pro; filter values survive the switch |
| **News** | three pilot cards, same in every mode | same | same | no differentiation | Important today and Open-on-chart at complexity 1, personalised feeds at 2, the dense multi-source News Flow at 3 |
| **Economy / Events** | events + affected assets | calendar | dense | event → affected assets never hidden | holds |
| **Portfolio** | pilot cards + promos, identical in all modes | same | same | Standard had no distinct behaviour | Wealth Hub at complexity 1, Portfolio and Goals at 2, risk decomposition / scenario comparison / benchmark contribution at 3 |
| **Wealth Hub** | reachable only from `/capital` and the palette; **absent from the Simple menu**; the page itself ignored the mode | same | same | a strategic feature hidden by mode, then indifferent to it | in the menu at every level; Simple walks the four-step wizard with the teaching copy, Pro opens every field at once and unfolds the advanced risk view |
| **Trading** | identical in all modes | same | same | no mode behaviour | paper trading at 1, replay and journal at 2, connected accounts, advanced order types, multi-account and risk controls at 3 |
| **Academy** | six lessons, label said "Simple mode" | six lessons, "Standard mode" | six lessons, **label wrongly said "Standard mode"** | Pro misnamed; nothing else changed | label from the policy, plus a curriculum block that changes with the preset: reading a chart → skills tracks → strategy testing, Pine, workspaces, automation |
| **Community** | feed not mode-aware | same | same | `defaultCommunityFeed` existed only on paper | For-you at 1, Ideas and Authors at 2, Discussions, Scripts, Pine creators, configurable feeds and moderation at 3; Expert Marketplace stays at 1 by rule |
| **Expert Marketplace** | full flow, identical intro | same | same | never gated by mode, but never adapted either | flow identical; Simple explains what the service is and is not, Standard states the matching rules, Pro leads with the compliance facts |
| **Copilot** | beginner register | experienced | **same as Standard** | Pro was a label, not a difference | three registers, and the opener count comes from `maxPrimaryActions` (3 / 5 / 8) |
| **/new, /showcase** | all 13 features, identical framing | all 13 | all 13 | the set was right, the framing did not adapt | same 13 in every mode; Simple leads with the user's problem, Standard with what the product does, Pro with the mechanism, the metric and the surface count |

## Follow-up: the mode was cosmetic on most pages

The first mode release fixed the model and the pages that had obvious mode logic, and left the rest
alone. Measuring the deployed stand afterwards showed what that actually meant:

| Route | Before the follow-up |
|---|---|
| `/`, `/screeners`, `/capital/wealth`, `/learn/academy`, `/capital/experts`, `/new` | the mode changed **nothing** — padding only |
| `/overview`, `/research`, `/capital`, `/trade`, `/learn`, `/community` | only the number of folded disclosures |
| **Standard vs Pro** | **identical on 8 of 11 routes** |
| explaining words | **identical in all three modes, on every page** |

Two root causes, both structural rather than per-page:

1. `explanationDepth` was a policy field nothing read. The stylesheet declared two rules; no page
   tagged any copy, so `guided`, `contextual` and `minimal` produced the same words.
2. `fillModules(mode)` handed every hub the mode and every hub ignored it, so a section rendered the
   same modules three times over.

Both are fixed at the mechanism level — `data-explain-level` applied by `Portal.applyExplain`, and
`Hub.modules(mode, [...])` placing modules by declared complexity — plus professional modules that
simply did not exist before (market breadth, correlation and factor view, risk decomposition,
advanced order types, multi-account, Pine creators, configurable feeds). Screener columns and
filters, the Wealth Hub entry form and advanced risk view, the Academy curriculum, the Expert
Marketplace introduction, the `/new` framing and the Copilot's register and suggestion count now
all read the policy.

## Invariants asserted by the suite

- Menu item count is identical in Simple and Pro; no destination is Pro-only.
- Wealth Hub, Expert Marketplace, Rewards, Academy and Search appear in the menu at every level.
- `/new` renders 13 feature cards in all three modes.
- The asset hub renders nine tabs in all three modes; only their placement changes.
- Total actions on the asset hub is nine in every mode; only how many lead changes (3 / 5 / 8).
- Market table row count is identical across modes; only the column count differs.
- Quote data comes from one endpoint that never sees a mode, and `quotes.js` does not reference it.
- Route, symbol and the open tab survive a switch.
- **No route renders identically in two modes.** Fifteen routes × two adjacent pairs, compared on a
  structural fingerprint: visible cards, buttons, tabs, table columns, task routes, form fields,
  explanation nodes, disclosures and total text length.
- The teaching paragraph (`data-explain-level="deep"`) appears only in Simple; no explanatory copy at
  all survives into Pro; trust labels, sources and disclaimers survive into every mode.

## Screenshots

The brief asks for Playwright screenshots per page per mode. This stand has no Playwright
dependency and no build step (§27.4 of the earlier brief forbids introducing that machinery), so the
same guarantees are asserted structurally in jsdom against a live server instead — counts, presence,
placement and preserved state, which is what the screenshots would have been read for. Named as a
deviation rather than quietly skipped.
