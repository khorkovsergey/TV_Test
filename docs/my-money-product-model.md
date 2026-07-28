# My Budget — the product model

**Strategic name:** Personal Wealth Hub. **User-facing name:** My Budget. Both appear on the page;
the first is what the case argues for, the second is what a visitor understands.

## The problem with what was there

The old hub opened with:

> **What is invested in markets right now?** Stocks & ETFs · Crypto · Bonds · Other market assets

For the person this product is actually for, that first screen is a closed door. It assumes someone
who already has a portfolio, already thinks in asset classes, and is ready to discuss concentration.

The case describes a different person: a self-employed fitness trainer who writes client payments
in a notebook, has no brokerage account, earns a different amount every week, and does not know
what a month costs them. Everything after that first question was well built and irrelevant to
them.

## What it does now

```
Record money  →  understand cash flow  →  stability  →  goals
              →  learn about instruments  →  Paper Trading  →  markets, by choice
```

Nothing in that chain is skippable and nothing is pushed. The market appears when the stage before
it is complete, not because a card was free on the page.

### The five questions the screen answers

What came in · what went out · what is left · what am I saving for · what should I do next.

That is the whole dashboard. Anything that does not answer one of those is not on it.

## Decisions worth stating

**Transfers are excluded from income and expenses.** Moving your own money between accounts is
neither. Counting it as either is the classic way a budget app tells somebody they earned twice
what they did.

**Insufficient data returns `null`, never `0`.** A savings rate of "0%" for somebody with no
recorded income is a false statement, not a neutral one. The interface says there is not enough to
compute from.

**Goal projection uses the monthly contribution.** The old model computed
`coverage = total capital / target`, which told a person with a large deposit that a goal was
already met while they were saving nothing towards it. Now: remaining, months at the current
contribution, projected date, and — if a target date exists — the contribution the date actually
requires.

**Assumed return defaults to 0%.** Any growth assumption is chosen deliberately and labelled as an
assumption everywhere it appears.

**The emergency fund is reported in months covered, with no universal norm.** "You need six months"
is advice this prototype is not entitled to give. It states the number and lets the person choose
their target.

**Cash is never called idle.** Without knowing the essential monthly spend, the reserve, the debts
and the upcoming obligations, "this money is not working" is not a fact — it is pressure.

**Categories are grouped by what money does**: essential, flexible, saving. That is the distinction
that makes a cash-flow observation honest — an essential expense cannot be cut, a flexible one is
where a decision is possible.

**Negative cash flow leads to spending, not to a reserve.** Telling somebody whose month ends
negative to "create an emergency fund" is advice they cannot act on.

## The financial progress ladder

```
record → understand → stabilise → save → learn → practice → invest → advanced
```

| Stage | Reached when | Next step offered |
|---|---|---|
| record | nothing recorded | add a first income or expense |
| understand | data exists but the month is negative | see what is essential and what is flexible |
| stabilise | positive month, no reserve | create a reserve goal |
| save | reserve exists, no other goal | set a goal and a monthly amount |
| learn | goals exist and there is a real surplus | learn what cash, deposits, bonds and ETFs are |
| practice | investing basics done | try Paper Trading |
| invest | practice done | compare instruments before deciding anything |
| advanced | investing started | the full research workspace |

The four early stages never route to the Screener or a chart — asserted by test.

## Onboarding

> **What would be most useful right now?**
> Track income and spending · Understand where my money goes · Save for a goal ·
> Build a financial buffer · Organise savings and deposits · Review my investments

No risk-tolerance question until an investing path is chosen. No market-asset question at all on
the first step. Choosing a path opens the useful action immediately — the 60-to-90-second promise.

## Data

One versioned key, `money_store_v1`. Not five loose keys: the portal already had `saved_screens`
written by one page and `screener_saved` read by another, and that class of bug is not acceptable
for data a person cares about.

Everything stays in the browser. Export as JSON or CSV, delete everything, and load a sample week —
the trainer's week — only by pressing the button. Nothing is inserted silently.

The old `wealth_profile` and `wealth_scenarios` migrate on request, with a preview of what will be
created, and the old keys are not deleted.

## What it is not

Not a bank app, not bookkeeping, not another financial terminal. No transaction sync, no
categorisation model, no credit scoring, no advice. The full data model and the calculations are in
[`personal-finance-data-model.md`](personal-finance-data-model.md); what remains unbuilt is in
[`phase-5-remaining-backlog.md`](phase-5-remaining-backlog.md).
