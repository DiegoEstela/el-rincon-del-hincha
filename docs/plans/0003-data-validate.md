---
issue: 9
status: pending
date: 2026-10-16
---

# Plan 0003: Data model schemas and every `pnpm data:validate` rule

Related ADRs: [0003](../adr/0003-data-sources.md) (data sources, on branch `docs/5-data-sources-spike`), [0009](../adr/0009-data-model-naming.md) (English data model names, new in this plan).

## Goal

Bad data silently breaks every stat. Turn the Phase 0 stub `scripts/validate-data.ts` into the real gate that runs in CI (`ci.yml`, job `data`) and in every data PR (`data-update.yml`): typed Zod schemas for every entity of section 3.3, a pure validator implementing every rule of section 3.5, and a thin CLI that exits 1 on any issue.

## Acceptance criteria (copied from issue #9)

- Given two matches with the same date, clubs and competition, when validating, then it fails (duplicate).
- Given a match whose club is missing from `clubs`, or home and away are the same club, when validating, then it fails.
- Given negative goals, a played match dated in the future, or a date outside its season range, when validating, then it fails.
- Given a title in a season with complete coverage and no supporting final or last matchday, when validating, then it fails.
- Given a season with two champions not marked `compartido`, when validating, then it fails.
- Given a club where PG+PE+PP differs from PJ, when validating, then it fails.
- Given any record without `fuente`, when validating, then it fails.
- Given each rule above, when tests run, then each has at least one failing and one passing fixture.

Out of scope: fixing the data reported by the validator.

Per ADR 0009, `compartido` is `shared` and `fuente` is `source` in the data model.

## Approval from Diego (all five items approved on 2026-10-16)

Items 1 and 5 follow the language policy and the cheap extra rules; items 2, 3 and 4 were answered explicitly: add `standings.json`, league title support means the club played at least one counted match that season, and `hoops` means horizontal stripes.

Original list:

1. **ADR 0009**: English field, file and enum names instead of the Spanish names of section 3.3; `source` required on every entity (section 3.3 only lists it on matches and titles); `awarded_on` instead of methodology's `consecration_date` (methodology gets renamed in this PR).
2. **New optional file `standings.json`** (source-backed P/W/D/L per club and season). Without an independent source of totals, "W+D+L = P" computed from matches is a tautology and the "failing fixture" criterion cannot be met honestly. If rejected: fall back to the internal invariant only and document that the failing fixture tests the tally function directly.
3. **Interpretation of "supporting final or last matchday"** (rule `title-without-support`), see rule 4 in the rules table below.
4. **Jersey pattern enum** mapping (`bastones` -> `vertical_stripes`, `banda` -> `sash`, `franjas` -> `hoops`). Confirm `franjas` means horizontal stripes.
5. **Extra rules beyond the issue** (cheap, prevent cascades): `schema`, `unknown-file`, `duplicate-id`, `unknown-reference`, `missing-score`, `penalties-inconsistent`, `invalid-season-range`. Diego may drop any of them.

## Approach

### Layers

```
data/*.json --(fs, JSON.parse)--> scripts/validate-data.ts (thin CLI, I/O only)
                                       |
                                       v  RawDataset = Record<string, unknown>
                     src/data-model/validate.ts  validate(raw, { now }) -> ValidationIssue[]
                       |-- src/data-model/schemas.ts  (Zod, strict, one schema per entity)
                       |-- src/data-model/dates.ts    (todayInBuenosAires, date compare)
                       |-- src/data-model/rules/*.ts  (one pure function per rule family)
                       '-- src/domain/match-outcome.ts (methodology result rule, reused later by stats)
```

- `src/data-model/` is pure: no `fs`, no `process`, no `Date.now()`. The clock is injected (`now: Date`). Importable by scripts, by `src/domain` (types) and by the seed script later.
- `src/domain/match-outcome.ts` holds the methodology rule "penalty shoot-out counts as a draw; suspended does not count; administrative counts". It is business logic, so it goes in `src/domain` (100% branches already enforced) and is reused by the future stats engine. It only imports types from `src/data-model`.

