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

## Statistics engine

The engine in `src/domain` (ADR 0010, plan 0005) is the only implementation of these rules; Postgres and repositories only fetch rows. All functions are pure and take `now` as an argument. Output is language-neutral (English values); Spanish labels belong to the UI. Each rule has tests in `tests/unit/domain` (and `tests/integration/stats-engine.test.ts`).

| Rule                   | Function            | Module                          |
| ---------------------- | ------------------- | ------------------------------- |
| Fan history            | `calculateHistory`  | `src/domain/history.ts`         |
| Titles in the period   | `titlesInPeriod`    | `src/domain/titles.ts`          |
| Pending titles         | `pendingTitles`     | `src/domain/titles.ts`          |
| Head-to-head           | `headToHead`        | `src/domain/head-to-head.ts`    |
| Dominance              | `classifyDominance` | `src/domain/dominance.ts`       |
| Streaks                | `computeStreaks`    | `src/domain/streaks.ts`         |
| What is at stake       | `whatIsAtStake`     | `src/domain/at-stake.ts`        |
| Fan comparison         | `compareFans`       | `src/domain/compare-fans.ts`    |
| Rival grouping (cards) | `groupRivals`       | `src/domain/rivals.ts`          |
| Coverage notice        | `coverageNotice`    | `src/domain/coverage-notice.ts` |
| Final series           | `finalSeries`       | `src/domain/finals.ts`          |

(Issue #14 used Spanish names: `calcularHistorial`, `titulosEnPeriodo`, `titulosPendientes`, `historialVsRival`, `clasificarDominio`, `rachas`, `loQueEstaEnJuego`, `compararHinchas`.)

- **Period:** `[start, today]`, both inclusive, today in `America/Argentina/Buenos_Aires` (00:00 to 02:59 UTC is still the previous day). A start after today is valid: the period is empty (`isEmpty`) and every result is zero or empty. An invalid start throws `RangeError`.
- **Counted match:** suspended matches never count (they are reported in `suspendedExcluded`); administrative results count and are flagged (`administrative.matchIds`); a shoot-out counts as a draw and is recorded apart (`shootouts`).
- **Goals:** regulation plus extra time. Shoot-out goals never count. Administrative scores count in goals for and against, like in P/W/D/L.
- **Ordering:** every list of matches is sorted by date, then match id, so ties are deterministic.
- **Filter:** matches can be restricted by competition id or type (the rivals screen filter). A year range is a narrower period.
- **Coverage notice (ADR 0003):** per competition. Relevant competitions are those with coverage rows for the club or with counted matches (restricted by the filter). Complete rows are merged (overlapping or adjacent rows join, `to: null` is ongoing). A competition is `complete` if one merged stretch contains the whole period, `partial` if one overlaps it (the notice carries the start and end of the stretch closest to the period end), `missing` otherwise (including a competition with matches and no rows). The notice is complete only if every listed competition is complete; a real period with no competitions at all is never complete; an empty period shows nothing. A head-to-head merges the rows of both clubs, because complete coverage of either one contains every match between them, and lists the competitions where both clubs have rows plus those with counted meetings.
- **Streaks:** the current streak is the run of identical results (W, D or L) ending at the latest match. The best streak is the longest run of wins; on a tie in length the earliest run is kept. A shoot-out is a draw, so it breaks a win streak.
- **What is at stake:** assuming no draws, wins needed to reach the next better class (dominated to even at -1, even to dominating at +2) and losses to fall to the next worse class, with the target classes; `null` when there is none. The next win milestone is the next multiple of 10 strictly above the current wins (`WIN_MILESTONE_STEP`).
- **Biggest win and loss (head-to-head):** only played matches (administrative results are not real scores; shoot-outs are draws). Tie-break: larger margin, then more goals by the winning side, then the most recent.
- **Finals:** the legs of a final are grouped by season and club pair. The winner is the shoot-out winner if the last leg went to penalties, otherwise the higher aggregate of regulation plus extra time goals, otherwise undetermined (`null`). Suspended legs are ignored. A series belongs to the period when its last leg is inside it. By default only recognized competitions count.
- **Recognized titles:** "officially recognized" means `competition.afa_recognized`. By default only recognized titles are listed; `includeUnrecognized` lists the rest with `recognized: false`. A shared title counts fully for each co-champion and carries `shared: true`. Each title is placed on a shelf: `other` for competitions of type `other`, `international` for international scope, `domestic` otherwise. Title lists do not depend on match coverage; the deciding match is `null` when match data is missing.
- **Pending titles:** the recognized competitions that were played during the period (a season overlaps it) and that the club did not win inside the period, with the number of seasons played; sorted by shelf, then competition id.
- **Rival grouping:** one row per opponent with at least one counted match; groups by dominance (favorable, even, unfavorable); sorted by balance desc, played desc, rival id; `isClassic` from the rivalries table.
- **Fan comparison:** each side is computed over its own period. Eight categories: total titles, international titles, domestic titles, finals won, finals played, classics balance, relegations suffered (fewer wins), best win streak. A tie gives no point; a category that does not apply (no classic rival defined) gives no point. The result is a count of categories won by each side and ties, never a single greatness score. The direct head-to-head uses the later start date, from fan A's side, and is not a category; with the same club on both sides it is not computed.
