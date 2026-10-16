# 0011 — Match date precision

Status: **Accepted** (2026-10-16, Diego). Implementation is part of the dataset and engine issues (#8, #14 follow-up); this ADR fixes the contract.

## Context

The fan period is "from the start date (inclusive) until today". Matches from 2018-19 on have an exact date (openfootball, API-Football). The only complete source for 1931 to 2017, the Kaggle dataset (PDDL), has only the tournament and the year for each match (ADR 0003). Treating a whole tournament as if it happened on one day would silently invent dates.

## Decision

1. Every match has a `date_precision`: `day` (exact calendar date in America/Argentina/Buenos_Aires) or `season` (only the season is known).
2. A `day` match keeps `date`. A `season` match has no `date` and must belong to a season with both `start` and `end` dates, each with a `source`.
3. Product rule for the fan period (decided by Diego):
   - `day` matches count when `date` is on or after the fan's start date.
   - `season` matches count only when the **season started on or after the fan's start date**.
   - A season already in progress on the fan's start date is **excluded** and reported in the result as a partial-season notice (data only; the Spanish copy lives in the UI).
4. The coverage notice lists which competitions and which seasons are excluded for this reason. Nothing is rounded up.
5. The validator rejects a `season` match without a dated season, and a `day` match without `date`; `date-outside-season` applies only to `day` matches.
6. When two sources cover the same match, prefer the one with exact day precision (single source per match).
7. A fan start date equal to the season start date counts the season (the season started on or after the start date).
8. A season with a missing end date is rejected.

## Consequences

- Head-to-head records before 2018 are by whole tournaments, never partial ones; the UI must say so.
- Season start and end dates for about 138 tournaments need a sourced reference; approximate dates are acceptable only if flagged as such in `source`, because they only decide whether a start date falls inside the season.
- `docs/methodology.md` is updated in the same PR as the code that implements this ADR: a new bullet for season-precision matches and a change to the partial coverage rule.
- The current schemas require `matches.date` and `seasons.start` and `end`; both become conditional on `date_precision`.
- The fan period rule (start date inclusive) is unchanged for `day` matches.
- The season dates and the schema change are tracked in issue #38 (Fase 1 milestone).
- Schemas, the validator (#9) and the stats engine (#14) get a follow-up change; the golden-fixtures issue (#36) should cover this rule with real data.