### Data model (ADR 0009)

One file per entity, root is a JSON array. Dates are `YYYY-MM-DD` strings (`z.iso.date()`), interpreted as calendar dates in America/Argentina/Buenos_Aires; plain-date string comparison is then correct and timezone-free.

| File                | Fields                                                                                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clubs.json`        | `id` (slug), `name`, `short_name`, `aliases[]`, `colors {primary, secondary, tertiary?}` (hex `#RRGGBB`), `jersey_pattern` (`solid`, `vertical_stripes`, `sash`, `hoops`, `halves`, `other`), `founded` (year int), `city`, `source`                                                                            |
| `competitions.json` | `id`, `name`, `type` (`league`, `national_cup`, `international`, `other`), `scope` (`domestic`, `international`), `organizer`, `afa_recognized`, `notes?`, `source`                                                                                                                                             |
| `seasons.json`      | `id`, `competition_id`, `name`, `start`, `end`, `source`                                                                                                                                                                                                                                                        |
| `matches.json`      | `id`, `season_id`, `date`, `home_id`, `away_id`, `home_goals`, `away_goals` (int or null), `decision` (`null`, `penalties`, `extra_time`), `home_penalties`, `away_penalties` (int or null), `stage` (free string), `is_final`, `status` (`played`, `suspended`, `administrative_result`), `source`, `verified` |
| `titles.json`       | `id`, `club_id`, `competition_id`, `season_id`, `awarded_on`, `shared`, `source`, `verified`                                                                                                                                                                                                                    |
| `movements.json`    | `id`, `club_id`, `type` (`relegation`, `promotion`), `date`, `season_id`, `source`                                                                                                                                                                                                                              |
| `rivalries.json`    | `club_a`, `club_b`, `is_classic`, `name?`, `source`                                                                                                                                                                                                                                                             |
| `coverage.json`     | `club_id`, `competition_id`, `from`, `to` (date or null = ongoing), `complete`, `source`                                                                                                                                                                                                                        |
| `standings.json`    | `club_id`, `season_id`, `played`, `won`, `drawn`, `lost`, `source` (optional file, pending approval)                                                                                                                                                                                                            |

All schemas use `z.strictObject`. Types are `z.infer` exports in `src/data-model/types.ts`. A missing file is an empty array (so an empty `data/` passes, as in Phase 0).

### Issue type

```ts
export type ValidationIssue = {
  rule: RuleId; // e.g. "duplicate-match"
  file: DatasetFile | string; // "matches.json"
  recordId: string | null; // record id, or a composite key for id-less entities
  message: string; // English, actionable
};
export function validate(raw: Record<string, unknown>, options: { now: Date }): ValidationIssue[];
```

Composite record ids: rivalries `club_a~club_b`, coverage `club_id/competition_id/from`, standings `club_id/season_id`. When a record has no usable id, use `#<index>`. Output is sorted by file, record id, rule, so CLI output and snapshots are deterministic.

### Pipeline

1. **Shape stage.** For each known file: root must be an array (`schema` issue otherwise); each record is parsed with its schema. Zod issues whose path starts with `source` map to rule `missing-source`; any other Zod issue maps to `schema` with the path in the message. Unknown file keys produce `unknown-file`. Records that fail shape are **excluded** from later stages, so one broken record does not cascade into dozens of issues.
2. **Reference stage.** Build id maps. `duplicate-id` per file; `unknown-club` for match `home_id`/`away_id`; `unknown-reference` for every other foreign key (season, competition, club in titles, coverage, movements, rivalries, standings) and for a title whose `season.competition_id` differs from `title.competition_id`.
3. **Semantic stage.** The rules below, on valid records only (a match with an unknown season is skipped by season-dependent rules).

### Rules (section 3.5 plus the extras listed above)

