---
issue: 12
status: in-progress
date: 2026-10-17
---

# Plan 0014: Complete the coverage table for every club

Related: [ADR 0003](../adr/0003-data-sources.md) (sources, coverage per competition), [ADR 0011](../adr/0011-match-date-precision.md) (date precision), [ADR 0015](../adr/0015-ingestion-adapter-contract.md) (adapter contract), **[ADR 0017](../adr/0017-derived-coverage-table.md)** (new, Proposed: the coverage table is derived), [plan 0003](0003-data-validate.md) (validator), [plan 0005](0005-stats-engine.md) (engine and coverage notice), [plan 0011](0011-ingest-openfootball.md), [plan 0013](0013-load-openfootball-data.md) (real data).

## Goal

Write `data/coverage.json` so that every club and competition pair says, with sources, where the data is complete and where it is not. Never claim completeness we lack: the partial 2025 Apertura, the Copa de la Liga editions that are not loaded and the seasons a club spent outside the top flight must never read as complete.

## Acceptance criteria (copied from issue #12)

- Given every club and competition pair, when the dataset is checked, then `coverage` has a row with `desde`, `hasta` and `completa` (field names `from`, `to`, `complete`, ADR 0009).
- Given the coverage dates, when compared with ADR 0003, then they match the full-coverage start date per club.
- Given a competition with partial coverage for a club, when recorded, then `completa` is false and the gap is explained.
- Given the validator, when it runs, then it fails if any club lacks coverage rows.

Out of scope (issue): the UI warning (Fase 3). Also out of scope here: the Spanish copy of the notice, any engine change, and loading new matches.

## What exists today

