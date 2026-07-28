# Security model

What this prototype protects, how, and — the part that matters more on a case-study stand — what it
deliberately does not.

## Threat model in one paragraph

The stand is public, carries brand assets it does not own, and collects a name, an email, a country,
a capital band and a free-text description of somebody's financial situation. The realistic threats
are: a stranger reading another person's enquiry, a stranger triggering paid model calls, a
misconfigured deployment exposing the staff screens, and the stand itself making claims a visitor
would act on. There is no authentication and no session for ordinary visitors, by design — nothing
of value should require an account.

## Staff area

`STAFF_TOKEN` guards `/api/requests` (list), `/api/bookings`, `/api/metrics` and the summary
endpoint.

- **Fails closed in production.** With no token configured, staff endpoints return 503. It used to
  be `if (!STAFF_TOKEN) return next()` — the absence of a secret treated as permission.
- **Not a startup crash.** Taking the whole portal down because one optional area is unconfigured is
  the failure mode `OPS-001` warns about. The staff endpoints refuse; everything else serves.
- **Header only.** `x-staff-token`. The query-string form is gone: a token in a URL ends up in
  browser history, proxy logs, referrer headers and screenshots.
- **Constant-time comparison**, and a generic `Unauthorised` that does not reveal whether a token is
  configured at all.
- **Session storage, not local storage**, on the staff and metrics pages — the credential dies with
  the tab, and any value an earlier build left in `localStorage` is deleted on load.

This is a shared secret, not authentication. A real deployment puts SSO here; that is stated rather
than implied.

## Request ownership

The identifier and the credential are separate objects.

```
id           req_<full uuid>       identifies the record
access token 256 bits, shown once  proves you created it
stored       sha256(token) only    a database read does not grant access
```

`GET /api/requests/:id`, `POST /api/requests/:id/match` and `POST /api/bookings` all require the
token in `Authorization: Bearer …` or `X-Request-Token`. A wrong or missing token returns **404,
not 403** — confirming that an id exists is itself a small leak. The client keeps the token in
`sessionStorage`: it should outlive a page navigation and nothing more.

## Consent

Two purposes, two answers, neither preselected:

- **AI processing** — a model reads the text, structures it into a brief and ranks consultants
  against it.
- **Consultant sharing** — the structured brief goes to the person you choose.

Recorded with a version (`2026-07-consent-v2`) and a timestamp, so a change to the wording is
distinguishable from a change of mind.

## Errors

In production the client gets `{"error": "The request could not be completed", "error_id": "err_…"}`
and the full error goes to the log under that id. Previously the message was returned verbatim —
SQL, provider wording and all. Known operational errors keep their specific, safe messages: a model
refusal is 422, a missing key is 503, a taken slot is 409.

## Rate limits

Three classes, keyed on `req.ip` with `trust proxy` set so Railway's forwarded address is the real
client:

| Class | Limit | Endpoints |
|---|---|---|
| `ai` | 20/min | Copilot, matching |
| `write` | 12/min | request creation |
| `booking` | 6/min | bookings |

Eviction is per key and by age. The old limiter cleared the entire map at 5,000 keys, which made
filling it a way to reset everyone's counter. In-process and therefore per-instance — correct for
one container, and named as a limitation rather than presented as a distributed limiter.

## Headers

`X-Content-Type-Options: nosniff` · `X-Frame-Options: DENY` ·
`Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` denying geolocation,
microphone, camera and payment · `Cross-Origin-Opener-Policy: same-origin` · HSTS in production ·
`Cache-Control: no-store` on `/api/*`.

**No CSP, deliberately and stated.** The pages carry large inline scripts, so a policy today would
need `unsafe-inline` — a policy that permits the thing it exists to prevent. Extracting the inline
scripts (ARCH-003) comes first; the header follows it, not the other way round.

## Booking integrity

- Unique index on `(consultant_id, slot)` for held and confirmed rows; a duplicate is a 409, not a
  500, because two people wanting the same time is normal.
- The in-memory store enforces the same rule, so local behaviour matches production.
- The consultant must be in the hard-filtered shortlist for *that* enquiry — a client-supplied id is
  a suggestion, not an authority.
- The state is `held`, never `confirmed`: nothing external confirms anything here.

## What is not protected, on purpose

- **No authentication for visitors.** Watchlists, alerts, saved screens, Academy progress and the
  wealth profile live in the browser and never reach the server.
- **No encryption at rest beyond what Postgres provides.**
- **No deletion endpoint yet** — the retention policy is written in
  [`data-retention.md`](data-retention.md) and is on the P1 list.
- **The stand is public.** Two options remain open for the owner: password-gate the whole thing, or
  remove the brand assets. Until one is chosen, the disclosures do the work.