| #   | Rule id                  | Fails when                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `duplicate-match`        | Two matches share `date`, competition (via season) and the **unordered** club pair. One issue per extra record, naming the first id.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2a  | `unknown-club`           | `home_id` or `away_id` not in `clubs`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2b  | `same-club`              | `home_id === away_id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3a  | `negative-goals`         | Any of `home_goals`, `away_goals`, `home_penalties`, `away_penalties` is negative.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3b  | `future-played-match`    | `status` is `played` or `administrative_result` and `date > todayInBuenosAires(now)`. A match dated today is allowed.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3c  | `date-outside-season`    | `date < season.start` or `date > season.end` (inclusive range).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 4   | `title-without-support`  | The title's club has a `coverage` row with `complete: true` for the title's competition that contains the whole season (`from <= start` and `to` null or `>= end`), and no supporting match exists. Supporting match: a counted match of that season involving the club with `is_final: true`; for `league` competitions (no finals) also the club's last counted match of the season ("last matchday"). Proposed simplification, see approval item 3: for leagues this means "the club played at least one counted match in that season". |
| 5   | `unshared-co-champions`  | A `season_id` has two or more titles and at least one of them has `shared: false`. One issue per offending title.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 6a  | `control-totals`         | A `standings` row where `won + drawn + lost !== played`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 6b  | `standings-mismatch`     | The club has complete coverage for the season (same containment as rule 4) and the P/W/D/L tallied from matches with `match-outcome` differ from the `standings` row.                                                                                                                                                                                                                                                                                                                                                                      |
| 7   | `missing-source`         | `source` missing, not a string, or blank after trim, in any record of any file.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| x   | `schema`                 | Shape error (types, enums, unknown key such as `fuente`, invalid date like `2026-02-30`, root not an array).                                                                                                                                                                                                                                                                                                                                                                                                                               |
| x   | `unknown-file`           | A key/file name that is not part of the model (catches typos like `match.json`).                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| x   | `duplicate-id`           | Two records with the same `id` (or composite key) in one file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| x   | `unknown-reference`      | Foreign key not found, or title competition differs from its season's competition.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| x   | `missing-score`          | `played` or `administrative_result` with null goals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| x   | `penalties-inconsistent` | `decision: "penalties"` without both penalty counts, or with unequal goals, or with tied penalties; or penalty counts present when `decision` is not `penalties`.                                                                                                                                                                                                                                                                                                                                                                          |
| x   | `invalid-season-range`   | `season.start > season.end`, or `coverage.from > coverage.to`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Tally (for 6b), from `src/domain/match-outcome.ts`: `suspended` is excluded; `played` and `administrative_result` count; result from `home_goals`/`away_goals` (regulation plus extra time); `decision: "penalties"` counts as a draw.

### CLI (`scripts/validate-data.ts`)

- Reads `process.argv[2] ?? "data"` relative to `cwd` (the argument exists only so the integration test can point at fixture dirs; CI keeps calling `pnpm data:validate` with no argument).
- Lists `*.json`, `JSON.parse` each into `raw[file]`; a parse error becomes an `invalid-json` issue (the only rule that lives in the CLI, because it is I/O).
- Calls `validate(raw, { now: new Date() })`, prints `[rule] file#recordId: message` per issue to stderr and exits 1; otherwise prints `data:validate ok (N file(s) checked)` and exits 0. `data/` with only `.gitkeep` keeps the Phase 0 behavior: ok, 0 files.

### Discarded alternatives

- **Spanish field names as in section 3.3**: breaks the CLAUDE.md language policy and mixes languages in every type (ADR 0009).
- **Validator inside the script**: not testable without I/O, cannot reach 100% branches, and cannot be reused by seed/ingest.
- **Required `source` enforced only by Zod as a generic shape error**: loses the dedicated rule id the issue asks for. We keep strict types and remap the Zod path instead of making `source` optional in the type.
- **Datetime with offset for match dates**: kickoff times are often unknown in historical sources; a plain BA calendar date avoids timezone bugs. Kickoff time can be added later as an optional field.
- **Fail-fast (stop at first issue)**: a data PR author wants the full list at once.
- **Computing W+D+L = P only from matches**: always true by construction, so it can never fail (see approval item 2).
- **JSON Schema / ajv**: Zod is already a dependency and gives TypeScript types for free.

