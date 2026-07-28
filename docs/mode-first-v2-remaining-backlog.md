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

**State adapters: four of eight.** Home, Chart, Money and Screener register one. Asset Hub,
Academy, Expert Marketplace and Copilot do not.

**`/money/*` is a real router now (§19.4).** Eight addresses, one page, one store: the route
decides which module leads and folds the rest, and `investing` and `scenarios` — which have no
module — say `PROTOTYPE` rather than rendering the dashboard as if they were built.

An earlier version of this file said "only Home is registered". That was wrong: at the time
`registerStateAdapter` was called by nobody at all — the method existed, the suite checked that
the *function* existed, and no page used it. Corrected here rather than quietly fixed.

**Scroll anchoring.** Restored to the same pixel offset, not to the same element. After a
recomposition that offset can be a different place on the page.

## P1 — delivered so far

**The Copilot register (GAP-11) is real.** `copilotProfile` was declared and unused; the mode
changed only how many prompts the widget offered. `src/copilot.js` now carries three registers —
teacher, researcher, analyst — that decide the shape of the answer: its length, whether terms are
defined, how the factors are grouped, how many actions follow. What they never change is stated
in the prompt itself: the sources, the facts, the disclaimers, the causal guardrails, the consent
rules. The action cap is the register's number (3/5/8) on both sides instead of a constant 5 on
the server and 4 in the widget.

**The chart's second global switcher is gone (GAP-12).** `#modePill` was a full three-button mode
control sitting beside the header switcher — two equal controls read as two settings. The page now
says `View follows: Standard` and keeps only what is genuinely page-local: the Advanced-tools
drawer, which still does not touch the global mode, and "Make it my default".

**`Hub.modules()` accepts a composition (GAP-07).** It used to bucket by complexity and preserve
source order, so every section was the same card ribbon with a different number of blocks open.
A page that names its `surface` and gives its modules an `id` now gets order and placement from
the matrix, including a real lead module rendered on its own. A page that does not is unchanged —
which is how this lands one page at a time.

**`/research` is the first consumer.** Simple leads with Fundamentals; Professional leads with the
options desk and opens correlation and seasonality. Before this the page was the same ribbon in
all three modes.

**Markets reads the column policy (§14) — and a real defect came out of it.** The header was
filtered by mode and the body was not: in Simple the table declared five columns while every row
emitted ten, so from the third column on every value sat under the wrong heading. It survived
because Professional, where the two happen to agree, is the mode a developer works in. Header and
cells are now built from the same list, and Simple gains a `Why` column — one link per row into
the page that explains the drivers.

**My Money has three compositions (GAP-09), and a net-worth module that exists.** `deep.netWorth`
was declared and never used, and the model had been computing net worth all along with nothing
showing it. There is now a module: what you own, what you owe, the difference, and a line saying
it describes what you entered rather than valuing anything. Simple opens with the month,
Professional opens with net worth. Order and folding come from the matrix; nothing is removed.

## P1 — the remaining surfaces

The matrix declares compositions for sixteen surfaces. **One page reads its own** — `/research`.
The rest still compose themselves the way they did before, which means:

- `hub.js` composition is now read by `/research`, `/overview`, `/learn`, `/community` and
  `/trade`. `/capital` (legacy) still calls it the old way, deliberately: it is compatibility
  material and gets no new behaviour.


- Asset Hub still has one tab policy (§17 open).

- Academy still adds a class and folds `[data-advanced]` (GAP-10 open).
- The register changes the answer, but no page yet renders it differently — the panel shows the
  same layout for all three. That is presentation, and it is P1 work that is not done.

**The shared form system exists** (`public/forms/{form-policy,form-renderer}.js`, `form.css`) and
consumes `formProfile`: wizard steps one field at a time, grouped folds the advanced block, dense
puts labels inline. Applying a profile MOVES fields between containers rather than re-rendering
them, so a value being typed survives a mode switch — the state invariant in §27 is the reason the
renderer exists at all.

What is not done: only the Screener declares its profile on `body`. My Money's Quick Add and the
Expert Marketplace intake still build their own markup and do not go through the renderer.

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
