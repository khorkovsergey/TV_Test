# Mode architecture

One product, one information architecture, three presentation presets. The whole model lives in
[`public/modes.js`](../public/modes.js); this document explains the rules it encodes.

## The three dimensions

```
ExperienceMode   simple | standard | pro      how capability is presented
SubscriptionTier free | essential | plus | premium   what is commercially available
Permissions      account role and entitlement  what the user is allowed to do
```

They never touch. A visitor can be Pro mode on a free plan, or Simple mode on premium. Nothing in
the mode layer may read or write a plan, and the acceptance suite greps for exactly that coupling.

## The policy

```js
Modes.policy('standard')
// { id, label: 'Standard', description: 'Полный анализ',
//   tagline: 'the complete everyday product',
//   complexity: 2, density: 'balanced', explanationDepth: 'contextual',
//   maxPrimaryActions: 5, chartPreset: 'standard',
//   defaultCommunityFeed: 'for-you', showContextualEducation: true,
//   showAdvancedByDefault: false, tableDensity: 'standard' }
```

| | Simple | Standard | Pro |
|---|---|---|---|
| Russian label | Понятный старт | Полный анализ | Профессиональное рабочее пространство |
| Complexity | 1 | 2 | 3 |
| Density | comfortable | balanced | compact |
| Explanation | guided | contextual | minimal |
| Primary actions | 3 | 5 | 8 |
| Chart preset | simple | standard | pro |
| Community feed | editors | for-you | full |
| Advanced by default | no | no | yes |

A page asks the policy a question — *how many primary actions, how dense, how much explanation* —
instead of testing a string. `mode === 'simple'` scattered through the codebase was the disease;
`policy(mode).maxPrimaryActions` is the cure.

## Visibility: nothing returns "hidden"

```js
Modes.VISIBILITY  // ['always','default','collapsed','more-menu','advanced-drawer']
```

The vocabulary deliberately has no `hidden`. The weakest state a module can be in is `more-menu` —
present, one click away, discoverable. This is the mechanism that stops a preset from deleting a
product, and it is enforced by test: the list is asserted not to contain `hidden`.

```js
Modes.presentation(3)
// { simple: 'more-menu', standard: 'collapsed', pro: 'default' }
```

Applied in three places so far:

- **Navigation** — `IA.menuSplit(section, mode, 6)` returns `{rows, more}`. `rows` open the menu,
  `more` goes under a *More tools* disclosure. In every mode the menu contains all 98 destinations.
- **Asset hub tabs** — the nine tabs are always rendered; the ones above the level sit in a `More`
  disclosure, and opening one does not change the mode.
- **Chart tools** — the *Advanced tools* drawer reveals everything above the preset for this page
  only, with `Back to the <mode> preset` as the way out.

## Explanation depth, applied rather than declared

The policy has always carried `explanationDepth`, and for one release nothing read it: every page
carried exactly the same number of explaining words in all three modes. Depth is now applied to the
copy itself.

```html
<div data-explain-level="context">the one-line "what this is"</div>
<div data-explain-level="deep">the paragraph that teaches</div>
```

| Depth | Budget | Result |
|---|---|---|
| `guided` (Simple) | 2 | both levels shown |
| `contextual` (Standard) | 1 | the short line stays, the teaching paragraph goes |
| `minimal` (Pro) | 0 | neither — the professional reads the number, not the lesson |

`Portal.applyExplain(depth)` sets `hidden` on the elements, so the rule survives a missing
stylesheet and can be asserted by test. A CSS mirror stays as a no-JavaScript fallback.

**Never carries `data-explain-level`:** trust labels, sources, timestamps, delays and disclaimers.
Those are in every mode, including Pro (§8.2).

## Module complexity in section hubs

Hubs used to render identical modules in all three modes — `fillModules(mode)` received the mode and
every page ignored it, which is precisely why Standard and Pro were the same page with different
padding. Modules now declare a complexity once:

```js
H.modules(mode, [
  { complexity: 1, html: … },   // everyone opens with it
  { complexity: 2, html: … },   // Simple folds it
  { complexity: 3, html: … }    // Simple → "More in this section", Standard folds, Pro opens
])
```

Professional modules that did not exist before — market breadth, correlation and factor view, risk
decomposition, advanced order types, multi-account, Pine creators — were added at complexity 3, so
Pro is a different page rather than a differently-spaced one.

## Temporary disclosure vs the global default

```
globalExperienceMode      the stored preference
temporaryPageDisclosure   this page, this visit, not persisted
```

Opening advanced content never silently promotes the visitor. Promotion is a separate, explicit
action — *Make it my default* on the chart, or a pick in the comparison dialog. There is no
automatic upgrade and no automatic downgrade anywhere in the code.

## Persistence

```js
{ version: 2, mode: 'standard', selectedAt: '2026-07-27T…',
  source: 'manual' | 'onboarding' | 'migration' | 'default',
  dismissedUpgradePrompts: [] }
```

Stored under `experience_prefs`, with `ui_mode` kept as a plain-string mirror because four scripts
read it directly and breaking them silently would be worse than one duplicated byte. Precedence:
profile setting (not on this stand) → stored preference → onboarding recommendation → Simple for a
genuinely new anonymous visitor.

Migration runs on load, not just on read: a stored `standart` is rewritten as `standard` the first
time a page opens, so a broken value cannot survive in storage forever.

## The promise

`Modes.CHANGES` and `Modes.KEEPS` are rendered verbatim by the comparison dialog, so the copy shown
to the visitor and the rule enforced in the code are literally the same strings.

**Switching changes** density, which panels and columns open unasked, how much explanation comes
with each number, the chart preset, table density, how many actions a page offers before *More*, and
the default community feed.

**Switching never changes** the plan or billing, data entitlement, any saved thing (watchlists,
alerts, portfolios, research, layouts), the account and permissions, the prices themselves, the six
sections and every route, or the availability of any strategic feature.

## Switcher

One switcher, one place: the header. `role="radiogroup"` with three `role="radio"` buttons —
exactly one selected, arrow keys move between them, only the selected one is in the tab order, and
the state is announced as `aria-checked` text rather than a colour. Next to it, a `?` opens
*Compare modes*.

## Analytics

`mode_changed`, `mode_comparison_opened`, `mode_change_cancelled`, `temporary_advanced_opened`,
`temporary_advanced_closed`, `make_mode_default_clicked`, `advanced_feature_opened_in_simple`,
`mode_state_preserved` — each carrying `from`, `to`, `route`, `surface` and the resulting policy
where it is meaningful. `mode_switch` is still emitted alongside `mode_changed` so the older
progressive-complexity funnel keeps working.
