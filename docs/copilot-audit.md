# Research Copilot — audit and rework

Written after a report that the panel was full of noise: a concrete question was asked, and the
answer area competed with an introduction, three other questions, and two promo cards.

## The root cause

`.cp-body` was a single scrolling container, and the introduction and the suggestion buttons sat in
it **as ordinary elements, before the messages**:

```html
<div class="cp-body">
  <div class="cp-note">I can explain moves, compare instruments…</div>   <!-- stayed forever -->
  <div class="cp-suggests"></div>                                        <!-- stayed forever -->
</div>
```

A question was appended with `body.appendChild(userMsg)` — **below** them. Nothing removed them.

This is not a styling detail. At the moment a person has their own question, the panel was still
advertising three other people's.

## Seven sources of noise, and what each became

| # | Was | Now |
|---|---|---|
| 1 | Intro paragraph, permanent | In `.cp-empty`, removed at the first question, restored by *New* |
| 2 | Three suggestion buttons, permanent | Same block, same rule |
| 3 | Two promo cards with four badges pinned to the bottom, ~15% of the panel height, visible mid-answer | Collapses to one line — *Need a person instead? →* — expandable |
| 4 | `PRO` chip | Removed. An internal mode token on a surface a visitor reads |
| 5 | `BTCUSD` and `1D` chips on the home page | Removed there. No chart exists on `/`; those were defaults displayed as facts |
| 6 | Four chrome layers before the first line of dialogue | Chips reduced to what is genuinely in context |
| 7 | Bilingual panel on a non-English question | **Not addressed** — out of scope by agreement |

## Three behaviours that mattered more than the layout

### Streaming

The server assembled the whole answer and returned it at once, while the model may run up to four
web searches (`web_search_20260209`, `max_uses: 4`). That is ten to thirty seconds of a motionless
"thinking …".

`ask()` now streams **always**. There is no second streaming function: `onEvent` is an optional
listener, so a caller that passes nothing gets exactly the old return value — which is why the
existing `/api/copilot` endpoint did not have to change. The SDK's own guidance is to stream
anything with a high `max_tokens` regardless, to stay under the HTTP timeout.

`POST /api/copilot/stream` emits SSE. Phases are **named**:

```
searching the web → reading what it found → writing
```

"Searching the web" and "stuck" look identical when the only signal is a row of dots.

**The fallback is the point.** SSE cannot be read with `EventSource` here — that is GET-only and the
question is a POST body — so the stream is read off `fetch`. If anything in that path fails (an old
browser, a buffering proxy, a dropped connection) the same request is retried against the
unchanged non-streaming endpoint. The visitor gets a slower answer, not an error. Both paths are
tested.

### The input was disabled while answering

`setBusy(true)` set `input.disabled = true`. A person could not draft their next question or fix a
typo during the one moment they have nothing else to do. The **send button** is blocked now; the
field is not.

### There was no way to start over

`startNewThread()` existed and was reachable only from the chart's context-change block. A **✚ New**
button now sits in the header and appears with the first question.

## What was verified, and how

| | |
|---|---|
| SSE frames | correct `event:` / `data:` framing, checked against a live server |
| No model key | honest `failed` event, not a hang |
| End to end | status → text deltas → assembled answer, rendered |
| Fallback | exercised by the absence of `TextDecoder` in jsdom (see below) |
| Empty state | present before, gone after, restored by *New* |
| Chips | exactly one on `/`: `PORTAL HOME` |

**jsdom has no `TextDecoder`.** Every browser does, so production streams. Without it the widget
falls back silently and correctly — which is how the fallback path came to be exercised before it
was ever needed in anger. The test supplies `TextDecoder` explicitly so that it checks the *stream*
rather than the fallback, and says so in a comment.

## §SSE-001 — the streaming was broken, and production said so

The first deploy returned a single `done` frame and nothing before it. HTTP 200, a correct answer,
no errors in the log — and the stream behaving exactly like the endpoint it was built to replace.

The disconnect guard listened on the **request**:

```js
req.on('close', () => { gone = true; });   // wrong
```

In Node a request stream emits `close` once its **body has been read**, not when the client
disconnects. The flag flipped a millisecond after the POST arrived, every status and delta event was
dropped by `if (!gone)`, and only the final `done` — which does not pass through that guard — ever
reached the browser.

Fixed to `res.on('close')`.

**The tests could not have caught this.** The client-side check stubs `fetch` and replays a
pre-built SSE body; it never touches a real socket. The only way to see it was to call the live
endpoint and look at whether any frame arrives *before* `done`. The check added now asserts the
guard's target inside the endpoint block, rather than searching the whole file — a `req.on('close')`
elsewhere in `server.js` is legitimate and must not fail it.

## One existing check was rewritten

`56b. вне графика чипы прежние` asserted "at least three chips" off the chart. That assertion *was*
the defect: `BTCUSD`, `1D` and `PRO` — two defaults and an internal token — presented as context. It
now asserts truthfulness rather than count.

## Not done

Interface language does not follow the language of the conversation. A question in Russian gets a
Russian answer (the system prompt requires it) while the suggestions, tags, action labels and promo
stay English. Agreed as out of scope; it is the most expensive of the seven and the least useful
for the case study.
