# Test strategy

## The problem this fixes first

The documentation claimed 970 passing checks. The checks existed and passed — in a scratch directory
outside the repository. For anyone who cloned the repo or opened the ZIP, they did not exist, and a
claim you cannot reproduce is worse than no claim. The suites now live in `tests/` and run with
`npm test`.

## Shape

```
tests/
  run.cjs              starts the server once, runs every suite, exits non-zero on failure
  check-syntax.cjs     every server module, browser module and inline <script>
  check-copy.cjs       banned spellings and unverifiable claims
  browser/
    rel-test.cjs         160  architecture, six sections, routes, navigation
    mode-test.cjs        197  Simple/Standard/Professional: policy, migration, state, differences
    fix-test.cjs         122  fixes from the earlier fix-prompts
    phase3-test.cjs      118  strategic features: registry, surfaces, honesty
    money-test.cjs        95  My Budget: arithmetic, ladder, the fitness-trainer scenario
    chart-test.cjs        90  candles, selection, chart context, sources, chart actions
    modes-v2-test.cjs    114  three compositions: policy, navigation, home, orchestrator, registers
    home-test.cjs        101  task home, A/B control, funnel
    v2-test.cjs           87
    data-test.cjs         80  live market layer, degradation, honest failure
    progressive-test.cjs  71
    bg-test.cjs           52  background imagery and weight
    academy-regress.cjs   37
```

## Why browser suites against a real server

No build step, no framework, no type system — a unit test of a function nobody calls would prove
nothing here, and `tsc` has nothing to check. What can go wrong on this stand is what a visitor
sees: a tab that activates nothing, a mode that changes only padding, a claim the code contradicts,
a menu that quietly drops forty destinations.

So each suite boots `src/server.js` on a test port, fetches a real route, evaluates every script the
browser would evaluate (jsdom, `runScripts: 'outside-only'` plus manual eval, with `fetch` and both
storages injected), and asserts on the resulting DOM. Slow — a full run is several minutes — and
it catches the class of defect that actually occurs.

The three deliberate consequences:

- **Real data.** Suites hit the live quote endpoint. A provider outage can fail a suite; that is
  correct, because it also fails the product.
- **No mocks to drift.** Nothing can pass against a fixture that no longer resembles the server.
- **One server for all suites.** Booting per suite would triple the run and prove nothing extra.

## Commands

```
npm run check         syntax + copy      — seconds, run on every change
npm test              all browser suites — minutes
npm test -- mode rel  a subset by name
npm run check:all     everything
```

`npm run check` used to be four `node --check` calls covering four server files. It missed
`market.js`, `copilot.js`, every `public/*.js` and every inline block — which is where most of the
code lives. `check:syntax` now parses 47 files and inline blocks; JSON-LD blocks are skipped rather
than parsed as JavaScript.

## What the copy gate enforces

Misspellings that keep returning (`Standart`, `Marketpalce`, `Experts Marketplace`, `Beginner
mode`), and any user-facing verification claim about advisers that is not immediately denied in the
same sentence. The second one exists because the false claim it now blocks was live on the stand.

## What is not covered, and what would cover it

| Gap | What it needs |
|---|---|
| API-level auth tests (staff 401/503, request ownership, booking conflict) | Supertest against `app`, without a browser — the highest-value addition |
| Visual regression at 1180 / 1024 / 820 / 430 | Playwright screenshots; would have caught CSS-001 years earlier than reading the file did |
| Accessibility assertions | axe-core in the existing jsdom harness |
| Link and fragment resolution | a crawl over `ia.js` asserting every `#fragment` has a target |
| CI | GitHub Actions running `check:all` on push |

Named as absent rather than implied as present — which is the whole point of this document.
