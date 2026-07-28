# Data retention

## What is collected

Only the Expert Marketplace enquiry form collects anything server-side:

| Field | Why it exists |
|---|---|
| name | so a consultant can address the person |
| email | the only contact channel in the pilot |
| country | decides jurisdiction in the hard filter — not optional for a regulated match |
| language | the consultation has to be in a language both speak |
| capital band | a range, never an amount — the filter needs a band and nothing finer |
| free-text description | the enquiry itself; a model structures it into a brief |
| two consent flags + version + timestamp | AI processing and consultant sharing, answered separately |

Derived and stored alongside it: the AI brief, matching results, bookings, consultation notes and
the generated summary. AI call records store token counts and cost — never prompt content.

## What is not collected

Everything else on the portal is client-side and never reaches the server: watchlists, alerts, saved
screens, the research journey, Academy progress, the wealth profile and its scenarios, mode
preference, and the analytics buffer. That is why nothing asks for an account before it is useful —
there is nothing to sync.

The wealth profile deserves naming explicitly: it is the most sensitive thing a visitor can type
here, and it never leaves the browser. The page says so at the top and again at the bottom.

## Retention

| Record | Policy | State |
|---|---|---|
| Enquiry + brief | delete after the consultation, or 90 days | **written, not automated** |
| Booking | keep while held, delete with the enquiry | written, not automated |
| Consultation notes and summary | 90 days | written, not automated |
| AI call metadata | 12 months, no content | in effect (no content is ever stored) |
| Server logs | no PII by construction — ids and routes only | in effect |

The honest state: retention is a policy, not yet a cron job. On a stand without a database
(`storage: memory`) it is also moot, because a restart clears everything — which is a data-loss
problem, not a privacy feature, and is flagged loudly in the log and in `/api/system/status`.

## Deletion

There is no self-service deletion endpoint yet. The access token issued when an enquiry is created
is the right credential for one — `DELETE /api/requests/:id` behind the same ownership check — and
it is the first item on the privacy backlog. Until it exists, the form states that deletion can be
requested and the enquiry is not needed after the consultation.

## What the visitor is told, before they type

On the enquiry form, above the button:

> What is stored: your name, email, country, capital band and the text above, in this prototype's
> pilot database. Ask for deletion at any time — the enquiry is not needed after the consultation.
> Do not enter account numbers, documents or anything you would not put in an email.

That last sentence exists because a free-text box invites more than it needs, and the honest fix is
to say so rather than to silently redact afterwards.

## Access

- Enquiry records are readable only with the per-request access token (see
  [`security-model.md`](security-model.md)).
- The staff list of all enquiries is behind `STAFF_TOKEN`, which fails closed in production.
- Ordinary API responses strip `access_hash` — credential material never leaves the server, even to
  the person who owns the record.
