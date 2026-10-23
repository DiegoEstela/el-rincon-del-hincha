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
- `missing-coverage`: a club and competition pair has no row in `coverage.json` (run `pnpm data:coverage`).
- `coverage-overlap`: two rows of one club and competition share a day.
- `coverage-overclaim`: a complete row reaches a season of its competition that has no match loaded.

### Coverage table

`data/coverage.json` says, for every club and competition, where our data is complete and where it is not. It is **derived, never written by hand** (ADR 0017): `pnpm data:coverage` builds it from `seasons.json`, `matches.json` and the reviewed list of declared gaps in `src/data-model/coverage-gaps.ts`, and every ingestion run regenerates it in the same validated commit. `pnpm data:coverage --check` fails if the committed file differs from what is derived.

- A row `complete: true` over `[from, to]` means every match of the club in that competition dated in the interval is loaded. It is **per competition**: complete Primera data says nothing about cups.
- Stretches follow participation. A complete stretch is a run of consecutive loaded seasons that the club played; a season the club missed (relegated, not yet promoted) or that is not loaded ends it. The first stretch of a club starts at its first loaded season, the later of 2018-19 and its first season in the dataset (ADR 0003). A club that left and came back has one stretch per stay, never one across the absence.
- A season is partial when its last match is before its `end`. The missing tail must be inside a declared gap, otherwise the generator stops. The generator only sees a missing tail: a season whose first matches are missing, or with a hole in the middle, still reads as complete. That is a limit of deriving coverage from the data itself, so a new source must be checked against its header counts (as the openfootball adapter does) before it is ingested.
- A declared gap becomes one `complete: false` row per club with the source of the gap. A pair with nothing at all gets an incomplete fallback row.
- A fan whose start date is earlier than the first complete stretch gets a partial notice: the engine returns `partial` with `completeFrom` after the period start. `isComplete` is true only when every listed competition is complete, so the screens must show the notice whenever it is false. The wording belongs to the screens, not to this table.
- The table only knows the competitions in `competitions.json`. Cups that exist but are not loaded (Copa Argentina, Libertadores, Sudamericana, supercups and others) are not listed yet, so a short period can read complete while those cups were played that season. Phase 2 of plan 0014 registers them with declared gaps; no screen may show a complete badge before that is done.

#### Known coverage gaps

| Competition                   | From       | To         | Why                                                                                                                                    | Source                              |
| ----------------------------- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `copa-de-la-liga-profesional` | 2021-02-12 | 2021-06-04 | Edition 2021 is not loaded.                                                                                                            | es.wikipedia, revision 175528472    |
| `copa-de-la-liga-profesional` | 2022-02-10 | 2022-05-22 | Edition 2022 is not loaded.                                                                                                            | es.wikipedia, revision 175528478    |
| `copa-de-la-liga-profesional` | 2023-08-17 | 2023-12-16 | Edition 2023 is not loaded.                                                                                                            | es.wikipedia, revision 175528489    |
| `copa-de-la-liga-profesional` | 2024-01-25 | 2024-05-05 | Edition 2024, the last one, is not loaded.                                                                                             | es.wikipedia, revision 175528520    |
| `primera-division`            | 2025-12-15 | open       | The 2026 Apertura and later tournaments are not loaded: the RSSSF page of 2025 ends with the Clausura final on 2025-12-14 (plan 0017). | rsssf.org, `arg2025.html#1clausura` |

The Copa Diego Armando Maradona 2020 (2020-10-30 to 2021-03-31) is the only edition of that cup we have. Its complete stretch ends on 2021-02-11, the day before the 2021 edition starts, so its last matches (the Fase Complementación and the Copa Sudamericana qualifier of 2021-03-31) lie inside a gap and are not claimed.

### Clubs, aliases and colors

