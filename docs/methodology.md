# Methodology (draft)

These rules are the source of truth for every statistic in the app. Each rule has its own tests in `tests/unit/domain`.

- **Fan period:** from the start date (inclusive) until today, in the `America/Argentina/Buenos_Aires` time zone.
- **A title counts** if its `awarded_on` falls inside the period.
- **Match result:** the score at the end of regulation plus extra time, if any. A penalty shoot-out **counts as a draw** in P/W/D/L and is recorded separately. In finals and titles, the shoot-out winner wins the final.
- **Balance** = W - L. Draws do not change it.
- **Dominance:** "Dominás" if balance >= +2, "Parejo" if between -1 and +1, "Te domina" if <= -2. Thresholds live in a configurable constant.
- **Suspended matches** do not count. **Administrative results** count with a visible mark.
- **Classics:** defined by the `rivalries` table.
- **Partial coverage:** if the start date is earlier than the club's full coverage, the UI shows a clear notice. Incomplete data is never presented as complete.
- **Disputed titles** (AFA recognition, amateur era, etc.): the criterion and source are shown. By default only officially recognized titles count.

## Data validation

`pnpm data:validate` checks every `data/*.json` file against the schemas in `src/data-model` (field names: ADR 0009) and prints one line per issue as `[rule] file#recordId: message`. It exits 1 if there is any issue. Dates are calendar dates in `America/Argentina/Buenos_Aires`. Rules:

- `invalid-json`: a file is not valid JSON (reported by the CLI).
- `unknown-file`: a file name that is not part of the data model (for example `match.json`).
- `schema`: a record has the wrong shape (types, enums, unknown keys, impossible dates, root not an array).
- `missing-source`: a record has no `source`, or it is blank. Every record of every file needs one.
- `duplicate-id`: two records share an `id` (or composite key) in one file.
- `duplicate-match`: two matches share date, competition and club pair (home and away order ignored).
- `unknown-club`: a match references a club missing from `clubs`.
- `same-club`: a match has the same club as home and away.
- `unknown-reference`: any other foreign key is not found, or a title's competition differs from its season's.
- `negative-goals`: goals or penalty counts are negative.
- `missing-score`: a played or administrative match has no score.
- `penalties-inconsistent`: a shoot-out without both counts, with unequal goals or tied; or penalty counts without a shoot-out.
- `future-played-match`: a played or administrative match is dated after today in Buenos Aires.
- `date-outside-season`: a match date falls outside its season range (bounds inclusive).
- `invalid-season-range`: a season starts after it ends, or a coverage row starts after it ends.
- `title-without-support`: with complete coverage of the season, the champion has no supporting match. Non-league competitions (national cups, international, other) need a counted final involving the club; for leagues the club must have played at least one counted match that season.
- `unshared-co-champions`: a season has two or more titles and one is not marked `shared`.
- `control-totals`: in `standings.json` (optional, source-backed), won + drawn + lost differs from played.
- `standings-mismatch`: with complete coverage, the P/W/D/L tallied from matches differs from the `standings.json` row.
