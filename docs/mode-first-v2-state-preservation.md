# Mode-first v2 — state preservation

The riskiest part of this release is not the menu. It is that switching mode now **moves DOM**,
and a move can quietly take focus, a half-typed field, an active tab or a scroll position with it.
None of that shows up in a screenshot.

## Three rules

**Move, never clone.** A cloned module loses its listeners, its canvas, its scroll position and
any reference a page controller is holding. `appendChild` on an existing node relocates it; that
is the whole trick.

**Never `display:none` a module to reposition it.** Twice in one week a `hidden` attribute lost to
an author `display` rule and something stayed on screen that the code believed was gone. Placement
is expressed by where a node *is*, not by a property fighting a stylesheet.

**Capture before, restore after.** Read focus, selection range, field values and scroll before the
first move; reapply after the last. A mode switch in the middle of typing must not eat the
sentence.

## What is captured

```js
{
  focus:  { id, name, value, selectionStart, selectionEnd, findable },
  fields: [ { key, value, checkbox } ],   // every named input, not only the focused one
  scrollY,
  own                                     // whatever the surface's adapter returns
}
```

`findable` is `false` when an element has neither an id nor a name. That is reported rather than
guessed at: restoring focus to *a* field is worse than restoring it to none.

Field values are captured for every named input, not only the focused one, because a reflow that
moves a fieldset between placements must not empty it.

## Selector escaping

`CSS.escape` is absent from jsdom and from older browsers, so the escaping is local. This matters
more than it looks: a lookup that throws would silently skip the restore, and a restore that
silently does nothing is precisely how a mode switch eats a half-typed sentence.

## Adapters

```js
ModeOrchestrator.registerStateAdapter('screener', {
  capture() { return { filters, sort, selected }; },
  reflow(composition) { /* re-render columns for the new mode */ },
  restore(own, composition) { /* put filters, sort and selection back */ }
});
```

Required for: Home · Screener · Asset Hub · Chart · Money · Academy · Expert Marketplace ·
Copilot. Home is wired in P0; the remaining seven land with their surfaces in P1, and until then
`apply()` is a no-op on those pages — a page that has not declared `data-module-id` containers
simply gets its composition object and nothing moves.

## Opting in

A page opts in by declaring stable ids:

```html
<div data-placement="lead"></div>
<section data-module-id="totals">…</section>
```

That is what makes this land page by page instead of in one release where nothing is as it was.

## What is not preserved, and why

Scroll is restored to the same pixel offset, not to the same element. After a recomposition the
same offset can be a different place on the page. Anchoring to the lead module is a P1 item and is
listed in the backlog rather than implied here.
