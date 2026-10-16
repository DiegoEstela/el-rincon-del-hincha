---
issue: 14
status: pending
date: 2026-10-16
---

# Plan 0005: Statistics engine in `src/domain` (strict TDD)

Related ADRs: [0003](../adr/0003-data-sources.md) (coverage is per competition, partial coverage is shown), [0009](../adr/0009-data-model-naming.md) (English identifiers, Spanish UI copy), [0010](../adr/0010-stats-engine-in-typescript.md) (new: the engine is the only implementation of the methodology; Postgres only fetches).

## Goal

All fan statistics come from pure functions in `src/domain`. Every calculation rule of section 3.4 (now `docs/methodology.md`) must be tested before any screen uses it, so the numbers fans see are trustworthy. This plan builds the whole Phase 2 engine: history, titles, head-to-head, dominance, streaks, "what is at stake", rival grouping, the coverage notice and the friend comparison.

## Acceptance criteria (copied from issue #14)

- Given a club and a fan period, when `calcularHistorial` runs, then it returns PJ/PG/PE/PP and saldo using the period rules (start date inclusive, America/Argentina/Buenos_Aires), with penalty shootouts counted as draws and recorded apart, suspended matches excluded, and administrative results included with a visible flag.
- Given titles and a period, when `titulosEnPeriodo` runs, then only titles whose `fecha_consagracion` falls inside the period count, and by default only officially recognized ones.
- Given a period, when `titulosPendientes` runs, then it lists the titles the fan has not seen the club win.
- Given two clubs, when `historialVsRival` runs, then it returns the head-to-head record in the period, including finals, last match and biggest wins and losses.
- Given a saldo, when `clasificarDominio` runs, then it returns the class by threshold: dominating at saldo of +2 or more, even between -1 and +1, dominated at -2 or less, with thresholds in a configurable constant.
- Given match results, when `rachas` runs, then it returns the current streak and the best streak.
- Given a rivalry, when `loQueEstaEnJuego` runs, then it returns what is needed to change the dominance class or reach the next milestone of wins.
- Given two fans, when `compararHinchas` runs, then it returns a category scoreboard (no single greatness metric) and the head-to-head from the later start date.
- Given a start date earlier than full coverage, when stats are computed, then the result carries a partial-coverage flag.
- Given each rule of section 3.4, when tests run, then each has its own tests using fixtures of real verified matches.

Out of scope: any UI, reading from Supabase, Spanish labels.

### Name mapping (ADR 0009: identifiers are English)

| Issue / master prompt | Engine function     | Module                          |
| --------------------- | ------------------- | ------------------------------- |
| `calcularHistorial`   | `calculateHistory`  | `src/domain/history.ts`         |
| `titulosEnPeriodo`    | `titlesInPeriod`    | `src/domain/titles.ts`          |
| `titulosPendientes`   | `pendingTitles`     | `src/domain/titles.ts`          |
| `historialVsRival`    | `headToHead`        | `src/domain/head-to-head.ts`    |
| `clasificarDominio`   | `classifyDominance` | `src/domain/dominance.ts`       |
| `rachas`              | `computeStreaks`    | `src/domain/streaks.ts`         |
| `loQueEstaEnJuego`    | `whatIsAtStake`     | `src/domain/at-stake.ts`        |
| `compararHinchas`     | `compareFans`       | `src/domain/compare-fans.ts`    |
| (5.3 summary cards)   | `groupRivals`       | `src/domain/rivals.ts`          |
| (coverage notice)     | `coverageNotice`    | `src/domain/coverage-notice.ts` |

## Approval status (2026-10-16)

Diego answered explicitly: item 3 (shared title counts fully for each co-champion), item 4 (pending titles are the recognized tournaments played during the period that the club did not win) and item 7 (win milestones step 10). Items 1, 2, 5, 6 and 8 are technical or default choices, taken as recommended by the plan. Item 1 is tracked by the golden-fixtures follow-up issue.

## Approval needed from Diego (product decisions only)

T0 blocks only the tasks that depend on each item; everything else can start.

