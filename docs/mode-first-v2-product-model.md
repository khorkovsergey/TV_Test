# Mode-first v2 — product model

## The rule

> Simplify the path to the product, not the product.

TradingView's value is its depth. A mode that removes depth removes the reason to be here. A mode
that only changes row height is a preference, not a product decision. What a mode decides is
**hierarchy**: what leads, what follows, what folds.

## Three modes, one platform

```
Simple        leads         the full product, with a guided hierarchy and plain language
Standard      completes     the everyday platform — the compatibility baseline
Professional  accelerates   speed, density, direct routes to tools
```

Internal ids are unchanged: `simple | standard | pro`. Only the word a person reads became
`Professional`, with `shortLabel: 'Pro'` for a narrow switcher. Stored preferences, `data-min`
attributes and three migrations all still say `pro`, which is why nothing had to be migrated.

## What a mode may change

Which sections lead the menu · what Home opens with · module order and the lead module · density ·
which panels, tabs and columns open unasked · explanation depth · form layout · the Copilot's
register · how many actions lead before "More" · the default community feed.

## What a mode may never change

The plan, permissions or market-data entitlement · the prices themselves · saved work · routes ·
feature maturity · the availability of any destination.

The old switcher promised "the six sections and every route". Mode-specific navigation makes the
first half false — Professional leads with Screeners and Charts — so the promise was rewritten to
the part that is still true and still matters:

> every route and every destination — what moves is the order, never the access

## Who each mode is for

**Somebody new.** Needs to understand what the platform is for, see a handful of comprehensible
actions, have terms explained, and learn on real objects. Simple leads with My Money and Learn
because both can be acted on today without a market opinion.

**Somebody with capital but no market experience.** Starts from their own financial situation,
then liquidity and goals, then instrument classes. My Money → Academy → Practice → research.
Simple or Standard.

**A current TradingView user.** Must not lose anything. Standard is byte-for-byte the menu and
the routes that shipped yesterday, and the release exists partly to guarantee that in a test
rather than in a promise.

**A professional.** Types a ticker, opens a chart, opens a screener, resumes a workspace, and does
not read introductions. Professional puts Screeners and Charts one click away instead of one click
plus a panel.

## Why Professional was not a mode before

Measured before the change: five of six navigation panels were byte-identical to Standard, and the
home page was the same nine cards plus one strip. Professional was Standard with a decoration.

The cause was structural, not lazy: every page decided the mode for itself, so nobody was deciding
what a mode *was*. `mode-surfaces.js` is that decision, made once.

## Defaults

A genuinely new visitor gets Simple, with one unobtrusive line and no blocking modal. A stored
preference always wins. A visitor with saved work and no preference is never switched
automatically — the offer is made once, and "Don't ask again" is one of the answers.

Deep links open directly. `/charts?symbol=NVDA` does not show onboarding and does not change the
global mode; in Simple it offers the advanced tools for that page instead.
