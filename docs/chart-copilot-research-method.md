# How the Chart Copilot answers "why did it move"

The hard part of this feature is not showing news next to a chart. It is not answering the wrong
question confidently.

## The failure this is built against

Ask a general assistant "why did NVDA fall 5%?" and it will answer about the most recent fall it
knows of, using today's date, in language that reads like a cause. If the visitor was pointing at
27 July and the assistant answered about the latest session, nothing on screen says so — the
answer is fluent, dated-sounding and wrong.

Three mechanisms exist to stop that.

## 1. The selected session is the temporal context

The system prompt says, in the stable cached block:

> Treat the selected candle time as the primary temporal context. Do not answer about the latest
> trading day unless the user asks for it.

The per-request block then carries the session, its OHLC, the change against the previous close,
the volume and the volume ratio — and one line that exists because of a specific, plausible
mistake:

> The live quote below is TODAY and is NOT the selected session. Do not quote it as the price on
> the selected date.

The live quote is still supplied, because a question can legitimately be about both. Without that
sentence, two dated prices sit adjacent in the prompt with nothing telling them apart.

## 2. The search window comes from the selection

| Selection | Window searched |
|---|---|
| Daily candle | Previous close → next session, plus ±24 hours around the session |
| Intraday candle | ±2 hours, plus pre-market and post-market |
| Range | Inside it, plus the day before it starts |
| None | No window — the model is told to ask which day is meant |

Never "today", unless today is what was selected.

## 3. Causation is separated from coincidence

The prompt forbids the shape of sentence that does the damage:

> Correlation with the selected candle does not prove causation. Say "the most likely factor was
> X, while the sector fell Y" rather than "the shares fell because of X" when all you have is
> timing.

And it closes the escape hatch that makes a groundless answer sound complete:

> Do not use "technical" or "profit-taking" as a convenient explanation when no news cause was
> found. If you did not find a credible catalyst, say so.

"Technical / profit-taking" is what an explanation engine reaches for when it has nothing. It is
unfalsifiable, always available, and it reads as an answer. `report_move_factors` accepts
`technical` as a category because sometimes it is true — the prompt is what stops it being a
default.

## Factors

The model calls `report_move_factors` after searching. Each factor is one of `company`,
`earnings`, `regulation`, `sector`, `market`, `macro`, `technical`, `flow`, with a relevance and
an optional confidence. They are rendered beside the answer, sorted high → low.

They are pulled out of the same tool call the buttons come from, not re-derived by a second pass,
so what the panel shows is exactly what the model classified.

## Sources

Reduced to hostnames before this change: `sources: reuters.com · bloomberg.com`. Nothing
clickable, nothing dated, and two different Reuters pieces collapsed into one.

Now each source carries a title, a canonical URL, the domain, the publication time where the
source gives one, a type and — the field that matters most — a **relation** to the selected
session:

```
before-session    published before it opened
during-session    published while it was trading, or within a day of it
after-session     within a week after
retrospective     later than that: somebody looking back
```

A wire story filed during the session and an explainer written a month later are different kinds
of evidence for the same claim. Presenting them as equals is exactly how a retrospective narrative
turns into "the cause". The source card says which it is.

Deduping is by canonical URL with tracking parameters stripped, not by host. Regulatory and
company material sorts above secondary analysis: the filing outranks the article about the filing.

## When there is nothing

The honest answer is a specified string, not an improvised one:

> I did not find a credible company-specific catalyst in the selected window. The move may have
> been related to broader market, sector or trading-flow factors, but the available sources do not
> support a single definitive cause.

And `AI · SOURCED` is not printed over an empty source list — a turn with no citations is labelled
`AI · MODEL KNOWLEDGE`.

## What is still true of this stand

The Copilot genuinely searches; the citations are real. It is still a language model reading news
under time pressure, its confidence is not calibrated, and it does not give investment advice.
`stripAdvice()` remains as a second line of defence for phrasing that slips through the prompt.