## Tasks

Each task: write the failing test first, make it pass, keep `pnpm lint` and `pnpm typecheck` green. Ordered; each one is at most about 1 h.

- [x] **T0 Approval.** Diego approves ADR 0009 and the five items of "Approval needed" (or adjusts). Set ADR 0009 status to Accepted.
- [x] **T1 Coverage config.** Add `"src/data-model/**/*.ts"` to `coverage.include` and `"src/data-model/**": { branches: 100 }` to `thresholds` in `vitest.config.ts`. Justification: `src/data-model` is pure, it is the gate for every stat, and an untested branch there means a class of bad data reaches production. Verify by running `pnpm test:coverage` after T2 (it must fail if a branch is left uncovered, then pass).
- [x] **T2 Dates.** Test first `tests/unit/data-model/dates.test.ts`: `todayInBuenosAires(new Date("2026-10-16T02:30:00Z"))` is `"2026-10-15"`; `"2026-10-16T03:00:00Z"` is `"2026-10-16"`; year boundary `2027-01-01T02:59:59Z` is `"2026-12-31"`; `isAfter`, `isWithin(date, start, end)` inclusive bounds. Then `src/data-model/dates.ts` (Intl.DateTimeFormat `en-CA`, `timeZone: "America/Argentina/Buenos_Aires"`).
- [x] **T3 Schemas: clubs, competitions, seasons.** Tests in `tests/unit/data-model/schemas.test.ts`: a valid synthetic record parses; each enum rejects an unknown value; hex color rejects `red`; `founded` rejects non-integers; unknown key `fuente` is rejected (strict); `source: "  "` is rejected; `2026-02-30` rejected for `start`. Then `src/data-model/schemas.ts` for these three.
- [x] **T4 Schemas: matches and titles.** Same test style: nullable goals and penalties, `decision` enum including `null`, `status` enum, `verified` boolean required, `shared` required.
- [x] **T5 Schemas: movements, rivalries, coverage, standings; dataset registry.** Tests for each, plus `DATASET_FILES` lists exactly the nine files and `recordKey(file, record)` returns ids or composite keys. Then `src/data-model/types.ts` (`z.infer` exports, `ValidationIssue`, `RuleId` union).
- [x] **T6 Fixture factory.** `tests/fixtures/data-model/dataset.ts`: `validDataset()` returns a fresh deep copy of a small synthetic world (clubs `club-a`, `club-b`, `club-c`, `club-d` named "Club Ficticio A".."D"; competitions `league-x` (league) and `cup-y` (national_cup); seasons in 2020-2021; a handful of matches including a cup final decided on penalties, one suspended and one administrative result; one title per competition; coverage complete for `club-a`; standings consistent with the matches; every `source` is `"fixture:synthetic"`). Plus `FIXED_NOW = new Date("2026-10-16T15:00:00Z")`. A header comment states it is fictional. Test: `validate(validDataset(), { now: FIXED_NOW })` returns `[]` (written now, passes once T7 to T14 land; mark it `it.todo` until T7 if needed).
- [x] **T7 Validator skeleton: shape stage.** Tests in `tests/unit/data-model/validate.test.ts`: empty object -> `[]`; root not an array -> `schema`; unknown key `match.json` -> `unknown-file`; record missing `source` in each of the nine files -> `missing-source` with correct file and record id (table-driven); record with `fuente` instead of `source` -> both `schema` (unknown key) and `missing-source`; invalid record is excluded from later stages (no cascade); output order is deterministic. Then `src/data-model/validate.ts`.
- [x] **T8 References.** Tests in `tests/unit/data-model/rules/references.test.ts` (fail and pass for each): `duplicate-id`, `unknown-club` (home and away separately), `same-club`, `unknown-reference` (season of a match, competition of a season, club and season of a title, coverage club, rivalry club, standings season), title competition differing from its season's competition. Then `src/data-model/rules/references.ts`.
- [x] **T9 Scores.** `tests/unit/data-model/rules/scores.test.ts`: `negative-goals` (each of the four fields), `missing-score` (played and administrative fail, suspended with null passes), `penalties-inconsistent` (all four failure modes, plus valid penalties and valid `extra_time`). Then `src/data-model/rules/scores.ts`.
- [ ] **T10 Dates rules.** `tests/unit/data-model/rules/dates.test.ts`: `future-played-match` (tomorrow in BA fails; today passes; future `suspended` passes; the 02:30Z edge where UTC already says tomorrow but BA does not), `date-outside-season` (day before start and day after end fail; start and end themselves pass), `invalid-season-range` (season and coverage). Then `src/data-model/rules/dates.ts`.
- [ ] **T11 Duplicate match.** `tests/unit/data-model/rules/duplicate-match.test.ts`: same date, same pair, same competition fails; swapped home/away fails; same pair same date in different competitions passes; same pair same competition different date passes; three copies give two issues. Then `src/data-model/rules/duplicate-match.ts`.
- [ ] **T12 Co-champions.** `tests/unit/data-model/rules/titles.test.ts`: two titles in one season with one `shared: false` fails (issue on that title only); both `shared: true` passes; single title passes; single title with `shared: true` passes (co-champion may be outside the dataset). Then `unshared-co-champions` in `src/data-model/rules/titles.ts`.
- [ ] **T13 Title support.** Same test file: complete coverage and no match fails; complete coverage and a final involving the club passes; league with complete coverage and a counted match passes; league with only a suspended match fails; incomplete coverage (`complete: false`) and no match passes; coverage that ends before the season end passes (not contained); coverage with `to: null` contains the season. Then `title-without-support` plus a shared `isSeasonFullyCovered(coverage, clubId, competitionId, season)` helper in `src/data-model/coverage.ts` with its own tests.
- [ ] **T14 Match outcome (domain).** `tests/unit/domain/match-outcome.test.ts`: home win, away win, draw, penalties counts as draw for both sides, extra time result counts as is, suspended is not counted, administrative counts. Then `src/domain/match-outcome.ts` (`outcomeFor(match, clubId): "W" | "D" | "L" | null`) and `tallyClubSeason(matches, clubId, seasonId)`.
- [ ] **T15 Control totals.** `tests/unit/data-model/rules/standings.test.ts`: `control-totals` (10 = 3+3+3 fails, 9 = 3+3+3 passes), `standings-mismatch` (complete coverage and different W fails; equal passes; incomplete coverage with different numbers passes). Then `src/data-model/rules/standings.ts`. Turn the T6 "valid dataset has no issues" test green.
- [ ] **T16 Rule catalogue test.** `tests/unit/data-model/catalogue.test.ts`: for every `RuleId` except `invalid-json` there is at least one fixture mutation that produces exactly that rule and the baseline produces none (a table `[ruleId, mutate(dataset)]`). This guards the last acceptance criterion and fails when a new rule is added without fixtures.
- [ ] **T17 CLI.** Fixture dirs `tests/fixtures/data-validate/{empty,valid,invalid,broken-json}/` (synthetic, `"fixture:synthetic"` sources; `empty` contains only `.gitkeep`). Integration test `tests/integration/validate-data-cli.test.ts` runs `process.execPath` with `--import tsx scripts/validate-data.ts <dir>` from the repo root: empty -> exit 0, "0 file(s)"; valid -> exit 0; invalid -> exit 1 and stderr lists `[duplicate-match]` and `[missing-source]`; broken JSON -> exit 1 with `[invalid-json]`. Then rewrite `scripts/validate-data.ts`. Confirm `pnpm data:validate` on the real `data/` (only `.gitkeep`) prints ok.
- [ ] **T18 Docs.** Add a "Data validation" section to `docs/methodology.md` listing every rule id with one line each; rename `consecration_date` to `awarded_on`. Update the comment in `scripts/seed-supabase.ts` only if it names fields. Set this plan's status to `done`.
- [ ] **T19 Final check.** `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (100% branches in `src/domain` and `src/data-model`), `pnpm data:validate`, `pnpm build`.

## Tests to write

- **Unit** (`tests/unit/data-model/`, `tests/unit/domain/`): dates, schemas, validator shape stage, one file per rule family, coverage helper, match outcome, rule catalogue.
- **Integration** (`tests/integration/validate-data-cli.test.ts`): real process, real fixture directories, exit codes and output format.
- **E2E**: none (no UI change).

### Edge cases

- Empty `data/` or only `.gitkeep`; a file with `[]`; a missing optional file (`standings.json`).
- Root that is an object or `null`; invalid JSON; BOM at the start of a file (JSON.parse fails on a BOM: strip it in the CLI and test it).
- `fuente` instead of `source` (strict schema plus missing-source); `source` empty or whitespace; `source` a number.
- Timezone: 00:00 to 02:59 UTC still belongs to the previous BA day; match dated exactly today; year boundary.
- Season bounds are inclusive; impossible dates (`2026-02-30`, `2026-13-01`).
- Home and away swapped duplicates; three duplicates; same pair on the same day in two competitions.
- Penalties: draw in P/W/D/L; tied penalty count; penalties without equal goals; extra time without penalties.
- Suspended match with null goals (valid) versus played with null goals (invalid); suspended matches do not support a title and are not tallied.
- Coverage `to: null`; coverage starting after the season start (not contained); several coverage rows for the same club and competition.
- Single title marked `shared: true`; three titles in one season with one unshared.
- Records with invalid shape do not produce follow-up issues.

## Impact

- **Data:** defines the contract for `data/` before issue #8 fills it. Issue #8 text (`fuente`, `verificado`) must be read through ADR 0009. No data is created or changed here; all fixtures are synthetic (`club-a`...`club-d`, `fixture:synthetic` sources), no real results are invented.
- **Design:** none (no UI). Spanish labels for the UI are unaffected.
- **Security:** the CLI only reads files under the given directory, makes no network calls, uses no secrets. `JSON.parse` only, no `eval`. `src/data-model` has no I/O.
- **Performance:** every rule is O(n) or O(n log n) with `Map` indexes (duplicate detection by composite key, tallies grouped by club and season). Expected dataset (tens of thousands of matches) validates in well under a second; no limit test needed, but avoid nested loops over matches per title (index matches by `season_id` first).
- **CI:** the `data` job keeps calling `pnpm data:validate`; the `test` job's `pnpm test:coverage` now also enforces 100% branches in `src/data-model`. No workflow file changes (guardrail).

## Risks

- **Rule interpretation** (title support, control totals) may not match Diego's intent: mitigated by the approval checkpoint T0 and by keeping each rule in its own small function.
- **Zod 4 date validation** (`z.iso.date()`) behavior on impossible dates: T3 tests pin it; if it accepts `2026-02-30`, add a refine that round-trips through `Date.UTC`.
- **Running tsx from the integration test on Windows and Linux**: use `process.execPath` with `--import tsx`, never the `.bin` shim.
- **False positives when issue #8 lands real data** (for example, a real season split across calendar years): the rules are fixed by tests; fixing data is out of scope, but any rule that proves wrong is raised to Diego, not silenced.
- **Dependency direction** `src/data-model -> src/domain/match-outcome -> types from src/data-model`: type-only import back, no runtime cycle. Checked by typecheck and lint.

## Done when

- All tasks checked, every acceptance criterion maps to a passing test, and the catalogue test (T16) proves each rule has a failing and a passing fixture.
- `pnpm test:coverage` passes with 100% branches in `src/domain/**` and `src/data-model/**`.
- `pnpm data:validate` exits 0 on the current `data/` and exits 1 on `tests/fixtures/data-validate/invalid`.
- ADR 0009 is Accepted and `docs/methodology.md` lists the validation rules.