- `coverageSchema`: `club_id`, `competition_id`, `from` (date, required), `to` (date or `null` = ongoing), `complete`, `source`; key `club_id/competition_id/from`. The Supabase `coverage` table mirrors it. No `notes` field.
- `data/coverage.json` does **not** exist, so the engine reports every real period as `missing` or `partial` (safe, useless).
- Engine (`src/domain/coverage-notice.ts`, `history.ts`): merges `complete` rows into stretches (adjacent rows join, `to: null` is ongoing); a listed competition is `complete` if one stretch contains the period, `partial` if one overlaps it (with the closest stretch's `completeFrom`/`completeTo`), `missing` otherwise. `complete: false` rows only make a competition listed (`relevantCompetitionIds`, sets 2 and 3). A competition with no row and no match is unknown and unlisted.
- Validator: `isSeasonFullyCovered` gates `title-without-support` and `standings-mismatch`; `invalid-season-range` checks `from <= to`; references check `club_id` and `competition_id`.
- Real data: 34 clubs; `primera-division` seasons 2018-19, 2019-20, 2021, 2022, 2023, 2024 (complete files, last match = season end) and 2025 Apertura (last match 2025-05-04, end 2025-06-01: partial); `copa-de-la-liga-profesional` season 2020 (2020-10-30 to 2021-03-31, 24 clubs). The Copa de la Liga 2021 to 2024 editions, Copa de la Superliga, Copa Argentina, CONMEBOL cups and super cups are not loaded.

## Answers to the design questions

1. **Generated, not hand-written (ADR 0017, decisions 2 and 8).** A pure `generateCoverage(dataset, gaps)` in `src/data-model/` computes the rows from `seasons.json` and `matches.json` plus a small reviewed list of declared gaps (`src/data-model/coverage-gaps.ts`, each with `source` and `reason`). `pnpm data:coverage` writes the file; every ingestion run regenerates it in the same validated commit. A drift test fails when the committed file differs from the generator output. The validator gets three data-only rules (`missing-coverage`, `coverage-overlap`, `coverage-overclaim`); the full "coverage disagrees with matches" check is the drift test, because `validate()` does not see the gap list and must stay usable on fixture directories.
2. **Semantics.** `complete: true` over `[from, to]` = every match of the club in that competition dated in the interval is loaded. A complete stretch is a run of consecutive loaded seasons in which the club played (ADR 0017, decision 4): a season the club did not play ends the stretch, so a promoted or relegated club is never reported complete for seasons it was absent, whether it was absent from the competition or from our data (we cannot tell them apart without sourced movements). "Complete" is **per competition**: the main league being complete says nothing about cups. Competitions that exist but are not loaded can only be reported if they are recorded in `competitions.json` with declared gaps (D2).
3. **Engine.** No change. It already reads stretches and statuses as needed. New tests only: an integration test on the real data that pins the statuses the notice will show (T14). If that test shows a wrong status, the builder stops and reports; an engine change is a new issue.
4. **Start dates before 2018-19.** No pre-2018 rows. The first complete stretch of each club starts at its first loaded season (2018-08-10 at the earliest), so a fan period starting earlier gets `partial` with `completeFrom` after `period.start`. That comparison is what the Fase 3 notice uses (the UI note is added to the methodology in T15). A period wholly before 2018 lists no competition (or `primera-division` as `missing` if the period reaches a loaded season) and is never complete.
5. **Which competitions get rows.** Every competition in `competitions.json`, for every club (AC 1). Today: `primera-division` and `copa-de-la-liga-profesional`. "No data" is expressible with the current schema: a `complete: false` row with a real `from` (start of the declared gap) and `to` (end, or `null`). No schema change, no migration.

## Approach

### Generator rules (ADR 0017)

1. Season load: matches per season; loaded = at least one match; complete if last match date = `end`; otherwise partial, loaded through the last match date. Not loaded = zero matches.
2. Per club and competition: seasons sorted by `start` (then `id`); runs of consecutive seasons that are loaded and played by the club; each run gives an interval `[first.start, last.loadedThrough]`.
3. Declared gaps of the competition are subtracted from those intervals (a gap may cut an interval in two or remove it). The remaining intervals become `complete: true` rows with `source: "derived:<first season id>..<last season id>"` of the seasons they span.
4. Each declared gap becomes one `complete: false` row for every club, with the gap's `source`.
5. A partial season's missing tail (`loadedThrough + 1` to `end`) must be inside a declared gap of its competition, else the generator throws (forces a human explanation, AC 3).
6. A competition with no loaded season and no declared gap throws. A pair still without a row gets a fallback `complete: false` row from the competition's first season start to `null`, source `derived:no-season-played`.
7. Output sorted by `KEY_FIELDS` order (`club_id`, `competition_id`, `from`), keys in schema order, serialized with the ingest serializer (Prettier-stable).

### Declared gaps (Phase 1)

| Competition                   | From             | To         | Reason (English, in `coverage-gaps.ts`)                                                  | Source                                                    |
| ----------------------------- | ---------------- | ---------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `primera-division`            | 2025-05-05       | `null`     | 2025 Apertura knockout stage, 2025 Clausura and later seasons are not loaded (ADR 0003). | Season source of `primera-division-2025-apertura` (oldid) |
| `copa-de-la-liga-profesional` | 2021 first match | 2021 final | Copa de la Liga Profesional 2021 not loaded.                                             | Wikipedia oldid of the 2021 edition                       |
| `copa-de-la-liga-profesional` | 2022 first match | 2022 final | Copa de la Liga Profesional 2022 not loaded.                                             | Wikipedia oldid of the 2022 edition                       |
| `copa-de-la-liga-profesional` | 2023 first match | 2023 final | Copa de la Liga Profesional 2023 not loaded.                                             | Wikipedia oldid of the 2023 edition                       |
| `copa-de-la-liga-profesional` | 2024 first match | 2024 final | Copa de la Liga Profesional 2024 not loaded.                                             | Wikipedia oldid of the 2024 edition                       |

Exact edition dates are read by the builder from permanent Wikipedia revisions and logged in the verification log below (expected, to verify: 2021 from about 2021-02-12 to 2021-06-04; 2022 about 2022-02-10 to 2022-05-22; 2023 about 2023-10-20 to 2023-12-16; 2024 about 2024-01-25 to 2024-05-05). One gap per edition (not one gap 2021 to 2024) so that periods between editions do not list the cup. The competition ended with the 2024 edition (from 2025 the league plays Apertura and Clausura), so there is no open tail; the builder confirms this in the same revision.

Consequence worth knowing: the Copa Diego Maradona 2020 stretch ends the day before the 2021 edition starts, so the 2021-03-31 Sudamericana qualifier (Vélez 2-3 Banfield) falls inside the 2021 gap. Correct, because cup matches of 2021 are not loaded.

### Expected real output (Phase 1)

232 rows: 38 complete `primera-division` rows, 24 complete `copa-de-la-liga-profesional` rows (one per club of the 2020 edition, ending the day before the 2021 edition), 34 primera tail gap rows and 4 x 34 = 136 cup gap rows.

Complete `primera-division` stretches per club (AC 2: the first stretch starts at the later of 2018-19 and the club's first season, as ADR 0003 decision 1 says):

| Club                                                                                                                                                                                                                                                                                     | Complete stretches                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| argentinos-juniors, atletico-tucuman, banfield, boca-juniors, defensa-y-justicia, estudiantes-la-plata, gimnasia-la-plata, godoy-cruz, huracan, independiente, lanus, newells-old-boys, racing-club, river-plate, rosario-central, san-lorenzo, talleres-cordoba, union, velez-sarsfield | 2018-08-10 to 2025-05-04                           |
| central-cordoba-sde                                                                                                                                                                                                                                                                      | 2019-07-26 to 2025-05-04                           |
| platense, sarmiento-junin                                                                                                                                                                                                                                                                | 2021-07-16 to 2025-05-04                           |
| barracas-central                                                                                                                                                                                                                                                                         | 2022-06-03 to 2025-05-04                           |
| instituto                                                                                                                                                                                                                                                                                | 2023-01-27 to 2025-05-04                           |
| deportivo-riestra, independiente-rivadavia                                                                                                                                                                                                                                               | 2024-05-10 to 2025-05-04                           |
| aldosivi                                                                                                                                                                                                                                                                                 | 2018-08-10 to 2022-10-25; 2025-01-23 to 2025-05-04 |
| belgrano                                                                                                                                                                                                                                                                                 | 2018-08-10 to 2019-04-07; 2023-01-27 to 2025-05-04 |
| tigre                                                                                                                                                                                                                                                                                    | 2018-08-10 to 2019-04-07; 2022-06-03 to 2025-05-04 |
| san-martin-san-juan                                                                                                                                                                                                                                                                      | 2018-08-10 to 2019-04-07; 2025-01-23 to 2025-05-04 |
| arsenal                                                                                                                                                                                                                                                                                  | 2019-07-26 to 2023-07-30                           |
| colon                                                                                                                                                                                                                                                                                    | 2018-08-10 to 2023-07-30                           |
| patronato                                                                                                                                                                                                                                                                                | 2018-08-10 to 2022-10-25                           |
| san-martin-tucuman                                                                                                                                                                                                                                                                       | 2018-08-10 to 2019-04-07                           |

The 2025 stretches end at 2025-05-04, the last loaded day, as ADR 0003 decision 3 records; the rest of the Apertura is in the gap.

### Discarded alternatives

- **Hand-written `coverage.json`.** About 230 rows to keep in sync with every ingestion; the first forgotten update over-claims. Rejected.
- **Compute coverage inside the engine at runtime (no file).** The gap list is reviewed data and Supabase already has a `coverage` table for the app; the engine contract (ADR 0010) takes coverage as input. Rejected.
- **A `coverage-drift` rule inside `validate()`.** Needs the gap list inside the pure validator and would break every fixture directory and the CLI tests. The drift test on `data/` gives the same protection in CI. Rejected.
- **Continuous stretches across absences (D1, alternative).** A club absent from a complete season file did not play that season, so a continuous row is defensible; but it contradicts ADR 0003's per-club start rule, is asymmetric with the start, and turns "Belgrano in 2021" into "complete, 0 matches". Rejected unless Diego prefers it.
- **Optional `notes` column for gap reasons (D3, alternative).** Needs a migration, parity test changes and later seed changes for text the UI will not show verbatim (UI copy is Spanish). Rejected unless Diego prefers it.
- **Season-level completeness from an explicit per-season config** instead of "last match = season end". Duplicates ADR 0015's `partial` config and can drift from it; the inference uses the same convention and fails safe (a doubtful season reads as partial). Rejected.

## Decisions for Diego (NEEDS DIEGO)

- **D1. Promotion and relegation (ADR 0017, decision 4).** Recommendation: stretches follow participation (the table above); a fan of Belgrano since 2020 sees Primera as partial "from 2023-01-27". Alternative: one continuous stretch from the club's first season.
- **D2. Record the competitions that exist and are not loaded (Phase 2).** Without them, a narrow period such as a year-range filter on 2019-20 lists only `primera-division` and reads `isComplete: true` while the Copa de la Superliga, Copa Argentina and Libertadores were played. Recommendation: yes, in this issue, as Phase 2: add `copa-de-la-superliga`, `copa-argentina`, `supercopa-argentina`, `trofeo-de-campeones`, `supercopa-internacional`, `copa-libertadores`, `copa-sudamericana` and `recopa-sudamericana` to `competitions.json` (ids, `type`, `scope`, `organizer`, `afa_recognized` to be approved like ADR 0015 decision 8), each with a Wikipedia oldid source, and a declared gap per competition from 2018-08-10 (first loaded day) to `null` (or per edition for the two Superliga cups). Lower divisions (Primera Nacional) stay out: a follow-up issue if wanted. If Diego says no, Phase 2 becomes a follow-up issue that must close before the screens of #15 show a complete badge.
- **D3. Where the gap is explained (ADR 0017, decision 5).** Recommendation: `reason` in the reviewed gap list, the gap's `source` on every row and a "Known coverage gaps" table in `docs/methodology.md`; no schema change. Alternative: optional `notes` on coverage rows plus a Supabase migration.

The UI notice wording is Fase 3 and not decided here.

## Tasks

Each task starts with its failing test. Phase 1 can start after D1 and D3; Phase 2 only after D2.

### Phase 1: rules, generator, real coverage

- [x] **T1. `missing-coverage` rule (unit).** Test first in `tests/unit/data-model/rules/coverage.test.ts`: a club and competition pair with no row fails with `recordId` `club/competition` on `coverage.json` and a message that names `pnpm data:coverage`; no competitions gives no issue; a row of another club does not count; a complete or incomplete row both satisfy it. Then `src/data-model/rules/coverage.ts` and the rule id in `RULE_IDS` (not wired yet).
- [x] **T2. Wire `missing-coverage` and keep baselines valid.** Tests first: catalogue mutation (remove one coverage row, exactly this rule fires); baseline `validDataset()` and `tests/fixtures/data-validate/valid/` still give zero issues after adding the missing pairs as `complete: false` rows (so `title-without-support` and `standings-mismatch` stay inactive); `stats-world.test.ts` asserts the only issues are the listed `missing-coverage` pairs, with a comment that the world deliberately lacks rows to exercise the engine's `missing` status. Then wire into `validate()`.
- [x] **T3. `coverage-overlap` rule.** Tests first: two rows of the same pair sharing a day fail (complete or not, `to: null` included); adjacent rows (`to` + 1 day = next `from`) pass; different pairs pass. Catalogue mutation. Wire.
- [x] **T4. `coverage-overclaim` rule.** Tests first: a complete row sharing a day with a season of its competition that has no match fails; a `complete: false` row does not; a season of another competition is ignored; a season with matches passes. Catalogue mutation. Wire. Methodology rule list updated in T15.
- [x] **T5. Gap list type and checks.** Tests first: every gap has a non-blank `source` and `reason`, `from <= to` when `to` is set, no two gaps of a competition overlap, entries sorted by competition then `from`; on the real data every gap's competition exists in `data/competitions.json`. Then `src/data-model/coverage-gaps.ts` with the five Phase 1 gaps and the verification log entries below filled in.
- [x] **T6. Season load (generator, part 1).** Tests first: complete season (last match = `end`), partial season (loaded through last match), season without matches (not loaded), suspended matches count as loaded matches (they are in the file), deterministic with unsorted input.
- [x] **T7. Club stretches (part 2).** Tests first: club in every season gives one stretch; absent middle season splits it; absent first seasons move the start (ADR 0003 rule); a season without matches breaks a run; partial last season ends at its loaded-through date; seasons ordered by `start`, not by id.
- [x] **T8. Gaps (part 3).** Tests first: a gap cuts a stretch in two, trims its head or tail, or removes it; each gap yields one `complete: false` row per club with the gap's source; a partial season's tail outside every gap throws with the season id; a competition with no loaded season and no gap throws.
- [x] **T9. Assembly (part 4).** Tests first: fallback row for a pair with nothing; `derived:<first>..<last>` sources; output order and key order; output of the generator on the valid fixture plus a gap passes `validate()` with zero issues; running it twice gives equal output.
- [x] **T10. `pnpm data:coverage [dir] [--check]`.** Integration test first on a temp dir: writes `coverage.json` Prettier-stable through the ingest serializer; a second run leaves the bytes unchanged; `--check` exits 1 and writes nothing when the file differs; a generator error exits 1 and writes nothing. Then `scripts/generate-coverage.ts` and the `package.json` script.
- [x] **T11. Ingestion regenerates coverage.** Tests first: a fake-adapter run in the ingest core writes `coverage.json` with the rest; a run that fails validation still writes nothing; `tests/integration/ingest-openfootball.test.ts` reads `coverage.json` and validates all five files. Then call the generator in `runAdapter` after the merge and add `coverage.json` to the files written. Note the ADR 0015 amendment in the methodology's ingestion section (T15).
- [x] **T12. Gap sources (data research, no code).** Read the Copa de la Liga 2021 to 2024 edition dates and the 2025 Apertura knockout dates from permanent Wikipedia revisions, with a second source for each first and last match date; confirm there is no Copa de la Liga after 2024. Fill the verification log. Stop and ask Diego if two sources disagree on a date.
- [x] **T13. Real `data/coverage.json`.** Test first: `tests/integration/coverage-data.test.ts` asserts that `data/coverage.json` equals `generateCoverage` on `data/` with the real gaps, that it has 232 rows, that every club and competition pair has a row, and the per-club stretch table of this plan (AC 2). It fails (no file). Then run `pnpm data:coverage`, `pnpm data:validate`, `pnpm lint`.
- [x] **T14. Engine on real coverage (integration).** Tests first, engine untouched: River since 2010, today 2026-10-17: `primera-division` partial with `completeFrom` 2018-08-10 and `completeTo` 2025-05-04, never complete; River with year range 2022: `primera-division` complete, `copa-de-la-liga-profesional` missing (2022 gap), `isComplete` false; Belgrano since 2020-01-01: Primera partial from 2023-01-27; San Martín de Tucumán since 2015: Primera partial ending 2019-04-07; Vélez in the 2020-11 to 2021-01 range: the cup complete; head-to-head Barracas Central and River since 2019: Primera partial with `completeFrom` 2018-08-10 (River's stretch, merged with Barracas' rows), and complete with a 2022-06-03 to 2024-12-16 year range. If any status differs, stop and report instead of changing the engine.
- [x] **T15. Documentation.** `docs/methodology.md`: a "Coverage table" section (row meaning, derivation, participation stretches, declared gaps, `pnpm data:coverage`), a "Known coverage gaps" table with reasons (AC 3), the three new validator rules, the ingestion note, and a UI note: a start date before `completeFrom` is what drives the partial notice; `isComplete` is per listed competition. Mark ADR 0017 Accepted with Diego's answers; add a one-line pointer to ADR 0017 in ADR 0003 decision 1.
- [x] **T16. Gates.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm data:validate`, `pnpm build`, `pnpm e2e`.

### Phase 2: competitions that are not loaded (only if D2 is yes)

- [ ] **T17. Competition records.** Test first (real data): `data/competitions.json` contains exactly the approved ids with the approved type, scope, organizer and recognition, each with an oldid `source`; validator passes. Then add the records by hand (adapters only add missing competitions and never overwrite, ADR 0015) with a verification log.
- [ ] **T18. Their gaps.** Tests first: gap list entries for each new competition (T5 checks); drift test updated (new row count: 232 + 34 per new gap); T14 gains the case River with year range 2019-08-01 to 2020-03-01, which must list the cups as missing and read `isComplete: false`. Then regenerate `data/coverage.json` and run the gates.

## Tests to write

- **Unit:** the three rules (each with its catalogue mutation); gap list checks; generator parts (season load, stretches, gaps, assembly, errors); existing `coverage.test.ts` for `isSeasonFullyCovered` unchanged.
- **Integration:** `pnpm data:coverage` CLI on temp dirs; ingest core and openfootball run writing `coverage.json`; drift and per-club table on `data/`; engine statuses on real data.
- **E2E:** none (no UI change).
- **Edge cases:** club with two stretches; club with no season played in a competition; partial season without a covering gap; season with no matches inside a stretch; gap that removes a whole stretch; gap at the head or tail of a stretch; overlapping seasons of one competition; adjacent rows; `to: null`; unsorted input; a club added to `clubs.json` without regenerating (fails `missing-coverage`).

## Decisions recorded (2026-10-17)

Diego answered D1 to D3 with the recommended options:

- **D1:** stretches follow participation.
- **D2:** register the competitions that exist and are not loaded, as Phase 2 of this plan, with declared gaps. This PR ships Phase 1 only; Phase 2 goes in its own PR, and until it lands no screen may show a complete badge.
- **D3:** the reason of each gap lives in the reviewed gap list and in `docs/methodology.md`, with no schema change.

## Verification log (T12, read on 2026-10-17)

Source 1 is the es.wikipedia revision named in `src/data-model/coverage-gaps.ts` (infobox "fecha de inicio" and "fecha de cierre"). Source 2 is an independent report. The plan estimated the 2023 edition in October; the real dates differ, which is why they had to be read.

| Fact                                   | Source 1 (es.wikipedia revision)                                                                                           | Source 2                                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copa de la Liga 2021: 12 Feb to 4 Jun  | 175528472 (26 teams, 176 matches); article text: "comenzó el 12 de febrero y finalizó el 4 de junio de 2021"               | Start: opening match Banfield 2-0 Racing on Fri 12 Feb 2021 (Diario de Cuyo, La Voz de San Justo). End: final Colón 3-0 Racing on 4 Jun 2021 in San Juan (Diario de Cuyo, Los Tiempos). |
| Copa de la Liga 2022: 10 Feb to 22 May | 175528478 (28 teams, 203 matches)                                                                                          | Start: Thursday 10 Feb 2022 with Patronato v Argentinos (C5N, Minutouno, ESPN); one 90min piece wrote 11 Feb, outvoted. End: Boca 3-0 Tigre on 22 May 2022 (Los Andes, El Gráfico).     |
| Copa de la Liga 2023: 17 Aug to 16 Dec | 175528489 (28 teams, 204 matches)                                                                                          | en.wikipedia (204 matches) and press: tournament 17 Aug to 16 Dec 2023; final Rosario Central 1-0 Platense on 16 Dec 2023 (La Nación, Cadena 3).                                        |
| Copa de la Liga 2024: 25 Jan to 5 May  | 175528520 (28 teams, 203 matches); text: "quinta y última edición. Comenzó el 25 de enero de 2024 y finalizó el 5 de mayo" | en.wikipedia (203 matches) and press: final Estudiantes 1-1 Vélez (4-3 on penalties) on 5 May 2024; the competition was abolished in 2025.                                              |
| No Copa de la Liga edition after 2024  | es.wikipedia "Copa de la Liga Profesional": 2024 was the "quinta y última edición"                                         | Press: "la competición fue abolida en 2025" (from 2025 the league plays Apertura and Clausura).                                                                                         |
| 2025 Apertura: final on 1 Jun 2025     | 175770270 (final 1 de junio, Platense champion)                                                                            | La Nación and Noticias NQN, 1 Jun 2025 (Platense 1-0 Huracán). The gap itself starts the day after the last loaded match (2025-05-05), so the exact knockout dates do not matter.       |

Where a source gave one day less or more, the earlier date was kept: a gap that starts earlier can only make a stretch shorter, never claim a day we lack.

## Impact

- **Data:** new `data/coverage.json`, about 232 rows (around 40 KB formatted). No change to other files in Phase 1; Phase 2 adds up to eight competitions. Every row has a source (derived rows point at the seasons they span).
- **Design:** none (UI is Fase 3). The engine's notice output for real clubs changes from "missing" everywhere to accurate statuses.
- **Security:** none. No new dependency, no secret, no personal data; the CLI reads and writes only the given data directory.
- **Performance:** generator is linear in matches plus seasons times clubs; runs in milliseconds. The engine filters coverage per competition; 232 rows are negligible. The app does not import `data/` yet.

## Risks

- **Fixture churn.** `missing-coverage` makes every validated fixture need rows. Mitigation: `complete: false` rows in baselines (no rule activation), explicit expected issues in `stats-world.test.ts`, catalogue mutations checked to fire only their rule.
- **Wrong gap dates over-claim the cup in 2021.** Mitigation: two sources per date (T12), drift test, and the safe direction when in doubt (start the gap earlier).
- **"Last match = season end" convention broken by a future adapter.** The generator fails safe (partial) unless a partial file's end is set to its last match; ADR 0015's `partial` config prevents that. The drift test makes any change visible in review.
- **Ingest pipeline change breaks the openfootball run.** Covered by T11 on the recorded fixtures before touching `data/`.
- **Product reading of D1 and D2.** Without D2, narrow periods can still read complete; this is documented as a UI note and must be resolved before #15 shows a complete badge.

## Definition of done

All acceptance criteria met: every pair has a row (T13), starts match ADR 0003 (T13 table), partial coverage is `complete: false` with a reason in the gap list and the methodology (T5, T15), and the validator fails on a missing pair (T1, T2). `data/coverage.json` equals the generator output, CI green, D1 to D3 answered and recorded in ADR 0017, reviews approved, plan marked done.
