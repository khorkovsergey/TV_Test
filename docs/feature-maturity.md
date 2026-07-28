# Feature maturity

## Why one field became three

`features.js` had a single `status` doing three unrelated jobs — how finished something is, how new
it is, and whether it would be paid. Flattening those into one word forced a choice between them,
and the choice that got made was the flattering one. Expert Marketplace was `NEW`, and its
description read *"Licensed advisers verified by regulator and jurisdiction"* — on a stand whose own
README says licence integration is deliberately absent and every licence is demo data.

That is not a wording slip. On a case study about trust in financial interfaces, a false
verification claim is the worst possible line to leave in.

```js
maturity        live | beta | prototype | concept     how much really works
releaseMarker   new | improved | null                 a marketing fact
commercialTier  included | premium | null             a commercial fact
```

A feature can now be new *and* barely built, which is a true and common combination the old model
could not express.

## Current values

| Feature | Maturity | Release | Commercial |
|---|---|---|---|
| NEW-01 Guided Academy | beta | new | included |
| NEW-02 Research Copilot | beta | new | included |
| NEW-03 TradingView Everywhere | concept | new | — |
| NEW-04 GEO / AEO | prototype | improved | — |
| NEW-05 Personal Wealth Hub | beta | new | included |
| NEW-06 AI Private | concept | new | premium |
| **NEW-07 Expert Marketplace** | **prototype** | new | — |
| NEW-08 Community Rewards | concept | new | — |
| CORE-01…05 rebuilt journeys | live | improved | included |

## What each badge promises

| Badge | Promise |
|---|---|
| `LIVE` | Works here, end to end. |
| `BETA` | Works; the flow is not complete. |
| `PROTOTYPE` | A working demonstration, not a product — data and any verification are simulated. |
| `CONCEPT` | An idea shown as a prototype. Not a product and not claiming to be. |
| `NEW` / `IMPROVED` | New in this release, or a rebuilt journey. Says nothing about maturity. |
| `PREMIUM` | Would be a paid tier. Nothing is charged anywhere on this stand. |

Maturity always renders first: what a thing *is* comes before how new it is.

## Expert Marketplace, stated correctly

The flow is the deepest thing on the stand — matching by jurisdiction, language and capital band,
an AI brief built from the visitor's own words, explicit control over what is shared, a
standardised written result. What it is not:

- consultants are demo records;
- licence identifiers are demo data and are checked against **no** registry;
- a booking is `held`, never confirmed — no calendar, no payment, no consultant acceptance exists;
- nothing here is investment advice, and the summary says so on every copy.

The registry copy now reads: *"Licence and jurisdiction are shown on every profile — and in this
prototype they are demo records, checked against no registry."*

## Enforcement

`npm run check:copy` fails the build on:

- `Standart`, `Marketpalce`, `Experts Marketplace`, `Beginner mode`;
- any user-facing "verified adviser / verified expert / licences are verified / verified by
  regulator" phrasing that is not immediately denied in the surrounding sentence.

A rule is cheaper than another release where the most important claim on the stand is the one that
is not true.
