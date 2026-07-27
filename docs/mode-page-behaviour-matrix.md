# Mode page behaviour matrix

What each mode does on each page — before the refactor, and after. "Before" is what the deployed
stand actually did, not what it was supposed to do.

Legend for the target column: **shown** = open by default · **more** = under a More affordance ·
**drawer** = behind Advanced tools · **folded** = present, collapsed.

| Page | Simple before | Standard before | Pro before | Problem | Target |
|---|---|---|---|---|---|
| **Global nav** | 6 sections, but only items at level `simple`; 44 destinations vanished | more items | all items | categories disappeared with the mode; no way to know | all 98 destinations in every mode: first rows shown, the rest under **More tools** |
| **Home** | 4 of 7 task routes + *More* | all 7 | all 7 + brief columns | already correct | unchanged; feature block identical in all modes |
| **Today / Overview** | hub shelves filtered by level | more rows | all rows | deeper rows folded, acceptable | shelves keep folding; nothing dropped |
| **Markets** | fewer table columns | normal | all columns | correct in principle | columns by `tableDensity`; **row count identical in all modes** |
| **Asset Hub** | 5 tabs, other 4 deleted; 3 actions, other 6 deleted; active tab reset on switch | 7 tabs, 5 actions | 9 tabs, 9 actions | state loss + deletion | 9 tabs always rendered, above-level ones under **More**; actions capped by `maxPrimaryActions`, rest under **More actions**; active tab survives the switch |
| **Chart** | 3 tools, panels hidden, rest `locked` | 6 tools, panels, density | 40 tools, overlay | locked with no way in | one route, three presets; **Advanced tools** drawer opens everything for this page without changing the mode; *Back to the preset* and *Make it my default* |
| **Screener** | goal presets | full filters | dense table | acceptable | unchanged this release (P1) |
| **News** | curated | feeds | dense | little differentiation | P1 |
| **Economy / Events** | events + affected assets | calendar | dense | event → affected assets never hidden | holds |
| **Portfolio** | pilot cards + promos | same | same | Standard had no distinct behaviour | promos and cards identical; density and explanation differ (P1 for depth) |
| **Wealth Hub** | reachable only from `/capital` and the palette; **absent from the Simple menu** | same | same | a strategic feature hidden by mode | in the menu at every level, level `simple`, route `/capital/wealth` |
| **Trading** | pilot | pilot | pilot | no mode behaviour | P1 |
| **Academy** | six lessons, label said "Simple mode" | six lessons, "Standard mode" | six lessons, **label wrongly said "Standard mode"** | Pro misnamed; `[data-advanced]` hidden outright | label from the policy; advanced items folded, never removed |
| **Community** | feed not mode-aware | same | same | `defaultCommunityFeed` existed only on paper | policy carries editors/for-you/full; wiring is P1 |
| **Expert Marketplace** | full flow | full flow | full flow | correct — never gated by mode | unchanged; promos present in all modes |
| **Copilot** | beginner register, server-side | experienced | experienced | Pro not distinguished from Standard | register still by mode; multi-step Pro workflows are P1 |
| **/new, /showcase** | all 13 features | all 13 | all 13 | correct | asserted by test: identical set in all modes |

## Invariants asserted by the suite

- Menu item count is identical in Simple and Pro; no destination is Pro-only.
- Wealth Hub, Expert Marketplace, Rewards, Academy and Search appear in the menu at every level.
- `/new` renders 13 feature cards in all three modes.
- The asset hub renders nine tabs in all three modes; only their placement changes.
- Total actions on the asset hub is nine in every mode; only how many lead changes (3 / 5 / 8).
- Market table row count is identical across modes; only the column count differs.
- Quote data comes from one endpoint that never sees a mode, and `quotes.js` does not reference it.
- Route, symbol and the open tab survive a switch.

## Screenshots

The brief asks for Playwright screenshots per page per mode. This stand has no Playwright
dependency and no build step (§27.4 of the earlier brief forbids introducing that machinery), so the
same guarantees are asserted structurally in jsdom against a live server instead — counts, presence,
placement and preserved state, which is what the screenshots would have been read for. Named as a
deviation rather than quietly skipped.