`data/clubs.json` holds the clubs of the Primera División 2025 and the former top-flight clubs of the seasons we ingest (ADR 0012, ADR 0016). A club `id` is a stable slug that never changes, even if the club is renamed. `aliases` lists every exact spelling used by an ingested source (openfootball, Kaggle, later API-Football and RSSSF); adapters resolve a source name with `resolveClubId` (exact match after NFC normalization and trimming, never fuzzy) and stop on an unresolved name. No alias may be shared by two clubs, even after folding case and accents. `colors.primary` is the dominant color of the home shirt and `colors.secondary` the pattern or trim color; the hex values are the project's own palette (`src/data-model/club-palette.ts`), not official club colors, and a darker or lighter variant of a family is used only to reach the contrast rules: primary against secondary (and tertiary against primary) at 3:1 or more so the generic crest is visible. Each club's `source` is a permanent `oldid` revision of its Spanish Wikipedia article (facts only: year, city, color names, pattern); the second source of each fact is recorded in the verification logs of plans 0007 and 0012. A single horizontal band shirt is recorded as `other` until a `band` pattern exists. `scripts/check-club-aliases.ts` is a local, read-only check of the aliases against the Kaggle team names; it is not part of CI.

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
- **Filter:** matches can be restricted by competition id or type (the rivals screen filter). A year range is a narrower period: `narrowPeriod` starts it on the later of the fan start and January 1 of the first year, and ends it on the earlier of today (Buenos Aires) and December 31 of the last year; it is empty when nothing is left, and years outside 1880 to 9999 or a first year after the last one are errors.
- **Coverage notice (ADR 0003):** per competition. The competitions the notice talks about are the union of (1) competitions with counted matches in the period, (2) competitions with a coverage row of any club involved (the club, or either club of a head-to-head) whose interval overlaps the fan period, and (3) competitions that have a season overlapping the fan period and in which a club involved has any coverage row (any dates) or any match (any season). A coverage row that ended before the period is not evidence that the competition is irrelevant, it is evidence that the ingestion stopped, so set 3 lists it. A competition where no club involved has any row or match stays unlisted even with a season in the period (for example an international cup the club never entered). The list is then restricted by the filter. A single function, `relevantCompetitionIds`, implements this for history, rivals and head-to-head. Complete rows are merged (overlapping or adjacent rows join, `to: null` is ongoing). A competition is `complete` if one merged stretch contains the whole period, `partial` if one overlaps it (the notice carries the start and end of the stretch closest to the period end), `missing` otherwise (including a competition with matches and no rows, or whose rows all ended before the period). The notice is complete only if every listed competition is complete; a real period with no competitions at all is never complete; an empty period shows nothing. A head-to-head merges the rows of both clubs, because complete coverage of either one contains every match between them, and applies the same selection to the rows and matches of both clubs, so a competition known for only one club is listed (and shown as missing when that coverage is not complete).
- **Streaks:** the current streak is the run of identical results (W, D or L) ending at the latest match. The best streak is the longest run of wins; on a tie in length the earliest run is kept. A shoot-out is a draw, so it breaks a win streak. The unbeaten run is the trailing matches that are not losses (null when the latest match is a loss); the winless run is the trailing matches that are not wins (null when the latest is a win). A shoot-out extends both.
- **What is at stake:** assuming no draws, wins needed to reach the next better class (dominated to even at -1, even to dominating at +2) and losses to fall to the next worse class, with the target classes; `null` when there is none. The next win milestone is the next multiple of 10 strictly above the current wins (`WIN_MILESTONE_STEP`).
- **Biggest win and loss (head-to-head):** only played matches (administrative results are not real scores; shoot-outs are draws). Tie-break: larger margin, then more goals by the winning side, then the most recent.
- **Finals:** the legs of a final are grouped by season and club pair. The winner is the shoot-out winner if the last leg went to penalties, otherwise the higher aggregate of regulation plus extra time goals, otherwise undetermined (`null`). Suspended legs are ignored. A series belongs to the period when its last leg is inside it. By default only recognized competitions count.
- **Recognized titles:** "officially recognized" means `competition.afa_recognized`. By default only recognized titles are listed; `includeUnrecognized` lists the rest with `recognized: false`. A shared title counts fully for each co-champion and carries `shared: true`. Each title is placed on a shelf: `other` for competitions of type `other`, `international` for international scope, `domestic` otherwise. Title lists do not depend on match coverage; the deciding match is `null` when match data is missing.
- **Pending titles:** the recognized competitions that were played during the period (a season overlaps it) and that the club did not win inside the period, with the number of seasons played; sorted by shelf, then competition id.
- **Rival grouping:** one row per opponent with at least one counted match; groups by dominance (favorable, even, unfavorable); sorted by balance desc, played desc, rival id; `isClassic` from the rivalries table; `competitionIds` lists, sorted, the competitions with counted matches in the period and filter, so a screen can say which competitions its numbers include.

### Rivals screen (UI)

