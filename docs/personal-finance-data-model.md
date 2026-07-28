# Personal finance — data model

Three files, one responsibility each:

```
public/money/model.js   pure functions — no DOM, no storage, no formatting
public/money/store.js   one versioned key, reads and writes, migration
public/money/page.js    the page controller
```

The split matters because the calculations are the part that can be wrong in a way nobody notices.
Every function in `model.js` is testable on its own and none can quietly depend on what happens to
be on screen.

## Entities

```ts
MoneyAccount   { id, name, type, currency, openingBalance, includedInNetWorth, archivedAt? }
               type: cash | bank | card | deposit | investment | property | business | debt | other

MoneyTransaction { id, type, accountId, transferAccountId?, amount, currency, date,
                   categoryId, note?, recurringRuleId?, createdAt, updatedAt }
               type: income | expense | transfer

BudgetCategory { id, name, group }
               group: income | essential | flexible | saving

RecurringRule  { id, type, name, amount, categoryId, frequency, nextDate, active }
MoneyGoal      { id, name, targetAmount, currentAmount, currency, targetDate?,
                 monthlyContribution, priority, type }
Liability      { id, name, balance, interestRate?, monthlyPayment?, dueDay? }
MoneyProfile   { onboardingPath, primaryCurrency, incomePattern, createdAt }
```

`group` on a category is the load-bearing field. Essential spending cannot be cut, flexible is
where a decision is possible, and saving is money that left the month but not the person. Without
that distinction any statement about cash flow is either useless or dishonest.

## Calculations

```
monthlyIncome(transactions, month)
monthlyExpenses(transactions, month)
monthlyCashFlow(transactions, month)          income − expenses
essentialExpenses / flexibleExpenses
savingsRate(transactions, month)              null when there is no income
averageMonthly(transactions, type, months)    over months WITH DATA, not the calendar
byCategory(transactions, month, type)
accountBalance / liquidAssets / netWorth
emergencyFundMonths(liquid, essentialMonthly) null when essential is unknown
debtPaymentShare(monthlyPayments, income)     null when income is unknown
goalProjection(goal, opts)
financialStage(state) / nextStep(state)
```

### Rules the functions enforce

**Transfers never count as income or expense.** Moving your own money between accounts is neither,
and counting it as either is how a budget app tells somebody they earned twice what they did.

**Insufficient data returns `null`, never `0`.** Zero is a measurement; null is the absence of one.
A savings rate of "0%" for somebody with no recorded income is a false statement.

**Nothing divides by zero.** Every ratio checks its denominator first and returns null instead.

**Averages skip empty months.** Irregular income is the normal case here — averaging a trainer's
good month over the calendar would report a decline that did not happen.

**No universal financial score.** There is no single number rating somebody's finances, because any
such number encodes assumptions the visitor did not choose.

**No implicit currency conversion.** Amounts carry their currency and nothing converts without a
rate and a timestamp.

### Goal projection

```
remaining        = max(0, target − current)
monthsNeeded     = ceil(remaining / monthlyContribution)         at 0% assumed return
                 = ln(1 + remaining·r / monthly) / ln(1 + r)     when a return is chosen
requiredMonthly  = remaining / monthsUntilTargetDate             when a target date exists
insufficient     = true when there is no monthly contribution
```

Default `assumedAnnualReturn` is **0**. The old model computed `coverage = total capital / target`,
which told somebody with a large deposit that a goal was met while they saved nothing towards it.

## Storage

One key: `money_store_v1`, with `schemaVersion`. Everything lives in the browser.

`store.js` owns every write and dispatches two events:

- `money-changed` — the page re-renders
- `money-action` — Academy steps complete from real actions rather than from a "mark as read"

### Migration

`wealth_profile` and `wealth_scenarios` are what the old asset-first hub wrote.
`legacyPreview()` shows what would be created; `importLegacy()` creates it only when the visitor
presses the button. Cash → a cash account, deposits → a deposit account, stocks/crypto/bonds →
investment accounts, the goal → a `MoneyGoal`, scenarios kept verbatim in `legacyScenarios`.

The old keys are not deleted. Nothing is inserted silently — the same rule that the home page broke
when it added BTC and TSLA to an empty watchlist and called it the visitor's choice.

## Export and delete

`exportJson()`, `exportCsv()`, `deleteAll()`, and `loadSample()` — the sample being one week of the
self-employed trainer from the case, added only on request and flagged `sample: true` on every row.