1. **Real verified fixtures (last acceptance criterion).** `data/` is still empty (issue #8 open), and the project rule is never to invent real results. Proposal: the engine is built and fully tested now with the **synthetic** factory (`club-a`..`club-d`, `fixture:synthetic`); a follow-up issue adds "golden" tests with a handful of real, sourced matches (taken from `data/` once #8 lands, with their `source` URL) that pin a few published numbers. The issue is closed with this criterion explicitly deferred to that follow-up.
2. **"Officially recognized" = `competition.afa_recognized === true`.** Titles have no recognition field of their own; recognition is per competition. Consequence for data curation (#8): official CONMEBOL/FIFA competitions (Libertadores, Sudamericana, Recopa, Intercontinental) must be stored with `afa_recognized: true`, and disputed tournaments (for example amateur-era or dissident leagues not recognized) as separate competitions with `false`. The same default filter applies to finals counted in the comparison.
3. **Shared titles** count as one full title for each co-champion (as AFA does), carrying `shared: true` so the UI can mark them.
4. **Pending titles definition:** one entry per recognized competition that was played during the fan period (it has a season overlapping the period) and that the club did not win inside the period. Competitions that did not exist in the period (for example Metropolitano for a fan born in 2000) are not pending. Alternative: one entry per season not won (much longer list).
5. **Biggest win and biggest loss** use only matches with `status: "played"` (administrative scores are not real scores); shoot-outs are draws, so they never qualify. Tie-break: larger margin, then more goals scored, then most recent.
6. **Comparison categories (8):** total titles, international titles, domestic titles, finals won, finals played, classics balance, relegations suffered (fewer wins the category), best win streak. Finals won and played are two categories (alternative: one "won of played" category, then 7). A category where both values are equal is a tie (no point); a category that does not apply to a side (no classic rival defined) is `not_applicable` and gives no point. The direct head-to-head is shown next to the scoreboard but is **not** a category.
7. **Win milestone step = 10** ("Estás a 1 victoria de las 30"): the next milestone is the next multiple of 10 strictly above current wins.
8. **Title lists are not tied to match coverage.** Honours come from separate sources that go further back (ADR 0003, decision 3), so `titlesInPeriod` and `pendingTitles` do not carry the match coverage notice. The deciding match of a title may be `null` when match coverage is missing, and the UI says so.

## Approach

### Module layout (`src/domain/`)

```
match-outcome.ts    (exists) outcomeFor, tallyClubSeason; + clubView(match, clubId)
types.ts            StatsData, StatsIndex, FanPeriod, HistoryRecord, MatchView, Streak, ...
period.ts           fanPeriod(start, now), inPeriod(date, period), laterStart(a, b)
data.ts             statsDataFrom(dataset), buildStatsIndex(data), competitionOf(index, match)
history.ts          tallyMatches(views), calculateHistory(index, clubId, period, filter?)
coverage-notice.ts  mergeCompleteIntervals(rows), coverageNotice(index, clubIds, period, competitionIds)
dominance.ts        DOMINANCE_THRESHOLDS, Dominance, assertThresholds, classifyDominance
streaks.ts          computeStreaks(views)
at-stake.ts         WIN_MILESTONE_STEP, whatIsAtStake(record, thresholds?, step?)
finals.ts           finalSeries(index, clubId, period, filter?), seriesWinner(legs)
titles.ts           trophyShelf, isRecognized, titlesInPeriod, decidingMatch, pendingTitles
head-to-head.ts     headToHead(index, clubId, rivalId, period, options?)
rivals.ts           groupRivals(index, clubId, period, options?)
compare-fans.ts     fanSummary(index, fan, now), compareFans(index, fanA, fanB, now)
```

One concern per file keeps each test file small and makes 100% branch coverage easy to reach and to read. No barrel `index.ts` (it adds nothing to test and hides import cycles). Dependencies point one way: `compare-fans -> head-to-head/rivals/titles/finals/streaks -> history/coverage-notice -> data/period/match-outcome -> @/data-model/types` (types only) and `@/data-model/dates` (pure helpers). Nothing in `src/domain` imports `zod`, `fs`, `next` or calls `Date.now()`.

Date helper needed: `nextDay(date: string): string` (calendar arithmetic with `Date.UTC`) goes in `src/data-model/dates.ts` next to `isWithin`, with its own tests (that folder already enforces 100% branches).

### Core types and signatures

```ts
// types.ts (all readonly; reuse data-model types)
import type {
  Club,
  Competition,
  Coverage,
  Match,
  Movement,
  Rivalry,
  Season,
  Title,
} from "@/data-model/types";
import type { Outcome } from "./match-outcome";

export type IsoDate = string; // YYYY-MM-DD, calendar date in America/Argentina/Buenos_Aires

export type StatsData = Readonly<{
  clubs: readonly Club[];
  competitions: readonly Competition[];
  seasons: readonly Season[];
  matches: readonly Match[];
  titles: readonly Title[];
  movements: readonly Movement[];
  rivalries: readonly Rivalry[];
  coverage: readonly Coverage[];
}>;

export type StatsIndex = Readonly<{
  data: StatsData;
  seasonById: ReadonlyMap<string, Season>;
  competitionById: ReadonlyMap<string, Competition>;
  matchesByClub: ReadonlyMap<string, readonly Match[]>; // sorted by date, then id
}>;

/** [start, end] both inclusive. `isEmpty` when start is after today (future start). */
export type FanPeriod = Readonly<{ start: IsoDate; end: IsoDate; isEmpty: boolean }>;

export type MatchFilter = Readonly<{
  competitionIds?: readonly string[]; // /rivales "tipo de torneo" filter
  competitionTypes?: readonly Competition["type"][];
}>;

/** One counted match seen from one club. */
export type MatchView = Readonly<{
  match: Match;
  competitionId: string;
  rivalId: string;
  outcome: Outcome; // shoot-out => "D"
  goalsFor: number; // regulation + extra time
  goalsAgainst: number;
  shootout: "won" | "lost" | null;
  isAdministrative: boolean; // status === "administrative_result", for the UI mark
}>;

export type HistoryRecord = Readonly<{
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  balance: number; // won - lost
  shootouts: Readonly<{ played: number; won: number; lost: number }>; // already inside drawn
  administrative: Readonly<{ count: number; matchIds: readonly string[] }>;
  suspendedExcluded: number; // in period, not counted
}>;
```

Main functions:

```ts
fanPeriod(start: IsoDate, now: Date): FanPeriod            // throws RangeError on a non YYYY-MM-DD start
calculateHistory(index, clubId, period, filter?): { record: HistoryRecord; matches: readonly MatchView[]; coverage: CoverageNotice }
coverageNotice(index, clubIds: readonly string[], period, competitionIds: readonly string[]): CoverageNotice
classifyDominance(balance: number, thresholds = DOMINANCE_THRESHOLDS): Dominance
computeStreaks(views: readonly MatchView[]): { current: Streak | null; bestWin: Streak | null }
whatIsAtStake(record: Pick<HistoryRecord, "won" | "balance">, thresholds?, step?): AtStake
titlesInPeriod(index, clubId, period, options?: { includeUnrecognized?: boolean }): TitleInPeriod[]
pendingTitles(index, clubId, period): PendingTitle[]
headToHead(index, clubId, rivalId, period, filter?): HeadToHead        // throws RangeError when clubId === rivalId
groupRivals(index, clubId, period, filter?): RivalGroups
compareFans(index, fanA: Fan, fanB: Fan, now: Date): FanComparison     // Fan = { clubId, start }
```

`CoverageNotice`:

```ts
export type CompetitionCoverage = Readonly<{
  competitionId: string;
  status: "complete" | "partial" | "missing";
  completeFrom: IsoDate | null; // start of the complete stretch closest to the period end
  completeTo: IsoDate | null; // its end; null = ongoing
}>;
export type CoverageNotice = Readonly<{
  isComplete: boolean; // true only if every listed competition is "complete"
  competitions: readonly CompetitionCoverage[];
}>;
```

Dominance:

```ts
export const Dominance = { Dominates: "dominates", Even: "even", Dominated: "dominated" } as const;
export type Dominance = (typeof Dominance)[keyof typeof Dominance];
export type DominanceThresholds = Readonly<{ dominatesFrom: number; dominatedUpTo: number }>;
export const DOMINANCE_THRESHOLDS: DominanceThresholds = { dominatesFrom: 2, dominatedUpTo: -2 };
```

### Rules, decided here

- **Period.** `today = todayInBuenosAires(now)`; `[start, today]`, both inclusive (`isWithin`). A start after today gives `isEmpty: true`, and every function returns zero records, empty lists and `null` streaks (no date satisfies the range, so this falls out naturally; tests pin it). A match dated today counts if it is already recorded as played.
- **Counted match** = `outcomeFor(match, clubId) !== null` (existing function: suspended excluded, administrative included, shoot-out = draw). `clubView` builds the `MatchView`; the shoot-out side is derived from `home_penalties`/`away_penalties`. Suspended matches inside the period are counted in `suspendedExcluded` only, so the UI can say "N partidos suspendidos no cuentan".
- **Goals** for and against use regulation plus extra time; shoot-out goals never count. Administrative scores count in GF/GA, like they count in P/W/D/L, and are flagged.
- **Ordering.** Every list of matches is sorted by `date`, then `id`, so streaks and "last match" are deterministic when two matches share a date.
- **Filter.** `MatchFilter` restricts matches by competition id or type (needed by the `/rivales` filter). Year ranges are expressed as a narrower `FanPeriod`, not a filter.
- **Coverage notice (ADR 0003, per competition).** Relevant competitions = the competitions in the filter if given, otherwise the union of competitions with coverage rows for the club(s) and competitions of the counted matches in the period. For each one, take the `complete: true` rows of the given clubs, merge overlapping or adjacent intervals (`next.from <= nextDay(prev.to)`; `to: null` means ongoing up to today), then: `complete` if a merged interval contains `[start, end]`; `partial` if one overlaps the period; `missing` otherwise (including competitions with matches but no rows). `isComplete` is true only when every competition is `complete`. For a head-to-head the rows of **both** clubs are merged, because complete coverage of either club contains every match between them. Empty period: `{ isComplete: true, competitions: [] }` (nothing is shown; the UI handles a future start separately). An empty competition list with a non-empty period (club with no data at all) is `isComplete: false` so incomplete data is never shown as complete.
- **Dominance.** `balance >= dominatesFrom` dominates, `balance <= dominatedUpTo` dominated, otherwise even. `assertThresholds` throws `RangeError` unless `dominatedUpTo < 0 < dominatesFrom` (balance 0 must be even). Grouping: favorable = dominates, even = even, unfavorable = dominated.
- **Streaks.** `current` is the run of identical outcomes (W, D or L) ending at the latest match, with `{ outcome, length, from, to }`. `bestWin` is the longest run of W; on a tie in length the **earliest** run is kept (the record is set by the first, equaling it does not beat it). No matches gives `null` for both; no wins gives `bestWin: null`.
- **What is at stake.** Assuming no draws (draws do not move the balance): if even, `winsToImprove = dominatesFrom - balance` (target dominates); if dominated, `winsToImprove = dominatedUpTo + 1 - balance` (target even); if dominates, `null`. Symmetric `lossesToWorsen`: even -> `balance - dominatedUpTo` (target dominated); dominates -> `balance - (dominatesFrom - 1)` (target even); dominated -> `null`. `nextWinMilestone = { milestone, winsNeeded }` with `milestone` the next multiple of `WIN_MILESTONE_STEP` strictly above `won`. Numbers only; the Spanish sentences are UI.
- **Finals.** Legs with `is_final: true` are grouped into a series by `(season_id, unordered club pair)`. Winner: if the last counted leg was decided on penalties, the shoot-out winner (methodology: in finals the shoot-out winner wins the final); otherwise the higher aggregate of regulation plus extra time goals; otherwise `null` (undetermined, test it). A series belongs to the period when its last counted leg is inside the period. Suspended legs are ignored. By default only finals of recognized competitions (approval item 2).
- **Titles.** `titlesInPeriod`: titles of the club with `awarded_on` inside the period; by default only competitions with `afa_recognized: true`; with `includeUnrecognized: true` all of them, each item carrying `recognized: boolean` plus `competition`, `season`, `shared`, `source`, `shelf` and `decidingMatch`. Sorted by `awarded_on`, then id. `trophyShelf(competition)`: `type === "other"` -> `"other"`; otherwise `scope === "international"` -> `"international"`; otherwise `"domestic"` (the three vitrina shelves). `decidingMatch(index, title)`: for cups and international competitions the last counted final leg of the club in that season; for leagues the club's last counted match of the season dated on or before `awarded_on`; `null` when none exists.
- **Pending titles** (approval item 4): recognized competitions with a season overlapping the period, minus those with a title of the club in the period, each with `{ competition, shelf, seasonsInPeriod }`, sorted by shelf then competition id.
- **Head-to-head.** `headToHead` returns `{ clubId, rivalId, record, dominance, lastMatch, currentStreak, bestWinStreak, biggestWin, biggestLoss, finals, competitionIds, rivalry, atStake, coverage }` where `rivalry` is the matching `rivalries` row in either order or `null`, `competitionIds` lists the competitions actually included (ADR 0003: a head-to-head must say what it includes), and coverage merges both clubs' rows.
- **Rival grouping.** `groupRivals` builds one row per opponent with at least one counted match in the period: `{ rivalId, record, dominance, isClassic }`, in three groups plus `all`, each sorted by balance desc, played desc, rival id asc (name sorting needs Spanish collation and stays in the UI). It carries the club's coverage notice once.
- **Compare fans.** Each fan's side is computed over that fan's own period. Categories are those of approval item 6, each `{ id, a, b, better: "higher" | "lower", winner: "a" | "b" | "tie" | "not_applicable" }`; the scoreboard is `{ a, b, ties }` counts. Classics balance = sum of balances against every `is_classic: true` rival in the period (`null` when the club has none). Relegations = `movements` of type `relegation` with `date` inside the period. Best streak = `bestWin.length` over all counted matches (0 when none). The direct head-to-head uses `fanPeriod(laterStart(a.start, b.start), now)` from fan A's club perspective; when both fans have the same club it is `null` with `reason: "same_club"`. Each side carries its own coverage notice. No total or weighted score is produced anywhere.

### Discarded alternatives

- **Compute in SQL (views or functions)**: duplicates the methodology in two languages; see ADR 0010.
- **One big `stats.ts` module**: harder to reach and audit 100% branch coverage, and to review rule by rule.
- **TypeScript `enum` for dominance**: not erasable syntax, worse serialization; `as const` object plus union is used instead.
- **Passing the validator's `Dataset` (keyed by file names) directly**: leaks file names into the engine; a small `statsDataFrom` adapter keeps the engine independent of the file layout.
- **Throwing on a future start date**: a future date is valid user input in the onboarding picker; returning an empty period with `isEmpty: true` lets the UI show a friendly message without try/catch.
- **Counting shared titles as half**: not how titles are counted officially (approval item 3).
- **Deciding the final winner from the `titles` table**: not every final awards a title in the dataset (and coverage of titles and matches differ); the match data is enough and it is testable.
- **Including the direct head-to-head as a scoreboard category**: it is a different period (later start) than the other categories, so mixing them would be unfair; it is shown alongside.

## Tasks

Each task: write the failing test first, then the minimum code, then refactor. Tests live in `tests/unit/domain/<module>.test.ts` unless stated. Run `pnpm test:coverage` at the end of each group.

### Group A: foundations

- [ ] **T0 Approval.** Diego answers the 8 items of "Approval needed". T1 to T13 and T17 to T19 do not depend on them; T14 to T16 depend on items 2 to 4 and 8, T18 on item 5, T12 on item 7, T20 to T21 on item 6. Item 1 decides how the issue is closed.
- [ ] **T1 `nextDay`.** Test in `tests/unit/data-model/dates.test.ts`: `2020-01-31 -> 2020-02-01`, `2020-02-28 -> 2020-02-29` (leap), `2021-02-28 -> 2021-03-01`, `2026-12-31 -> 2027-01-01`. Then add `nextDay` to `src/data-model/dates.ts` using `Date.UTC` (no local time zone).
- [ ] **T2 Period.** `tests/unit/domain/period.test.ts`: start equal to a match date includes it (inclusive start); end is today in Buenos Aires (`now = 2026-10-16T02:30:00Z` gives end `2026-10-15`; `03:00Z` gives `2026-10-16`); start in the future gives `isEmpty: true`; start equal to today is not empty; `inPeriod` bounds; `laterStart` both orders and equal; invalid start (`"2026-13-01"`, `"16/10/2026"`) throws `RangeError`. Then `src/domain/types.ts` (period types) and `src/domain/period.ts`.
- [ ] **T3 Data index.** `tests/unit/domain/data.test.ts`: `statsDataFrom(validDataset())` maps each file to its field; `buildStatsIndex` sorts each club's matches by date then id (two matches on the same date in different competitions), includes matches where the club is home or away, includes suspended ones (they are filtered later), a club with no matches is absent from `matchesByClub`; `competitionOf` resolves through the season and throws on an unknown season (data is validated upstream). Then `src/domain/data.ts` and the remaining `types.ts` entries.
- [ ] **T4 Match view.** Extend `tests/unit/domain/match-outcome.test.ts`: `clubView` for home and away perspective (goals swapped), shoot-out won and lost from each side, administrative flag true/false, `null` for suspended and for a club not in the match, `rivalId` correct. Then `clubView` in `src/domain/match-outcome.ts`.
- [ ] **T5 Fixtures.** Export the match builder from `tests/fixtures/data-model/dataset.ts` (rename to `makeMatch`, plus `makeTitle`, `makeCompetition`, `makeSeason`, `makeCoverage`). Create `tests/fixtures/domain/stats-world.ts`: `statsWorld()` extends `validDataset()` with fictional data only (`fixture:synthetic`, header comment "FICTIONAL"): an international competition `intl-z` (`scope: "international"`), a disputed competition `league-old` (`afa_recognized: false`) with a title for `club-a`, a shared title (two clubs, both `shared: true`), a two-leg final between `club-a` and `club-b` decided on aggregate and another decided on penalties in the second leg, a run of club-a vs club-b matches across 2021 to 2024 with a 3-win streak, two equal-length win streaks for tie tests, a big played win and an administrative 3-0, a relegation of `club-b`, a classic rivalry `club-c`~`club-d`, and coverage rows: club-a complete from 2020-01-01 in league-x, club-b complete only from 2022-01-01, two adjacent rows for club-c that must merge. Test `tests/unit/domain/stats-world.test.ts`: `validate(statsWorld(), { now: FIXED_NOW })` returns `[]`, so engine fixtures are always valid data.

### Group B: history and coverage

- [ ] **T6 Tally.** `tests/unit/domain/history.test.ts` (`tallyMatches`): empty list gives all zeros; win/draw/loss; GF/GA with extra time; a shoot-out is a draw and increments `shootouts.played` and `won` or `lost` for the right side; administrative counts in P/W/D/L and appears in `administrative.matchIds`; `balance = won - lost` with draws not changing it. Then `tallyMatches` in `src/domain/history.ts`.
- [ ] **T7 Coverage intervals.** `tests/unit/domain/coverage-notice.test.ts` (`mergeCompleteIntervals`): ignores `complete: false`; merges overlapping and adjacent (`to` then `nextDay(to)`) rows; keeps a gap of one day apart; `to: null` absorbs later rows; unsorted input. Then the helper in `src/domain/coverage-notice.ts`.
- [ ] **T8 Coverage notice.** Same file (`coverageNotice`): start before `from` gives `partial` with `completeFrom`; start on `from` gives `complete`; period end after a closed `to` gives `partial` (the 2025-05-04 case of ADR 0003); a competition with matches and no rows is `missing`; rows of an unrelated club are ignored; two clubs where only the second is complete gives `complete`; competition filter restricts the list; empty period gives `isComplete: true` and no competitions; non-empty period with no competitions at all gives `isComplete: false`.
- [ ] **T9 `calculateHistory`.** `history.test.ts`: on `statsWorld()` for `club-a`, the exact P/W/D/L, GF/GA, balance; start inclusive (a match on the start date counts, one the day before does not); a match after today (BA) is excluded; suspended counted only in `suspendedExcluded`; `MatchFilter` by competition id and by type; club with no matches gives zeros and `coverage.isComplete: false`; future start gives zeros; fan start before any data gives the same numbers as start on the first match plus a `partial` notice; result `matches` sorted. Then `calculateHistory`.

### Group C: dominance, streaks, what is at stake

- [ ] **T10 Dominance.** `tests/unit/domain/dominance.test.ts`: table-driven -3, -2, -1, 0, +1, +2, +3 with default thresholds; custom thresholds (`{ dominatesFrom: 3, dominatedUpTo: -3 }`) move the edges; `assertThresholds` rejects `dominatedUpTo >= 0`, `dominatesFrom <= 0`; `classifyDominance` with invalid thresholds throws; `DOMINANCE_THRESHOLDS` equals `{ dominatesFrom: 2, dominatedUpTo: -2 }` (pins the methodology). Then `src/domain/dominance.ts`.
- [ ] **T11 Streaks.** `tests/unit/domain/streaks.test.ts`: empty gives `{ current: null, bestWin: null }`; one match; current streak of W, of D, of L with correct `from`/`to`; a shoot-out breaks a win streak (it is a draw); best win streak in the middle; two equal win streaks keep the earliest; no wins gives `bestWin: null`; current and best can be the same run. Then `src/domain/streaks.ts`.
- [ ] **T12 What is at stake.** `tests/unit/domain/at-stake.test.ts`: balance -3 needs 2 wins to be even; -2 needs 1; 0 needs 2 to dominate; +1 needs 1; +2 has `winsToImprove: null` and `lossesToWorsen` 1; dominated has `lossesToWorsen: null`; milestones: 0 wins -> 10 needs 10, 29 -> 30 needs 1, 30 -> 40 needs 10; custom thresholds and step. Then `src/domain/at-stake.ts`.

### Group D: finals and titles

- [ ] **T13 Finals.** `tests/unit/domain/finals.test.ts`: single-leg final won; shoot-out final won by the shoot-out winner even though it is a draw in P/W/D/L; two-leg on aggregate; two-leg with penalties in the second leg; aggregate tie without penalties gives winner `null`; suspended leg ignored; series straddling the period start belongs to the period of its last leg; only recognized competitions by default; non-final matches ignored. Then `src/domain/finals.ts`.
- [ ] **T14 Titles in period.** `tests/unit/domain/titles.test.ts`: `trophyShelf` for each type and scope; title on the start date counts, the day before does not, after today does not; unrecognized competition excluded by default and included with `recognized: false` when `includeUnrecognized`; shared title counted once for each co-champion with `shared: true`; sort order; future start gives `[]`. Then `trophyShelf`, `isRecognized`, `titlesInPeriod` in `src/domain/titles.ts`.
- [ ] **T15 Deciding match.** Same file: cup title returns the last final leg of the club; league title returns the match on `awarded_on`, or the last counted match before it; a suspended match is never returned; no matches gives `null`. Then `decidingMatch`.
- [ ] **T16 Pending titles.** Same file: competition with a season in the period and no title is pending; won competition is not; competition whose seasons are all before the period is not; unrecognized competition is not; season straddling the period start counts as overlapping; `seasonsInPeriod` count; future start gives `[]`. Then `pendingTitles`.

### Group E: rivalries

- [ ] **T17 Head-to-head, record.** `tests/unit/domain/head-to-head.test.ts`: on `statsWorld()` club-a vs club-b: record, dominance, `lastMatch` (latest by date then id), `competitionIds`, `rivalry` found in either order and `null` for a non-rival, coverage merges both clubs; same club throws `RangeError`; no matches gives zero record, `lastMatch: null`, dominance even. Then the first half of `src/domain/head-to-head.ts`.
- [ ] **T18 Head-to-head, details.** Same file: `currentStreak` and `bestWinStreak` from the pair's matches only; `biggestWin` and `biggestLoss` by margin, then goals for, then most recent; administrative 3-0 and shoot-outs never chosen; `null` when there is no win or no loss; `finals` between the two only (a final against another club is excluded); `atStake` matches `whatIsAtStake(record)`. Then complete `headToHead`.
- [ ] **T19 Rival grouping.** `tests/unit/domain/rivals.test.ts`: every opponent with a counted match appears once; a rival with only suspended matches does not; groups by dominance; sort by balance, played, id; `isClassic` from `rivalries` with `is_classic: true` (false for `is_classic: false` rows); filter by competition; club with no matches gives empty groups. Then `src/domain/rivals.ts`.

### Group F: compare fans

- [ ] **T20 Fan summary.** `tests/unit/domain/compare-fans.test.ts` (`fanSummary`): total, international and domestic titles (recognized only; `other` shelf counts in total but not in international or domestic); finals won and played; classics balance (sum over classic rivals; `null` when the club has none); relegations in period only; best streak length (0 with no matches). Then `fanSummary` in `src/domain/compare-fans.ts`.
- [ ] **T21 Scoreboard and direct head-to-head.** Same file: winner per category for higher-is-better and for relegations (lower is better); tie gives no point; `not_applicable` when either side has `null`; scoreboard counts `{ a, b, ties }`; no field adds categories into one number (assert the result keys); direct head-to-head uses the later start (a match between the two clubs dated between the two starts is excluded) and fan A's perspective; swapping fans mirrors the result; same club gives `headToHead: null` with `reason: "same_club"` and still a scoreboard; each side carries its coverage. Then `compareFans`.

### Group G: wrap-up

- [ ] **T22 Integration.** `tests/integration/stats-engine.test.ts`: from `statsWorld()` through `statsDataFrom` and `buildStatsIndex` to `calculateHistory`, `groupRivals`, `headToHead` and `compareFans` for two fans with `FIXED_NOW`; checks the cross-function invariants: `won + drawn + lost === played`; the sum of every rival row equals the club's history; dominance of each rival row equals `headToHead(...).dominance`; input arrays are not mutated (deep-frozen input).
- [ ] **T23 Methodology.** Add a "Statistics engine" section to `docs/methodology.md` documenting the rules decided here (goals and administrative scores, coverage notice per competition with both clubs merged for a head-to-head, streak tie rule, biggest win tie-break, final series winner, recognized titles, shared titles, pending titles, comparison categories, milestone step) and the name mapping table. Update ADR 0010 status if Diego accepts it.
- [ ] **T24 Final check.** `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain/**` and `src/data-model/**`), `pnpm build`. Set this plan's status to `done`. Ask the orchestrator to open the follow-up issue for real verified golden fixtures (approval item 1).

## Tests to write

- **Unit** (`tests/unit/domain/`): `period`, `data`, `match-outcome` (extended), `history`, `coverage-notice`, `dominance`, `streaks`, `at-stake`, `finals`, `titles`, `head-to-head`, `rivals`, `compare-fans`, `stats-world`; plus `nextDay` in `tests/unit/data-model/dates.test.ts`. One `describe` per methodology rule, named after the rule, so each rule of section 3.4 has visible tests.
- **Integration** (`tests/integration/stats-engine.test.ts`): end-to-end engine flow on the synthetic world, invariants and immutability.
- **E2E:** none (no UI).

### Edge cases

- Fan start before any data: same numbers as from the first match, notice `partial`.
- Start date in the future: `isEmpty`, zeros, empty lists, `null` streaks, no pending titles.
- Start date equal to today; match or title dated exactly on the start date (counts) or the day before (does not).
- Time zone: 00:00 to 02:59 UTC is still the previous day in Buenos Aires.
- Club with no matches: zero record, no rivals, `null` streaks, `isComplete: false`.
- Same club comparison: no direct head-to-head, scoreboard still computed; `headToHead` with the same id throws.
- Ties in streak length (earliest kept), ties in biggest win (margin, goals, recency), ties in comparison categories (no point).
- Shoot-outs: draw in P/W/D/L, recorded apart, break win streaks, never "biggest win", decide finals.
- Suspended matches: not counted anywhere, reported in `suspendedExcluded`; suspended final leg ignored.
- Administrative results: counted, flagged, excluded from biggest win and loss.
- Two matches on the same date (different competitions): deterministic order by id.
- Two-leg final with aggregate tie and no shoot-out: winner `null`.
- Coverage: adjacent rows merge, a one-day gap does not; `to: null`; a closed `to` before today; competition with matches but no coverage rows.
- Dominance thresholds edges (+2, +1, -1, -2) and invalid custom thresholds.
- Milestones at exact multiples.
- Input arrays are never mutated.

## Impact

- **Data:** none changed. All fixtures are fictional (`club-a`..`club-d`, `fixture:synthetic`) and pass `validate()`. Requirements surfaced for issue #8 (approval item 2): official international competitions need `afa_recognized: true`; disputed tournaments are separate competitions with `false`; coverage rows must exist (even with `complete: false`) for every competition a club played, so the notice can list it.
- **Design:** none directly. The engine returns typed values (`Dominance`, shelves, coverage status, `isAdministrative`, `shared`, `recognized`, `isEmpty`) that #15 and #16 turn into Spanish copy, marks and notices.
- **Security and privacy:** pure functions, no I/O, no secrets. The fan start date (often a birth date) is only an argument; nothing is stored or logged by the engine.
- **Performance:** `buildStatsIndex` is O(n log n) once; every function works on one or two clubs' sorted lists (a few thousand matches), O(n) with `Map` lookups. `groupRivals` is a single pass grouping by rival, not one `headToHead` per rival. No performance test needed; T22 runs on the whole fixture.

## Risks

- **Product interpretation** (pending titles, comparison categories, recognition, biggest win): mitigated by T0 and by isolating each rule in its own small function so a change is local.
- **Acceptance criterion on real verified fixtures** cannot be met before #8: mitigated by approval item 1 and the follow-up issue.
- **Coverage data shape from #12** may differ (for example rows per season instead of ranges): the interval merge handles both; T8 tests adjacent rows.
- **Final series grouping** assumes both legs share `season_id` and `is_final`; if real data stores legs differently, the series test catches it once golden tests exist.
- **Coverage thresholds drop below 100% branches** in `src/domain`: CI enforces it (`vitest.config.ts` already has the threshold).
- **Dependency cycles** between domain modules: the layering above is one-directional; lint and typecheck verify.

## Done when

- All tasks are checked and every acceptance criterion maps to at least one named test (except the real-fixture criterion, deferred by Diego's decision to a follow-up issue).
- `pnpm test:coverage` passes with 100% branches in `src/domain/**` and `src/data-model/**`; lint, typecheck and build are green.
- `docs/methodology.md` documents every rule decided here, and ADR 0010 is accepted or adjusted by Diego.
- No UI, Supabase or Spanish label code was added.
