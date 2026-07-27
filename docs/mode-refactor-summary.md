# Mode refactor — summary

**Problem.** Three experience modes existed, and their meaning was assembled independently on every
page: four copies of the level order, a separate labels array in the header, a density block in the
stylesheet and nine per-page conditionals. The visible result was the one the brief describes —
some pages changed dramatically, others barely, blocks disappeared without explanation, and the
visitor could not tell what a mode would do before choosing it.

**Approach.** Incremental refactor, no rewrite. One policy object, three presets, and a visibility
vocabulary whose weakest state still leaves a door open.

## What changed

### One policy — `public/modes.js`

`Modes.policy(mode)` answers the questions a page actually has: how dense, how much explanation, how
many primary actions, which chart preset, which table density, which community feed. Pages stopped
testing `mode === 'simple'` and started asking the policy. `nav.js` now takes its labels and hints
from it, so the header cannot call a mode something the rest of the product does not.

### Navigation stopped deleting itself

`IA.menuSplit()` replaces `menuRows()` and returns `{rows, more}`. The level decides what a menu
opens with; everything else goes under **More tools**. Before: Simple showed 54 of 98 destinations
and gave no sign the other 44 existed — including Wealth Hub and Rewards, two of the strategic
features the case is built on. After: the count is identical in all three modes, asserted by test.

Wealth Hub and Rewards were also relevelled to `simple` and repointed at the pages that now exist
(`/capital/wealth`, `/community/rewards`) instead of anchors on a hub.

### The asset hub stopped losing your place

Nine tabs are always rendered; the ones above the level sit in a **More** disclosure and can be
opened without changing the mode. The active tab is page state now, so a mode switch keeps you on
Metrics instead of throwing you back to Overview. The action bar caps by
`policy.maxPrimaryActions` (3 / 5 / 8) and the rest move under **More actions** — nine actions exist
in every mode, only how many lead changes.

### The chart stopped locking tools

An **Advanced tools** drawer opens everything above the preset, for this page only, without touching
the global mode — with `Back to the <mode> preset` as the way out and `Make it my default` as the
explicit, never automatic, promotion. The Pro hint no longer promises the pill "goes back to
Beginner", a word retired two releases ago.

### The switcher became a switcher

`role="radiogroup"`, three radios, exactly one selected, arrow keys between them, only the selected
one in the tab order, state announced as text rather than colour. Beside it a `?` opens **Compare
modes**: the three presets side by side, plus two lists — what switching changes, and what it never
changes (plan, billing, entitlement, saved work, prices, routes, strategic features). Both lists are
rendered from `Modes.CHANGES` / `Modes.KEEPS`, so the promise in the dialog is the same string as
the rule in the code.

### Migration became real

`Modes.migrate()` accepts `standart`, `Standart mode`, `beginner`, `novice`, `advanced`, `expert`,
JSON-quoted values and any casing. It runs **on load**, not merely on read, so a broken value is
repaired in storage rather than tolerated forever. The preference record is versioned and carries
where the choice came from. Details in [`mode-migration.md`](mode-migration.md).

### Smaller fixes

- The academy knew two modes and told Pro visitors they were in Standard; the label now comes from
  the policy, and `[data-advanced]` items fold instead of vanishing.
- `body` now carries `data-density` and `data-explain` alongside `data-ui-mode`, so explanation
  depth is a CSS concern rather than a per-page conditional.
- Eight mode analytics events added; `mode_switch` is still emitted so the older funnel keeps working.

## Acceptance

`mode-test.cjs` — 147 checks across policy integrity, migration, the spelling guard, the
mode/subscription separation, navigation completeness in all three modes, strategic-feature presence
in all three modes, the switcher's accessibility, the comparison dialog, state preservation on the
asset hub and chart, density versus data (row counts identical, column counts different), academy
labels, analytics and regression.

Full suite total after this release: **rel 157 · mode 147 · fix 122 · phase3 116 · home 101 · v2 87 ·
data 80 · progressive 71 · bg 52 · academy 37** — 970 checks, no failures.

Five assertions in `rel-test` were updated rather than fixed: they asserted the *old* behaviour —
that Simple showed five tabs and that the header held exactly three buttons. Both statements are now
false by design (nine tabs, four buttons), so the assertions were rewritten to check the new promise:
five tabs open by default and four under **More**, seven menu rows visible with the rest under a
disclosure.

## Deviations from the brief, stated rather than skipped

- **No Playwright screenshots.** This stand has no build step and no Playwright dependency; the
  guarantees the screenshots would have been read for are asserted structurally in jsdom against a
  live server. Named in [`mode-page-behaviour-matrix.md`](mode-page-behaviour-matrix.md).
- **No TypeScript files.** The brief's `/src/modes/*.ts` layout assumes a React/TS app; §27.4 of the
  earlier brief forbids that rewrite. The same model is implemented in one vanilla module.
- **P1 items not done:** Screener, News, Trading and Community mode behaviour; Copilot multi-step Pro
  workflows; onboarding recommendation UI and progression prompts (the policy and the
  `dismissedUpgradePrompts` record exist, the prompts do not fire yet).
