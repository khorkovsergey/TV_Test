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

**State adapters: eight of eight** — closed. Asset Hub, Academy, Expert Marketplace and Copilot
were added in the closing P1 slice. The suite now counts registrations per surface, which is how
it caught the chart registering its adapter three times: two copies had been pasted inside the
interval and range click handlers and re-registered on every toolbar press.

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

**My Budget has three compositions (GAP-09), and a net-worth module that exists.** `deep.netWorth`
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


- Asset Hub reads the matrix (§17 closed). The row is composed by `ModeSurfaces`: Simple leads
  with five tabs, Professional leads with the chart and folds nothing. The `min` levels survive as
  the no-matrix fallback, and the overflow is computed as "everything not led with" so a tab the
  matrix forgets stays reachable.

- Academy (GAP-10 closed) — and it was hiding lessons. The comment promised "six lessons in every
  mode" while the code rendered three, four and five *different* ones, so a Simple learner could
  not see that the Pine Script lesson existed at all. All twelve are present in every mode now,
  with the ones a mode does not lead with named under the row.
- The register changes the answer, but no page yet renders it differently — the panel shows the
  same layout for all three. That is presentation, and it is P1 work that is not done.

**The shared form system exists** (`public/forms/{form-policy,form-renderer}.js`, `form.css`) and
consumes `formProfile`: wizard steps one field at a time, grouped folds the advanced block, dense
puts labels inline. Applying a profile MOVES fields between containers rather than re-rendering
them, so a value being typed survives a mode switch — the state invariant in §27 is the reason the
renderer exists at all.

**Three pages use it now** — closed. The Expert Marketplace intake, My Budget's Quick Add and the
Screener's filters. In each case the existing markup was annotated rather than re-authored, and
the two consents stay outside the form: never folded, never stepped past, never preselected.

The Screener had grown its own `<details>` doing exactly what the advanced fold does; there is one
disclosure now instead of two.

Stepping became refusable, because a screener's filters and a Quick Add dialog are control panels
rather than intakes — they are compared against each other while being set, and one-at-a-time
would hide the comparison. `data-ff-stepped="false"` refuses the stepping and leaves density and
folding to the mode. It sits in the markup rather than as a profile hardcoded in two pages.

## P2

Money subviews behind `/money/*` · advanced Professional workspaces · richer mobile mode
behaviour · contextual mode recommendations · saved chart research reader · Academy chart-Copilot
lesson · persistent chart markers · analytics dashboards.

## Tests from §32 not yet written

§32 lists 112 checks; the suite now runs 151, of which the §32 set covers Markets columns,
Screener composition, Asset Hub tabs, My Budget's three compositions and the form profiles. Still
missing: the chart's mode compositions (62–67), Learn (78–82), Community/Practice (83–91), the
Copilot's register rendered in a real answer (95–99), and the responsive/accessibility set
(107–112).

The original count, for the record: 68 existed when this file first said so. The missing ones are the ones that need P1 surfaces to test
against: Markets columns (34–38), Research and Screener composition (39–46), Asset Hub tabs
(47–53), the chart's mode compositions (62–67), My Budget's three compositions (71–77), Learn
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