The "[Mi club] vs. Todos" screen (plan 0015, ADR 0018) computes in the browser on one document per club (`/api/clubs/<id>`), so the fan start date never leaves the device.

- The year options are the years with counted matches of the club in the fan period, and the tournament types offered are the ones present in those matches. The default filter is the whole range and all types; when the range is the whole range the fan period is not narrowed, so the coverage notice reflects the real period.
- Sorts: balance (balance desc, played desc, name), played (played desc, balance desc, name) and name (Spanish collation, accents ignored). The three humor sections show the top three of each group: favorable by balance desc, even by played desc, unfavorable worst first.
- The coverage notice shows whenever the engine says `isComplete` is false, and two plain lines always show: which competitions are counted and that the cups that are not loaded are missing. **No complete badge exists**, because a one-year range can read complete while cups of that year are not loaded (plan 0014, Phase 2).
- Dominance chips use a 5% tint of their color (a 12% tint failed the contrast test over the glow).
- **Fan comparison:** each side is computed over its own period. Eight categories: total titles, international titles, domestic titles, finals won, finals played, classics balance, relegations suffered (fewer wins), best win streak. A tie gives no point; a category that does not apply (no classic rival defined) gives no point. The result is a count of categories won by each side and ties, never a single greatness score. The direct head-to-head uses the later start date, from fan A's side, and is not a category; with the same club on both sides it is not computed.

- **Notes for the UI (not enforced by the engine):**
  - An empty period (start in the future) returns `coverage.isComplete: true` with no competitions. The UI must check `period.isEmpty` and never show a complete-coverage badge for it.
  - The relegations category has no coverage qualifier. The UI must not present it as verified when movement data may be partial.
  - A competition with no coverage row and no match anywhere is unknown to the engine; `isComplete` means complete for the competitions listed, not that nothing is missing.
  - A club that once played a competition and then left it (for example by relegation) shows that competition as `missing` for fans whose period overlaps a later season of it. This is a deliberate, safe false warning: the engine cannot tell a club that left from a club whose ingestion stopped.
  - Head-to-head final series can include legs outside the period when those legs decide the winner of the final, while the record only counts matches inside the period.

### Rivalry detail (UI)

The "[Mi club] vs. [Rival]" screen (plan 0016, ADR 0019) computes one `headToHead` in the browser on the two club documents.

- It always shows the whole fan period and every loaded competition. It has no filters, so "Lo que está en juego" and "desde que naciste" stay unambiguous.
- **Streaks.** The headline is the longest of the current run of identical results, the unbeaten run and the winless run. A tie prefers the identical run, then the unbeaten one. Runs are counted inside the fan period only. A shoot-out is a draw, so it extends both the unbeaten and the winless run.
- **What is at stake.** `STAKE_NEAR = 3` (in `src/lib/rivalry-copy.ts`). One dominance line always shows (wins to improve, or the cushion in losses when the fan dominates). The warning ("te pasan a dominar") shows only when the record is even and 3 or fewer losses away. The milestone line shows only when 3 or fewer wins away and the fan has won at least once; with no wins the "first win" line replaces it. A pair that never met has no lines.
- **Wording by start mode.** "desde que naciste" when the fan chose the birth date, "desde que sos hincha" otherwise. Nothing else is said about the date; the screen shows only the month and year the period starts in.
- **Coverage.** The same rules as the rivals screen: the notice shows whenever `isComplete` is false and the period is not empty, "Contamos: ..." and the line about the cups that are not loaded always show, and there is no complete badge. For a pair that never met the included line says so instead of "no matches loaded".
- **Finals.** A series can have legs before the period start (marked "antes de tu período"); the series belongs to the period by its last leg.
- **Biggest win and loss.** Played matches only: an administrative result is never one of them.
- Match dates are public facts and are shown in full. A match with only a season precision (ADR 0011) will need to show the season instead; today every match has a day.

## Ingestion

Adapters in `scripts/ingest/` turn an external source into records of `data/` (ADR 0015). Run one with `pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>]`.

