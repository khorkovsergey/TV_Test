# Mode preference migration

Nobody is forced into Simple. The rule is: an explicit choice is never overridden, a broken value is
repaired rather than tolerated, and an absent value falls back conservatively.

## Accepted inputs

| Stored value | Becomes | Why |
|---|---|---|
| `simple` / `standard` / `pro` | itself | current vocabulary |
| `standart`, `Standart mode` | `standard` | the misspelling that keeps coming back |
| `beginner`, `novice` | `simple` | what Simple was called two releases ago |
| `advanced`, `expert` | `pro` | informal synonyms seen in handoff docs |
| `"pro"` (JSON-quoted) | `pro` | older builds wrote the value through `JSON.stringify` |
| `PRO`, ` Pro ` | `pro` | case and whitespace are not meaning |
| anything else | `simple` | the conservative side, never Pro |
| absent | `simple` | a genuinely new anonymous visitor |

```js
Modes.migrate('Standart mode')   // 'standard'
Modes.migrate('turbo')           // null → caller falls back to 'simple'
```

## When it runs

On load, not merely on read. `modes.js` normalises the stored value the first time any page opens:
if `ui_mode` holds something that is not canonical, the repaired value is written back with
`source: 'migration'`. Reading around a broken value forever is how a typo outlives three releases.

## The record

```js
{ version: 2,
  mode: 'standard',
  selectedAt: '2026-07-27T20:14:02.883Z',
  source: 'manual' | 'onboarding' | 'migration' | 'default',
  dismissedUpgradePrompts: [] }
```

Written to `experience_prefs`. `ui_mode` remains as a plain-string mirror: four scripts read it
directly (`academy.js`, `copilot.js`, the chart, the fallback path in `home.js`), and one duplicated
byte is cheaper than a silent break in any of them.

`version` exists so the next migration can be conditional rather than heuristic.

## Anonymous → authenticated

This stand has no accounts, so the merge is specified rather than built:

- a local manual choice (`source: 'manual'`) wins over a profile default;
- a profile choice wins over a local `migration` or `default` value;
- the merge is deliberate and one-way — signing in never silently replaces a mode the visitor chose
  by hand.

## Existing users of this stand

- Anyone with an explicit mode keeps it.
- Anyone on the legacy `beginner` value lands on Simple, which is the same experience under the
  current name.
- Nobody is auto-promoted. Professional usage may *suggest* Standard (§5.5) but never applies it;
  `dismissedUpgradePrompts` stops a declined suggestion coming back.
