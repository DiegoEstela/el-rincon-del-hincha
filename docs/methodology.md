# Methodology (draft)

These rules are the source of truth for every statistic in the app. Each rule has its own tests in `tests/unit/domain`.

- **Fan period:** from the start date (inclusive) until today, in the `America/Argentina/Buenos_Aires` time zone.
- **Start date rule (form input):** a real `YYYY-MM-DD` calendar date, not before `1880-01-01` and not after today in Buenos Aires (same bounds as the database). `validateStartDate` returns only an error code, never the input, because the date can be a birth date.
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

### Clubs, aliases and colors

`data/clubs.json` holds the clubs of the Primera División 2025 and the former top-flight clubs of the seasons we ingest (ADR 0012, ADR 0016). A club `id` is a stable slug that never changes, even if the club is renamed. `aliases` lists every exact spelling used by an ingested source (openfootball, Kaggle, later API-Football and RSSSF); adapters resolve a source name with `resolveClubId` (exact match after NFC normalization and trimming, never fuzzy) and stop on an unresolved name. No alias may be shared by two clubs, even after folding case and accents. `colors.primary` is the dominant color of the home shirt and `colors.secondary` the pattern or trim color; the hex values are the project's own palette (`src/data-model/club-palette.ts`), not official club colors, and a darker or lighter variant of a family is used only to reach the contrast rules: primary against secondary (and tertiary against primary) at 3:1 or more so the generic crest is visible. Each club's `source` is a permanent `oldid` revision of its Spanish Wikipedia article (facts only: year, city, color names, pattern); the second source of each fact is recorded in the verification log of plan 0007. A single horizontal band shirt is recorded as `other` until a `band` pattern exists. `scripts/check-club-aliases.ts` is a local, read-only check of the aliases against the Kaggle team names; it is not part of CI.

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
- **Coverage notice (ADR 0003):** per competition. The competitions the notice talks about are the union of (1) competitions with counted matches in the period, (2) competitions with a coverage row of any club involved (the club, or either club of a head-to-head) whose interval overlaps the fan period, and (3) competitions that have a season overlapping the fan period and in which a club involved has any coverage row (any dates) or any match (any season). A coverage row that ended before the period is not evidence that the competition is irrelevant, it is evidence that the ingestion stopped, so set 3 lists it. A competition where no club involved has any row or match stays unlisted even with a season in the period (for example an international cup the club never entered). The list is then restricted by the filter. A single function, `relevantCompetitionIds`, implements this for history, rivals and head-to-head. Complete rows are merged (overlapping or adjacent rows join, `to: null` is ongoing). A competition is `complete` if one merged stretch contains the whole period, `partial` if one overlaps it (the notice carries the start and end of the stretch closest to the period end), `missing` otherwise (including a competition with matches and no rows, or whose rows all ended before the period). The notice is complete only if every listed competition is complete; a real period with no competitions at all is never complete; an empty period shows nothing. A head-to-head merges the rows of both clubs, because complete coverage of either one contains every match between them, and applies the same selection to the rows and matches of both clubs, so a competition known for only one club is listed (and shown as missing when that coverage is not complete).
- **Streaks:** the current streak is the run of identical results (W, D or L) ending at the latest match. The best streak is the longest run of wins; on a tie in length the earliest run is kept. A shoot-out is a draw, so it breaks a win streak.
- **What is at stake:** assuming no draws, wins needed to reach the next better class (dominated to even at -1, even to dominating at +2) and losses to fall to the next worse class, with the target classes; `null` when there is none. The next win milestone is the next multiple of 10 strictly above the current wins (`WIN_MILESTONE_STEP`).
- **Biggest win and loss (head-to-head):** only played matches (administrative results are not real scores; shoot-outs are draws). Tie-break: larger margin, then more goals by the winning side, then the most recent.
- **Finals:** the legs of a final are grouped by season and club pair. The winner is the shoot-out winner if the last leg went to penalties, otherwise the higher aggregate of regulation plus extra time goals, otherwise undetermined (`null`). Suspended legs are ignored. A series belongs to the period when its last leg is inside it. By default only recognized competitions count.
- **Recognized titles:** "officially recognized" means `competition.afa_recognized`. By default only recognized titles are listed; `includeUnrecognized` lists the rest with `recognized: false`. A shared title counts fully for each co-champion and carries `shared: true`. Each title is placed on a shelf: `other` for competitions of type `other`, `international` for international scope, `domestic` otherwise. Title lists do not depend on match coverage; the deciding match is `null` when match data is missing.
- **Pending titles:** the recognized competitions that were played during the period (a season overlaps it) and that the club did not win inside the period, with the number of seasons played; sorted by shelf, then competition id.
- **Rival grouping:** one row per opponent with at least one counted match; groups by dominance (favorable, even, unfavorable); sorted by balance desc, played desc, rival id; `isClassic` from the rivalries table.
- **Fan comparison:** each side is computed over its own period. Eight categories: total titles, international titles, domestic titles, finals won, finals played, classics balance, relegations suffered (fewer wins), best win streak. A tie gives no point; a category that does not apply (no classic rival defined) gives no point. The result is a count of categories won by each side and ties, never a single greatness score. The direct head-to-head uses the later start date, from fan A's side, and is not a category; with the same club on both sides it is not computed.