- **Pinned input.** An adapter reads a fixed upstream revision and checks the sha256 of every file. A mismatch stops the run; moving to a newer revision is a normal data PR.
- **Ownership.** An adapter replaces only the matches whose `source` starts with its own prefix. Competitions and seasons are added when missing and never overwritten: a difference is a conflict that stops the run.
- **Write only valid data.** The complete next dataset must pass the same validator as `pnpm data:validate`. If anything fails, nothing is written and every problem is printed.
- **Coverage is regenerated.** Each run also rewrites `coverage.json` from the merged data, in the same validated commit (ADR 0017), so it never lags behind the matches.
- **Determinism.** Same input and same `clubs.json` give the same bytes. Records are sorted by key and the files are stable under Prettier. A second run changes nothing.
- **Unknown clubs stop the run.** Team names resolve only through the club aliases (ADR 0012). Every unresolved name is listed together with the first file and line; a match is never dropped or guessed.
- **Match ids** are `<date>-<home_id>-<away_id>`, so the same match has the same id whatever the source.

### openfootball (Argentine Primera División, 2018-19 to 2025)

- Each file is one tournament. Matches are stored with the regulation score. A shoot-out is recorded as a draw plus the penalties (`decision: "penalties"`), as in the rules above.
- `is_final` is true only for the match that decides a title (the `Fase Campeón, Final` of the 2020 Copa de la Liga). The other two "finals" of that file (`Fase Complementación, Final` and the Copa Sudamericana qualifier) are stored with `is_final: false`.
- Every openfootball record is `verified: false` (single source). Cross-checking against a second source is what can set it to `true`.
- The 2025 file only has the group stage of the Apertura (until 2025-05-04). Its season ends on 2025-06-01, the day of the final, and the run report marks it partial so the coverage table (issue #12) does not present it as complete.

### RSSSF (Argentine first division, from the 2025 Apertura knockouts)

Plan 0017, ADR 0020. The permission covers the results and final tables of the first division only (`docs/spike/replies/2026-10-16-rsssf.md`); no cup and no lower division is read, and a test fails if an excerpt mentions one.

- **Pinned excerpts.** RSSSF pages are edited in place, so `sources/rsssf/manifest.json` pins each page (sha256, bytes, retrieval date, the author and "last updated" the page shows) and `sources/rsssf/<page>.<excerpt>.txt` keeps the byte-exact first-division sections we read, never the whole page. `pnpm data:snapshot rsssf [--check]` is the only code that requests rsssf.org: one page at a time, five seconds apart, https only, no redirects, a user agent with no personal data. It is never run in tests or in CI.
- **One strict parser per layout.** `full-names-2017` reads the pages of 2017-18 onward. A line the grammar does not know inside the matches stops the run with the excerpt and the line; it is never skipped or guessed.
- **Dates.** The pages write month and day without the year. Each tournament has a window of at most 12 months (`scripts/ingest/rsssf/config.ts`); the year is the one that puts the date inside the window, and a weekday written on the page must match.
- **Abandoned matches.** Abandoned and completed later (two lines, or one line with "remaining time on 24 Oct"): one record with the final score, dated the day it was completed. Never completed: `suspended`, with no score.
- **One source per season.** A season has matches of one source only. The exception is the 2025 Apertura: openfootball is the base (group stage, up to 2025-05-04) and RSSSF adds the knockout stage after that date. Each adapter refuses to write on the other side of that line.
- **Final tables are checked.** For a season whose final table counts every match, each club's matches, wins, draws, losses, goals and points must equal the table, with a shoot-out counted as a draw. A difference stops the run unless the manifest lists it as a reviewed exception with its reason; an unused exception is an error.
- **Standings.** One row per club of the final table (matches, wins, draws, losses).
- **Club names** resolve only through the aliases of `data/clubs.json`; the table names carry the legal name and the headquarters, which are aliases too. Aliases that exist only to read a source (a legal form in front, a headquarters after) are not search keys in the club picker.
- **Titles.** One title per first division season we hold, from the RSSSF list of champions (`sources/rsssf/argchamp.champions.txt`, pinned like the other excerpts). When the final table of the same tournament is read, its "Champion" mark must name the same club, or the run stops. `awarded_on` is the day of the final when the season has one, else the last match of the season. The 2025 "Anual LPF" is never loaded: the list itself says the AFA proclaimed it although the regulations did not foresee it. Titles stay `verified: false` (one source).
- **Titles decided in a single final.** The openfootball adapter writes the title of a season marked `titleFromFinal` from the final it already loaded: the winner on goals, else on penalties, with the final line as `source` (today only the 2020 Copa Diego Armando Maradona, Boca, 2021-01-17).
- **Credit.** `/acerca` names the author of every page in the manifest and links each page.
