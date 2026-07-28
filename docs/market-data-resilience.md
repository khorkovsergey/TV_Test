# Market data resilience

## The bug that started this

`src/market.js` had a comment on `snapshot()` promising that a total provider failure would keep
serving the previous snapshot, flagged stale — *"old-but-labelled beats empty"*. The code did the
opposite:

```js
async function refresh() {
  const items = await fetchAll(UNIVERSE);   // every failure becomes { ok: false }
  cache = { at: Date.now(), items };        // …and overwrites the last good data
  return cache;
}
```

`fetchAll` catches per-symbol errors and returns `{ok:false}` rows, so `refresh()` never threw, so
the `catch` in `snapshot()` that was supposed to preserve the cache never ran. A provider outage
replaced 49 good quotes with 49 failures, and the whole portal went to "no data" until the provider
came back — for as long as that took.

It was invisible in normal operation because the provider rarely fails all at once. That is what
makes it worth writing down: the comment, the intent and the test-by-eye all agreed, and the code
still did the other thing.

## What it does now

```js
const okCount = items.filter(i => i.ok).length;
const ratio   = okCount / items.length;

if (okCount === 0)                              throw MarketDataUnavailableError   // keep the cache
if (cache && ratio < MIN_REFRESH_SUCCESS_RATIO) throw MarketDataUnavailableError   // keep the cache

cache = { at, items: mergeWithPrevious(cache?.items, items), quality: { ok, total, ratio } };
```

`MIN_REFRESH_SUCCESS_RATIO` is 0.5: a round that loses more than half the universe is treated as a
provider problem rather than as news about the market.

**Per-symbol merge.** A symbol that failed this round keeps its last known value and is marked
`retained: true`, with the error that caused it and the timestamp it came from. One flaky ticker no
longer produces a dash where a price was.

**Retention is visible.** `snapshot()` reports `quality` (`{ok, total, ratio}`), `retained_count`
and the list of retained symbols alongside `failed`. A page can say "three of these are a minute
older" instead of quietly mixing fresh and stale numbers — which is the trap the fix could easily
have created.

## Behaviour table

| Round | Cache before | Result |
|---|---|---|
| 100% success | anything | replaced |
| 80% success | present | replaced, the failed 20% retained from the previous snapshot and labelled |
| 40% success | present | **rejected** — previous snapshot kept, served with its real age |
| 0% success | present | **rejected** — previous snapshot kept |
| 0% success | empty (cold start) | `MarketDataUnavailableError` reaches the caller; the page shows the honest unavailable state, never a sample dressed as live |

## Still true, still deliberate

- One request per instrument for 49 instruments, 60-second TTL, bounded concurrency of 16, 6-second
  per-symbol timeout, warm-up at boot. Fine for a stand; a public product needs a supported vendor,
  and that is stated rather than pretended away.
- The client keeps a 3-second budget race so no page sits on "Loading…", and falls back to a bundled
  sample that is labelled `SAMPLE · NOT LIVE` in the interface, never silently.
- Quotes are delayed. Every surface that prints one says so.

## What is not done

- `MKT-002` — the browser does not yet reject a 200 response that contains zero valid quotes; it
  relies on `ok_count` being read by each caller. A single guard in `quotes.js` is the right place
  and is on the backlog.
- Per-instrument `quotedAt` distinct from the cache timestamp: the snapshot carries one `asOf`, and
  retained rows carry `retained_at`. Full per-quote timestamps need vendor support this endpoint
  does not give.
