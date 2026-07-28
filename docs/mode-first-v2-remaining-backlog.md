# Mode-first v2 — remaining backlog

P0 is delivered. This is what §33 asks for that is **not** built, stated plainly.

## P0 items completed

Source audit · visible `Professional` with `shortLabel: 'Pro'` · four profiles in `modes.js` ·
`mode-surfaces.js` (16 surfaces × 3 compositions, normalised so nothing can disappear) ·
`mode-orchestrator.js` (move-not-clone reflow, focus and field capture) · mode navigation profiles
with runtime rebuild and `More` · panel priority that promotes across the split · three real Home
compositions · Home state adapter · 68-check suite · four suites rewritten where they encoded the
old model.

## P0 items not completed

**State adapters for the other seven surfaces.** Only Home is registered. Screener, Asset Hub,
Chart, Money, Academy, Expert Marketplace and Copilot get their composition object, and `apply()`
is a deliberate no-op on pages that have not declared `data-module-id` containers. Nothing is
broken by this — but §29.2 asks for eight adapters and there is one.

**Scroll anchoring.** Restored to the same pixel offset, not to the same element. After a
recomposition that offset can be a different place on the page.

## P1 — the surfaces

The matrix declares compositions for Overview, Markets, Research, Screener, Asset Hub, Money,
Learn, Academy, Community, Practice, Expert Marketplace and Copilot. **None of those pages reads
them yet.** They still compose themselves the way they did before, which means:

- `hub.js` still buckets by complexity and preserves source order (GAP-07 open).
- Markets still shows the same columns in all three modes (§14 open).
- Screener still has one form layout (§16, §27 open).
- Asset Hub still has one tab policy (§17 open).
- My Money still folds two cards rather than recomposing (GAP-09 open).
- Academy still adds a class and folds `[data-advanced]` (GAP-10 open).
- The Copilot's `copilotProfile` is declared and read by the orchestrator but not yet used by
  `public/copilot.js` or `src/copilot.js` to change the answer's register (GAP-11 open).
- The chart still carries `#modePill` beside the header switcher (GAP-12 open).

**The shared form system** (`public/forms/`) does not exist. `formProfile` is declared per mode
and per surface and nothing consumes it.

## P2

Money subviews behind `/money/*` · advanced Professional workspaces · richer mobile mode
behaviour · contextual mode recommendations · saved chart research reader · Academy chart-Copilot
lesson · persistent chart markers · analytics dashboards.

## Tests from §32 not yet written

§32 lists 112 checks; 68 exist. The missing ones are the ones that need P1 surfaces to test
against: Markets columns (34–38), Research and Screener composition (39–46), Asset Hub tabs
(47–53), the chart's mode compositions (62–67), My Money's three compositions (71–77), Learn
(78–82), Community/Practice/Experts (83–91), the Copilot's register in a real answer (95–99), and
the responsive/accessibility set (107–112).

Writing them now against pages that have not been recomposed would mean asserting the current
shape and calling it a promise — which is the specific failure this release rewrote four suites
to undo.

## Carried over, unchanged

Mobile bottom navigation for the site as a whole. The permanent prototype strip. The six-column
footer. Thirteen dead fragment targets in `ia.js`. Six monolith pages still blocking a real CSP.

## Owner actions

`DATABASE_URL` still does not reach the Railway service. The stand is public and carries brand
assets it does not own.