- **Notes for the UI (not enforced by the engine):**
  - An empty period (start in the future) returns `coverage.isComplete: true` with no competitions. The UI must check `period.isEmpty` and never show a complete-coverage badge for it.
  - The relegations category has no coverage qualifier. The UI must not present it as verified when movement data may be partial.
  - A competition with no coverage row and no match anywhere is unknown to the engine; `isComplete` means complete for the competitions listed, not that nothing is missing.
  - A club that once played a competition and then left it (for example by relegation) shows that competition as `missing` for fans whose period overlaps a later season of it. This is a deliberate, safe false warning: the engine cannot tell a club that left from a club whose ingestion stopped.
  - Head-to-head final series can include legs outside the period when those legs decide the winner of the final, while the record only counts matches inside the period.

## Ingestion

Adapters in `scripts/ingest/` turn an external source into records of `data/` (ADR 0015). Run one with `pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>]`.

- **Pinned input.** An adapter reads a fixed upstream revision and checks the sha256 of every file. A mismatch stops the run; moving to a newer revision is a normal data PR.
- **Ownership.** An adapter replaces only the matches whose `source` starts with its own prefix. Competitions and seasons are added when missing and never overwritten: a difference is a conflict that stops the run.
- **Write only valid data.** The complete next dataset must pass the same validator as `pnpm data:validate`. If anything fails, nothing is written and every problem is printed.
- **Determinism.** Same input and same `clubs.json` give the same bytes. Records are sorted by key and the files are stable under Prettier. A second run changes nothing.
- **Unknown clubs stop the run.** Team names resolve only through the club aliases (ADR 0012). Every unresolved name is listed together with the first file and line; a match is never dropped or guessed.
- **Match ids** are `<date>-<home_id>-<away_id>`, so the same match has the same id whatever the source.

### openfootball (Argentine Primera División, 2018-19 to 2025)

- Each file is one tournament. Matches are stored with the regulation score. A shoot-out is recorded as a draw plus the penalties (`decision: "penalties"`), as in the rules above.
- `is_final` is true only for the match that decides a title (the `Fase Campeón, Final` of the 2020 Copa de la Liga). The other two "finals" of that file (`Fase Complementación, Final` and the Copa Sudamericana qualifier) are stored with `is_final: false`.
- Every openfootball record is `verified: false` (single source). Cross-checking against a second source is what can set it to `true`.
- The 2025 file only has the group stage of the Apertura (until 2025-05-04). Its season ends on 2025-06-01, the day of the final, and the run report marks it partial so the coverage table (issue #12) does not present it as complete.
