# Mode logic — current-state audit

State of Simple / Standard / Pro before the refactor. Method: read every occurrence of the mode
vocabulary in the repository (`simple`, `standard`, `standart`, `pro`, `mode`, `beginner`,
`advanced`, `isSimple`, `isPro`, `complexity`), then open every major route in all three modes on
the deployed stand and record what actually differed.

## Where the mode lived

| Aspect | Before |
|---|---|
| Storage | one key, `ui_mode`, plain string, owned by `window.Portal` in `home.js` |
| Canonicalisation | `canonical()` in `home.js` — tolerated a JSON-quoted value and legacy `beginner` |
| Levels | `ORDER = {simple:0, standard:1, pro:2}` — **defined four times**: `home.js`, `ia.js`, a fallback literal in `symbol.html`, and implicitly in `charts.html` |
| Labels and hints | a fourth copy, the `MODES` array in `nav.js` |
| Density | CSS custom properties under `body[data-ui-mode]` in `portal.css` |
| Persistence record | none — no `selectedAt`, no source, no dismissed prompts, no version |

The single storage key was already right. Everything built on top of it was not: the *meaning* of a
mode was assembled independently on each page, which is exactly why the same word behaved
differently depending on where you stood.

## Spelling

`Standart` appears **zero times** in the codebase — it is a conversational misspelling, not a stored
value. It is now handled anyway: `Modes.migrate()` maps `standart` and `standart mode` to
`standard`, and the acceptance suite asserts the wrong spelling does not appear in any page or
script except the migration line that fixes it.

## Mode and subscription

No coupling found. Nothing keys a paywall, a plan, a data entitlement or a permission off the mode.
This is the one part of §2.1 that was already correct, and there is now a test that keeps it correct.

## Pages that branched on mode

| File | Branches | What the mode did |
|---|---|---|
| `charts.html` | 9 | preset: visible tools, side panel, hint bar, news overlay, Pro overlay, density control |
| `nav.js` | 3 | menu rows per section, mode switch, palette action |
| `academy.js` | 3 | hid `[data-advanced]` elements, mode pill, body attribute |
| `ia.js` | 2 | `menuRows()` filtered by level |
| `home.js` | 2 | `mode()` / `setMode()` / `allows()` |
| `symbol.html` | 1 | tab set and action bar |
| `index.html` | 1 | which task routes are shown |
| `markets.html` | 1 | table columns |
| `capital.html` | 1 | repaint on switch |
| `copilot.js` + `src/copilot.js` | 1 | answer register: beginner vs experienced |

## Pathological behaviour found

**1 — Simple deleted forty-four destinations.** `menuRows()` dropped every item above the visitor's
level. In Simple the mega-menus lost 44 of 98 entries with no affordance saying they existed:
Forex, Futures, Bonds, ETFs, Options, Macro, all three calendars, Market maps, Fundamentals,
Strategies, Pine, Portfolio, **Wealth Hub**, Goals, Brokers, Terminal, Trading, Ideas, Discussions,
Scripts, Authors, Competitions, **Rewards**, Widgets, Charting libraries, and more. This breaks §7.1
outright, and it hid two of the strategic features the case is built on (§2.3).

**2 — the asset hub reset the open tab on every switch.** `renderTabs()` rebuilt the row and marked
the *first* tab active. Switching mode while reading Metrics threw the visitor back to Overview.
Tabs above the level were also removed entirely, with a note naming them but no way to open one.

**3 — the action bar dropped actions instead of moving them.** Simple sliced the list to three and
the other six were gone; §7.4 asks for a `More actions` overflow.

**4 — chart tools were "locked".** Elements above the preset got a `locked` class and no way to open
them without changing the global mode. There was no `Advanced tools` drawer and no
`Reset to mode preset`.

**5 — the academy knew two modes.** `modeLabel` printed `Simple mode` or `Standard mode`, so a Pro
visitor was told they were in Standard. `academy.js` still carried a `'beginner' | 'standard'`
comment and hid `[data-advanced]` outright.

**6 — the chart hint told Pro users the pill "goes back to Beginner"** — a word the product had
already retired.

**7 — no explanation before switching.** Tooltips only. No comparison, and nothing anywhere stating
the thing people actually worry about: that the mode is not a plan and does not touch saved work.

**8 — the switcher was three toggle buttons.** `role="group"` with `aria-pressed`, all three in the
tab order, no arrow-key navigation — a radio group modelled as unrelated toggles.

**9 — Standard's purpose was implicit.** It behaved as "not Simple, not Pro" rather than as the
complete everyday product.

## What was already right

- One storage key with one owner, and a tolerant reader.
- No mode-dependent market data: quotes come from one endpoint that has never seen a mode.
- No parallel `/simple/*`, `/standard/*`, `/pro/*` route trees; one route, one asset identity.
- Switching never redirected, and `ui-mode-changed` already reached charts, markets, capital,
  the asset hub, the hubs and the nav.
- Copilot register already varied by mode, server-side.

## Target

One policy object, three presets, and a visibility vocabulary whose weakest state is still a door.
Written up in [`mode-architecture.md`](mode-architecture.md); the per-page targets are in
[`mode-page-behaviour-matrix.md`](mode-page-behaviour-matrix.md).
