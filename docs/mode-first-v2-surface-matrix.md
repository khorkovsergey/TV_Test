# Mode-first v2 — surface matrix

`public/mode-surfaces.js` answers, once, the question every page used to answer for itself.

## The problem it replaces

Before this file the mode was applied locally and differently everywhere:

- `index.html` — a `SIMPLE_ROUTES` array plus `style.display`
- `hub.js` — a complexity bucket, preserving source order
- `copilot.js` — a cap on the number of suggested prompts
- `charts.html` — a `data-min` sweep
- `academy.js` — a class and a fold

Each was a reasonable local answer. Together they produced Professional as "Standard plus one
block" on the home page and byte-identical menus in five of six sections, because nothing was
deciding what a mode should *be*.

## Shape

```
Placement:  lead · primary · secondary · collapsed · overflow · advanced
```

`overflow` and `advanced` are placements, **not deletions**. A composition may not remove a
destination, change a number or gate a feature.

Each surface declares, per mode: an `objective` in one sentence, `moduleOrder`, `modulePlacement`,
`primaryActions`, `overflowActions`, and where relevant `primaryTabs`, `visibleColumns`,
`formProfile` and `copilotProfile`.

Sixteen surfaces: navigation · home · overview · markets · research · screener · asset-hub ·
chart · money · learn · academy · community · practice · expert-marketplace · copilot ·
whats-new.

## The invariant, enforced by construction

A composition is **normalised** before it is handed out: any module another mode declares but this
one forgot is appended at `overflow`. That makes "nothing disappears between modes" true because
of how `get()` works, not because every author remembered to list every module three times —
which is exactly the discipline the old per-page conditionals failed at.

`everyModuleReachable(surface)` checks it, and the suite runs that check over all sixteen.

## Example — home

The same six modules in all three modes; only the placement differs.

| module | Simple | Standard | Professional |
|---|---|---|---|
| tasks | **lead** | primary | collapsed |
| continue | overflow | **lead** | primary |
| desk | overflow | overflow | **lead** |
| brief | secondary | primary | primary |
| flagship | primary | secondary | collapsed |
| journey | collapsed | secondary | overflow |

Objectives:

```
Simple        Help the visitor pick the first useful thing to do.
Standard      Continue yesterday’s work.
Professional  Open a tool, or resume the workspace.
```

Writing different module lists per mode would have been the old bug in a new file: a module that
exists in one composition and simply is not mentioned in another.
