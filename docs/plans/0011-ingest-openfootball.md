---
issue: 7
status: done
date: 2026-10-17
---

# Plan 0011: Ingestion adapter infrastructure and the openfootball adapter

Related ADRs: [0003](../adr/0003-data-sources.md) (sources and licenses), [0009](../adr/0009-data-model-naming.md) (English data model, `source` on every record), [0011](../adr/0011-match-date-precision.md) (match date precision), [0012](../adr/0012-club-identity-aliases-colors.md) (club ids and alias resolution), **[0015](../adr/0015-ingestion-adapter-contract.md)** (new, written with this plan: ingestion adapter contract and competition taxonomy).

## Scope of this plan

Issue #7 asks for one adapter per approved source. This plan covers **only**:

1. The **shared adapter infrastructure** in `scripts/ingest/core/`: adapter interface, deterministic serializer, club-name resolution with a full unknown-name report, merge with ownership rules, write-only-on-valid-data, pinned and hashed inputs, and the CLI.
2. The **first adapter: openfootball `south-america`** (CC0-1.0, no key), Argentine Primera División files `2018-19` to `2024` (complete tournaments) and `2025` (partial, until 2025-05-04), including the competitions and seasons it needs.

The **API-Football** and **Kaggle** adapters are follow-ups with their own issues and plans (see "Suggested follow-up issues"). Issue #7 stays open until they are done; the PR of this plan uses `Refs #7`, not `Closes #7`.

## Goal

`pnpm data:ingest openfootball` turns the pinned openfootball files into `competitions.json`, `seasons.json` and `matches.json` records that pass `pnpm data:validate`, with a permalink `source` on every record, byte-identical output on every run, and a guarantee that a malformed file, an unknown club or a conflicting record never changes `data/`. Every test runs against recorded fixtures without network.

## Acceptance criteria (copied from issue #7)

- Given each source approved in ADR 0003, when its adapter runs, then it outputs records in the normalized `data/` format with a `fuente` on every record. _(`fuente` is `source` per ADR 0009. This plan: openfootball only.)_
- Given the same input twice, when an adapter runs, then the output is identical (deterministic, no duplicate records).
- Given a source returns malformed or partial data, when the adapter runs, then it fails with a clear error and does not overwrite `data/`.
- Given API-Football, when the adapter runs, then it respects the daily request quota and the key is read only from the server environment. _(Not in this plan: API-Football follow-up issue.)_
- Given each adapter, when tests run, then they pass against recorded fixtures without network access.

Out of scope (from the issue): scheduling (data-update issue #11) and seeding Supabase (#10). Also out of scope here: the coverage table (#12; the run report gives #12 the facts it needs, but this plan writes no `coverage.json`), titles, rivalries, standings, and committing the real ingested data (see "What this plan does not write").

## Facts about the source (checked on 2026-10-17)

Fetched with `gh api repos/openfootball/south-america/contents/argentina/<file>`. The last commit touching `argentina/` is `18fcfc41566d30928f6a683b9cdf3973e22c7974` (2026-05-28, "up format"); the last data change is `090c2f9a` (2025-05-05). Files are LF, UTF-8, no BOM.

| File              | Header `# Date`                   | Teams | Matches | sha256 (at `18fcfc4`, to re-check at build)                        |
| ----------------- | --------------------------------- | ----- | ------- | ------------------------------------------------------------------ |
| `2018-19_ar1.txt` | Fri Aug 10 2018 - Sun Apr 7 2019  | 26    | 325     | `b75303bf01ee603219ef07e008b648e22a339e7153a767fecc200443f51eae68` |
| `2019-20_ar1.txt` | Fri Jul 26 2019 - Mon Mar 9 2020  | 24    | 276     | `0c50deae30e861fb3b66343cf8365f925dd8eb9e6525a8266994acab37318c50` |
| `2020_ar1.txt`    | Fri Oct 30 2020 - Wed Mar 31 2021 | 24    | 135     | `70602786cb0102d4a3bc9b8d2b7ed53987459547581376483201301a62c500cd` |
| `2021_ar1.txt`    | Fri Jul 16 - Mon Dec 13 2021      | 26    | 325     | `1e75af6d390ab4cd8dc382362d3a0d751f866283bb7a31507f1c9d05899060f1` |
| `2022_ar1.txt`    | Fri Jun 3 - Tue Oct 25 2022       | 28    | 378     | `d560e9d6172853dd95ff2ffe71586d6cc6ad6d593ff9e5a06684abd159b83cca` |
| `2023_ar1.txt`    | Fri Jan 27 - Sun Jul 30 2023      | 28    | 378     | `0d20768c23ff850a4b30240c6cf648524230b93578cb09a988df2a817d3974ef` |
| `2024_ar1.txt`    | Fri May 10 - Mon Dec 16 2024      | 28    | 378     | `41a6a36df3ff50d8b554bfa739a8052c6f0876f8ec6a5393e11681e2624ae0db` |
| `2025_ar1.txt`    | Thu Jan 23 - Sun May 4 2025       | 30    | 240     | `e087b6827b229bfd797da1293f735ba1958d54c294a27bc7eb863bca5bf71289` |

Format (Football.TXT), as found in these eight files:

- Line 1 `= Argentina Primera Division <edition>`; then `# Date`, `# Teams`, `# Matches` and, in 2020 and 2025 only, `# Stages` (`Regular Season (72)  Copa Sud (1)  Fase Campeón (31)  Fase Complementación (31)`; `1° Semestre (240)`).
- Stage headings start with `▪ `: `Matchday N` (2018-19 to 2024), `1° Semestre, Matchday N` (2025), and in 2020 `Group A` to `Group F`, `Fase Campeón, Gruppe 1|2`, `Fase Campeón, Final`, `Fase Complementación, Gruppe 1|2`, `Fase Complementación, Final`, `Copa Sud, Final`.
- Date lines are indented two spaces: `Fri May 10 2024` (with year) or `Sat May 11` (year carried from the previous date line). Rescheduled matches appear out of order (2018-19 has `Sat Jan 19 2019` followed by `Fri Oct 19 2018`), and in every such case the line carries an explicit year.
- Match lines are indented four spaces: optional kickoff `HH:MM` (blank means "same as above"), `<home> v <away>`, then the score: `N-N`, `N-N (N-N)` (half time) or, once, `5-3 pen. (1-1, 0-0)` (2020, `Fase Campeón, Final`, Boca Juniors v Banfield: shoot-out, full time, half time). No `a.e.t.`, abandoned, awarded or unscored line exists in these files.
- The kickoff time is not stored. The written date is taken as the calendar date in America/Argentina/Buenos_Aires (ADR 0009); the ADR 0003 spot checks (Boca 2-2 Independiente and Racing 1-2 River on 2022-10-23, River 3-1 Estudiantes on 2023-07-15) agree with Wikipedia on the date.
- Each file is **one tournament** (ADR 0003): 2020 is the Copa de la Liga Profesional 2020 (Copa Diego Armando Maradona) plus the one-off Copa Sudamericana qualifying match Vélez Sarsfield 2-3 Banfield (2021-03-31); 2025 is the group stage of the Torneo Apertura 2025 only (its play-offs are missing).

Team names that do **not** resolve against today's `data/clubs.json` (29 clubs):

| File            | Unresolved names                                              |
| --------------- | ------------------------------------------------------------- |
| 2018-19         | Patronato de Paraná, Colón de Santa Fe, San Martín de Tucumán |
| 2019-20 to 2022 | Arsenal de Sarandí, Colón de Santa Fe, Patronato de Paraná    |
| 2023            | Arsenal de Sarandí, Colón de Santa Fe                         |
| 2024, 2025      | Independiente Rivadavia (issue #48)                           |

So, by design (ADR 0012), **no real season can be written to `data/` today**: every file has at least one club missing from `data/clubs.json`.

## What this plan does not write

This plan delivers the adapter, its tests and fixtures, and the docs. It does **not** commit `data/competitions.json`, `data/seasons.json` or `data/matches.json`. Those are written by running the adapter in the dataset issue (#8), after #48 adds Independiente Rivadavia and #8 adds the four former Primera clubs (Arsenal de Sarandí, Colón de Santa Fe, Patronato de Paraná, San Martín de Tucumán), as plan 0007 already planned. The verification step of this plan runs the adapter with `--dry-run` against the real pinned files and checks that it reports exactly the unresolved names above and writes nothing.

## Approach

### Layout

```
scripts/ingest/
  index.ts                      CLI: pnpm data:ingest <adapter> [--dry-run] [--out <dir>] [--from <dir>]
  core/
    adapter.ts                  Adapter interface, AdapterOutput, RunReport, IngestError
    serialize.ts                deterministic JSON for a data file
    club-resolver.ts            wraps resolveClubId: unknown-name report, per-season injectivity
    merge.ts                    ownership merge and reference-record upsert with conflicts
    commit.ts                   validate-then-write (temp file + rename), dry run
    pinned-fetch.ts             fetch a pinned URL with timeout, size cap and sha256 check
  openfootball/
    config.ts                   pinned SHA, files and hashes, competitions, seasons, stage map
    parse.ts                    pure Football.TXT parser for these files (strict grammar)
    normalize.ts                parsed file + config + resolver -> seasons and matches
    index.ts                    the adapter object (wires config, loader, parse, normalize)
tests/fixtures/ingest/openfootball/
  <8 files>_ar1.txt             byte copies at the pinned SHA (CC0)
  README.md                     origin, commit SHA, license, how to refresh
  clubs.ts                      fixture clubs (the 29 real ones plus 5 synthetic records for the missing names)
tests/unit/scripts/ingest/...   unit tests per module
tests/integration/ingest-cli.test.ts
```

Pure modules (`core/serialize`, `core/club-resolver`, `core/merge`, `openfootball/parse`, `openfootball/normalize`, `openfootball/config`) do no I/O and take everything as arguments. `core/commit`, `core/pinned-fetch` and `index.ts` hold all file system and network access. Following the precedent of `scripts/lib/club-aliases-check.ts`, the pure cores live under `scripts/` (they are ingestion tooling, not app business logic, so they do not go to `src/domain`), and they import the validator and schemas from `src/data-model`.

### Adapter interface (ADR 0015, decision 1)

```ts
type Adapter<Raw> = {
  id: string; // "openfootball"
  sourcePrefix: string; // owned matches: source starts with this
  load(loader: SourceLoader): Promise<Raw>; // I/O through an injected loader
  normalize(raw: Raw, ctx: { clubs: readonly Club[] }): AdapterOutput; // pure
};
type AdapterOutput = {
  competitions: Competition[];
  seasons: Season[];
  matches: Match[];
  report: RunReport; // per file: parsed count, header count, first and last date, partial flag
};
```

`SourceLoader` has two implementations: `fetchPinned` (network, used by default) and a directory reader (`--from <dir>`, used by tests and by offline runs). Tests never construct the network loader with a real `fetch`.

### Pinned input (ADR 0015, decision 2)

`openfootball/config.ts` holds `commit: "18fcfc41566d30928f6a683b9cdf3973e22c7974"` (re-check at build: use the latest commit touching `argentina/`), the eight file names and their sha256. URLs are `https://raw.githubusercontent.com/openfootball/south-america/<sha>/argentina/<file>`. `fetchPinned` refuses any other host, uses `AbortSignal.timeout(15_000)`, rejects non-200 responses, rejects bodies over 1 MB, and compares sha256 before parsing. The record `source` is `https://github.com/openfootball/south-america/blob/<sha>/argentina/<file>#L<line>` for a match, and the file permalink without anchor for a season.

### Parsing (strict)

Every line of a file must be one of: header (`=`, `#`), blank, stage heading, date line, match line. Anything else stops the run with `file:line: unexpected line "<text>"`. Rules and checks, each with its own error message naming file and line:

- Year inference: a date line without a year takes the year of the latest date line that had one; a date line before any year is an error. The written weekday must equal the weekday of the computed date (catches a wrong inferred year).
- A match line before any date line or any stage heading is an error. The `HH:MM` field is accepted and discarded.
- Score grammar: `H-A`, `H-A (h-a)`, `P1-P2 pen. (H-A, h-a)`. In the shoot-out form the regulation score must be a draw and the shoot-out must not be a draw. Any other suffix is an error (no silent acceptance of `a.e.t.` or `awd.` until a file needs it and a test covers it).
- File-level checks: parsed matches equal `# Matches`; distinct team names equal `# Teams`; the first and last match dates equal the `# Date` range; when `# Stages` is present, the count per stage prefix equals the header; no two lines have the same date and the same (unordered) pair of names.

### Stage map (in config, exhaustive)

| Source heading                          | `stage`                        | `is_final` |
| --------------------------------------- | ------------------------------ | ---------- |
| `Matchday N`, `1° Semestre, Matchday N` | `Fecha N`                      | false      |
| `Group X`                               | `Zona X`                       | false      |
| `Fase Campeón, Gruppe N`                | `Fase Campeón, Zona N`         | false      |
| `Fase Campeón, Final`                   | `Final`                        | true       |
| `Fase Complementación, Gruppe N`        | `Fase Complementación, Zona N` | false      |
| `Fase Complementación, Final`           | `Fase Complementación, Final`  | false      |
| `Copa Sud, Final`                       | `Definición Copa Sudamericana` | false      |

`stage` is a display label, so it is Spanish (ADR 0009, decision 4). A heading that is not in the map stops the run. `is_final` is true only for the match that decides the title of the season, never because the heading contains "Final" (the two 2020 "finals" other than `Fase Campeón, Final` award no title). Approval items 2 and 4.

### Normalization

For each match line: `id` = `<date>-<home_id>-<away_id>` (ADR 0015, decision 7); `season_id` from the file config; `date`; goals = the regulation score (the shoot-out form uses the full-time score); `decision` = `penalties` only for the shoot-out form, else `null`; `home_penalties`/`away_penalties` from the shoot-out or `null`; `stage` and `is_final` from the map; `status: "played"`; `source` = line permalink; `verified: false` (openfootball is a single source; the API-Football follow-up can set `true` for 2022 to 2024 after a cross-check). If issue #38 (ADR 0011 schema change) is merged before this is built, also `date_precision: "day"` (task T15); if not, #38 adds it to the adapter.

Seasons (config plus parse): `start` and `end` are the first and last match dates of the file, cross-checked against the header range, with the file permalink as `source`. Exception: `primera-division-2025-apertura` is partial in the source, so its `end` is the real last day of the Torneo Apertura 2025 from a cited permanent Wikipedia revision (approval item 3), and the run report marks it `partial: true` (last date in source 2025-05-04).

### Proposed competitions and seasons (ADR 0015, decision 8; approval item 1)

| File    | Competition                   | Season id                          | Season `name`                    | start      | end                |
| ------- | ----------------------------- | ---------------------------------- | -------------------------------- | ---------- | ------------------ |
| 2018-19 | `primera-division`            | `primera-division-2018-19`         | Superliga 2018-19                | 2018-08-10 | 2019-04-07         |
| 2019-20 | `primera-division`            | `primera-division-2019-20`         | Superliga 2019-20                | 2019-07-26 | 2020-03-09         |
| 2020    | `copa-de-la-liga-profesional` | `copa-de-la-liga-profesional-2020` | Copa Diego Armando Maradona 2020 | 2020-10-30 | 2021-03-31         |
| 2021    | `primera-division`            | `primera-division-2021`            | Liga Profesional 2021            | 2021-07-16 | 2021-12-13         |
| 2022    | `primera-division`            | `primera-division-2022`            | Liga Profesional 2022            | 2022-06-03 | 2022-10-25         |
| 2023    | `primera-division`            | `primera-division-2023`            | Liga Profesional 2023            | 2023-01-27 | 2023-07-30         |
| 2024    | `primera-division`            | `primera-division-2024`            | Liga Profesional 2024            | 2024-05-10 | 2024-12-16         |
| 2025    | `primera-division`            | `primera-division-2025-apertura`   | Torneo Apertura 2025             | 2025-01-23 | cited end (item 3) |

Competitions: `primera-division` ("Primera División", `league`, `domestic`, organizer `AFA`, `afa_recognized: true`) and `copa-de-la-liga-profesional` ("Copa de la Liga Profesional", `national_cup`, `domestic`, organizer `AFA`, `afa_recognized: true`), each with a permanent `oldid` Spanish Wikipedia URL as `source`, chosen and checked by the builder (the article must state the organizer and AFA recognition; if it does not, stop and ask Diego). Season names must match the cited sources; a disagreement is a human checkpoint.

### Merge and write (ADR 0015, decisions 3 to 5)

1. Read `data/*.json` (or `--out <dir>`), parse with the schemas.
2. `merge`: drop every existing match whose `source` starts with `https://github.com/openfootball/south-america/`, add the new ones; upsert competitions and seasons by id (missing: add; deep-equal: keep; different: conflict).
3. `validate(nextDataset, { now })` plus the adapter's own checks. Any issue: print all, exit 1, write nothing.
4. Serialize every changed file; write `<file>.tmp-<pid>` for all, then rename each; skip files whose bytes are unchanged; remove leftover temp files on error.
5. `--dry-run` runs 1 to 3 and prints the report and a per-file summary (records added, removed, unchanged) without writing.

### Discarded alternatives

- **Fetching the moving `master` branch.** Output would change without a PR and tests could not prove determinism. Rejected for a pinned SHA plus hashes.
- **Skipping matches with unknown clubs** (or writing them with a placeholder id). Silently incomplete history; contradicts ADR 0012 and "partial coverage is shown, never invented". Rejected: the run fails and lists the names.
- **Fuzzy or case-insensitive team matching.** Rejected by ADR 0012.
- **Adapter-specific match ids** (`of-2024-0001`). Not stable when a line moves, and the API-Football cross-check could not find the same match. Rejected for the source-neutral `<date>-<home>-<away>`.
- **Hand-curated `competitions.json` and `seasons.json`, with adapters only referencing ids.** Possible, but splits the openfootball facts (season dates come from the files) across two places and needs a second consistency check. Rejected for config-owned reference records with a conflict check on upsert.
- **Season dates from the header `# Date` line alone.** The header of a partial file (2025) gives a wrong season end. Rejected: derived from matches, cross-checked against the header, with a cited override for partial files.
- **A general Football.TXT parser or an npm package.** These eight files use a small subset; a strict parser for that subset fails loudly on anything new, which is what we want. A third-party parser adds a dependency and accepts more than we test.
- **Writing `coverage.json` from the run report.** Coverage is per club and needs every source (issue #12). Rejected here; the report gives #12 the facts (per file: complete or partial, first and last date).
- **Live network in tests, or recording HTTP responses.** The files are CC0 text; committing byte copies is simpler and fully offline.

## Approval needed from Diego (before `/build`)

1. **NEEDS DIEGO: competition taxonomy (ADR 0015, decision 8).** Two competitions, `primera-division` (all league tournaments, one season per tournament) and `copa-de-la-liga-profesional` (`national_cup`, also used by Kaggle for 2021 to 2023), both `afa_recognized: true`, with the season ids and names of the table above. Alternative: one competition per tournament format (`superliga`, `liga-profesional`, `torneo-apertura`), which splits a club's league history into several competitions in the coverage notice and the title shelf. Recommended: the two competitions as proposed.
2. **NEEDS DIEGO: the two extra 2020 matches.** `Copa Sud, Final` (Vélez 2-3 Banfield, 2021-03-31, Copa Sudamericana qualifying match) and `Fase Complementación, Final` (Rosario Central 1-3 Vélez). Recommended: include both in `copa-de-la-liga-profesional-2020` with `is_final: false` (both were played under that tournament; neither awards a title, so they must not appear in the finals view). Alternative: exclude the Copa Sud match from the dataset (then the file check uses 134 matches and the run report says so).
3. **NEEDS DIEGO (only if the cited sources disagree): end date of the Torneo Apertura 2025.** Recommended: the date of the final from a permanent Wikipedia revision, verified against a second source by the builder. The source file stops on 2025-05-04 and the season stays partial in coverage (#12).
4. **Stage labels** (Spanish, table above). Low risk; recommended as proposed.

**Not needed for this plan:** the open decision of ADR 0003 (A: stay free, B: API-Football Pro, C: another free source for the current season). openfootball has no 2026 file and stopped in May 2025 whatever Diego chooses; that decision affects the API-Football follow-up, not this plan.

## Tasks

Test first in every task: write the failing test, then the code. Each task is one hour or less. Run `pnpm test` and `pnpm typecheck` before checking a task off.

### Group A: shared infrastructure (`scripts/ingest/core/`)

- [x] **T1 Deterministic serializer.** `tests/unit/scripts/ingest/serialize.test.ts`: for each data file, `serializeRecords(file, records)` sorts by `recordKey` (ties are an error, since they are duplicates), orders object keys as in the schema (a record built with shuffled keys gives the same bytes), uses two-space indent and a single final newline; shuffled input gives identical bytes; `prettier.format(output, { parser: "json" })` equals the output (import Prettier's API in the test); an empty list gives `[]\n`. Then `core/serialize.ts`.
- [x] **T2 Club resolver with report.** `tests/unit/scripts/ingest/club-resolver.test.ts`: with the real `data/clubs.json`, `Vélez Sarsfield` and its NFD spelling resolve to `velez-sarsfield`; every name in `KAGGLE_LOOKALIKE_NAMES` and `Velez Sarsfield ` (no accent, trailing space trimmed but accent missing) stay unresolved; `collect()` returns every unknown name once, sorted, each with its first `file:line`; two different names resolving to the same id within one season produce an error naming both and the season, while the same pair in different seasons does not. Then `core/club-resolver.ts` (uses `resolveClubId`).
- [x] **T3 Ownership merge.** `tests/unit/scripts/ingest/merge.test.ts`: owned matches (source prefix) are all replaced, a match with another source is kept untouched; a removed season's owned matches disappear; a missing competition or season is added; a deep-equal one is kept; one that differs in any field (for example `afa_recognized`) returns a `conflict` naming the file, id and fields, and no merged dataset. Then `core/merge.ts`.
- [x] **T4 Validate-then-write.** `tests/unit/scripts/ingest/commit.test.ts` (temporary directory per test): with a dataset that fails `validate()` the call rejects with every issue and every file in the directory keeps its original bytes and mtime, with no `.tmp-` file left; with a valid dataset only changed files are rewritten (an unchanged file keeps its mtime) and their bytes equal `serializeRecords`; `dryRun: true` never writes and returns the per-file added, removed and unchanged counts; a failure injected on the second rename leaves no temp file (document that a crash between renames can leave a partial update, mitigated by git). Then `core/commit.ts`.
- [x] **T5 Pinned fetch.** `tests/unit/scripts/ingest/pinned-fetch.test.ts` with an injected fake `fetch` (no network): a matching body resolves; a sha256 mismatch rejects with expected and actual hash and the file name; a non-200 status, a body over 1 MB, a host other than `raw.githubusercontent.com` and a timeout (fake that never resolves, `AbortSignal` honored) each reject with a clear message. Then `core/pinned-fetch.ts`.
- [x] **T6 Adapter interface and directory loader.** `tests/unit/scripts/ingest/adapter.test.ts`: the directory loader reads a fixture file and checks its sha256 like `fetchPinned`; a missing file rejects naming the path; a toy adapter implementing the interface runs through `runAdapter` (load, normalize, merge, commit) end to end in a temp dir. Then `core/adapter.ts` and the `runAdapter` orchestration.
- [x] **T7 CLI.** `tests/integration/ingest-cli.test.ts` (spawns `tsx scripts/ingest/index.ts`, like `validate-data-cli.test.ts`): no argument prints usage and exits 1; an unknown adapter exits 1 naming the known ones; `--from` with a missing directory exits 1; `--dry-run` never writes. Then replace the placeholder in `scripts/ingest/index.ts` with the registry and argument parsing (no new dependency; `node:util` `parseArgs`).

### Group B: openfootball adapter (`scripts/ingest/openfootball/`)

- [x] **T8 Record fixtures and config pins.** Copy the eight files byte for byte at the pinned SHA into `tests/fixtures/ingest/openfootball/` (no reformatting: add the folder to `.prettierignore` if Prettier would touch `.txt`; it does not by default), plus `README.md` (origin URL, commit SHA, CC0-1.0, refresh steps). `tests/unit/scripts/ingest/openfootball/config.test.ts`: the sha256 of each fixture equals `config.files[i].sha256`; every season references a configured competition; every id matches the slug regex of ADR 0012; every `source` is non-blank and the Wikipedia ones are `oldid` permalinks; `afa_recognized` values are the approved ones. Then `openfootball/config.ts`.
- [x] **T9 Header and line classification.** `tests/unit/scripts/ingest/openfootball/parse.test.ts`: the header of every fixture parses to the table in "Facts about the source" (edition, date range, teams, matches, stages); a line that fits no rule throws `file:line: unexpected line`. Then the line classifier and header parser in `openfootball/parse.ts`.
- [x] **T10 Dates.** Same file: year carried from the previous dated line; explicit year switch; the out-of-order 2018-19 block (`Sat Jan 19 2019` then `Fri Oct 19 2018`) gives the right dates; a wrong weekday (synthetic `Sat May 10 2024`) throws with file and line; a date line without year before any year throws; `Feb 29` on a non-leap year throws.
- [x] **T11 Match lines and scores.** Same file: lines with and without kickoff time; names with accents, apostrophe and spaces (`Newell's Old Boys`, `Central Córdoba SdE`); `N-N`, `N-N (N-N)` and `5-3 pen. (1-1, 0-0)`; a shoot-out with a non-drawn regulation score or a drawn shoot-out throws; `2-1 a.e.t.`, `awd.`, a missing score and a match line before any date line each throw with file and line.
- [x] **T12 Stages and file-level checks.** Same file: every heading of the eight fixtures maps through the stage map (table above); an unknown heading throws; synthetic files where the match count, team count, date range or a `# Stages` count disagree with the header each throw naming the check; a duplicated match line throws. All eight fixtures parse with no error and the counts of the facts table.
- [x] **T13 Normalize matches.** `tests/unit/scripts/ingest/openfootball/normalize.test.ts` with fixture clubs (`tests/fixtures/ingest/openfootball/clubs.ts`: the real 29 plus 5 synthetic records with the aliases of the five missing names): every record passes `matchSchema`; ids follow `<date>-<home>-<away>`; Boca Juniors v Banfield (2020) has goals 1-1, `decision: "penalties"`, penalties 5-3, `is_final: true`; the Copa Sud and Complementación finals have `is_final: false` (per approval item 2); every `source` is the permalink with the right `#L` line (assert the fixture line at that number contains both team names); `verified` is false. Golden spot checks from ADR 0003: `2022-10-23-boca-juniors-independiente` 2-2, `2022-10-23-racing-club-river-plate` 1-2, `2023-07-15-river-plate-estudiantes-la-plata` 3-1. Then `openfootball/normalize.ts`.
- [x] **T14 Normalize seasons and competitions; run report.** Same file: seasons and competitions equal the approved table; season `start`/`end` equal the first and last parsed dates for the seven complete files; `primera-division-2025-apertura` has the cited end and the report marks it `partial: true` with last source date 2025-05-04; the report lists per file the parsed and header counts. Then the season builder and report.
- [x] **T15 `date_precision` (only if #38 is merged before this task).** Every match has `date_precision: "day"` and passes the updated schema. If #38 is not merged, skip this task and note in the PR that #38 must add the field to the adapter. **Skipped: #38 is not merged; #38 must add `date_precision` to the adapter.**

### Group C: end to end and failure modes

- [x] **T16 Determinism and validity on fixtures.** `tests/integration/ingest-openfootball.test.ts`, temp `data` dir seeded with fixture clubs, `--from` the fixtures: the run exits 0; the written dataset passes `validate()`; it holds 2 competitions, 8 seasons and 2,435 matches (sum of the facts table; 2,434 if approval item 2 excludes the Copa Sud match); a second run produces byte-identical files and reports zero changes; a pre-existing match with a non-openfootball source in the same dir survives both runs; `pnpm exec prettier --check` passes on the output.
- [x] **T17 Failure leaves `data/` untouched.** Same file, one case each, all comparing every file's bytes before and after: fixture file truncated mid-line (hash mismatch); a modified copy whose hash is updated in a test-only config but whose `# Matches` is wrong; the real 29-club `clubs.json` (exits 1 and the message lists exactly the unresolved names of the facts table, sorted); a pre-existing `primera-division` competition with `afa_recognized: false` (conflict); an existing `data/matches.json` that is invalid JSON (stops before merging). Each prints a clear one-line message per problem.
- [x] **T18 No network in tests.** `tests/unit/scripts/ingest/no-network.test.ts`: stub `globalThis.fetch` to throw and run the full fixture ingestion through `runAdapter` with the directory loader; it passes. (Keeps a future refactor from slipping a real fetch into the test path.)

### Group D: docs and verification

- [x] **T19 Methodology and docs.** Add an "Ingestion" section to `docs/methodology.md`: the adapter contract in five bullets (pinned input, ownership, write-only-on-valid, determinism, unknown clubs stop the run), the openfootball stage map and `is_final` rule, the match id rule, and that openfootball records are `verified: false`. Update ADR 0015 status to Accepted with Diego's answers. Add `pnpm data:ingest` to the commands line of CLAUDE.md (project instructions change: ask Diego in the PR). **CLAUDE.md was not changed: the `pnpm data:ingest` command line needs Diego approval in the PR.**
- [x] **T20 Real-source dry run (manual, network).** `pnpm data:ingest openfootball --dry-run` against GitHub: the hashes match the config, all eight files parse, and the run fails only with the unresolved club names of the facts table, writing nothing (`git status` clean). Paste the output in the PR. If the hashes differ (upstream changed), stop and re-plan the pin.

## Tests to write

- **Unit** (`tests/unit/scripts/ingest/`): serializer, club resolver, merge, commit, pinned fetch, adapter runner, config, parser (header, dates, scores, stages, file checks), normalizer (matches, seasons, report), no-network guard.
- **Integration** (`tests/integration/`): CLI arguments; full fixture ingestion into a temp dir (validity, counts, determinism, idempotence, foreign records kept, Prettier); failure modes leave every file byte-identical.
- **E2E:** none. Nothing reaches the app until #8 commits data.

Edge cases covered: dateless year lines and year rollover; out-of-order rescheduled matches; weekday mismatch; leap day; kickoff time missing; accents, apostrophes and NFD spellings; lookalike names; two names for one club in a season; shoot-out final; non-title "finals"; unknown stage heading; header count, team count, date range and stage count mismatches; duplicated match line; partial 2025 file; unknown club; reference-record conflict; hash mismatch, oversized body, wrong host, timeout; invalid existing JSON; crash during write; unchanged files not rewritten.

## Impact

- **Data:** no change to `data/` in this PR. New contract (ADR 0015): ids of competitions, seasons and day-precision matches, ownership by `source` prefix. When #8 runs the adapter: about 2,435 match records (roughly 0.8 MB of JSON), 8 seasons, 2 competitions, all `verified: false`. `matches.json` is not imported by the app today (only `clubs.json` is, in `src/lib/club-catalog.server.ts`), so there is no bundle impact; #10 seeds it into Supabase.
- **Design / UI:** none. Stage labels are Spanish values for later display.
- **Security:** no key, no secret, no `.env*`. Network access only from the CLI, only to `raw.githubusercontent.com` at a pinned commit, with timeout, 1 MB cap and sha256 check; content is parsed as text with a strict grammar (no `eval`, no dynamic import). Writes only inside the target directory, through temp file and rename. Fixtures are CC0 text.
- **Performance:** eight files, about 194 KB in total, parsed in milliseconds; the validator over about 2,500 matches is the slowest step and stays well under a second. CI time grows by the new unit and integration tests only.
- **Licensing:** openfootball is CC0; credit is a courtesy and is part of issue #50 (About page).

## Risks and how to verify it is finished

| Risk                                                                         | Mitigation                                                                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Year inference assigns the wrong year to a date line                         | Weekday check on every date line, plus first and last date equal the header range.                                                                                               |
| Kickoff times are not local, so a late match falls on the wrong calendar day | Times are written as local in these files; the ADR 0003 spot checks agree on dates; T13 golden matches. A follow-up cross-check with API-Football (2022 to 2024) compares dates. |
| Upstream reformat changes line numbers or content                            | Pinned SHA and hashes: nothing changes until a PR moves the pin.                                                                                                                 |
| A partial write if the process dies between renames                          | Temp files written first, then renames; git shows any partial change; rerun is idempotent.                                                                                       |
| Taxonomy changes after #8 commits data                                       | ADR 0015 marks the ids as a contract; change before #8, through Diego's approval.                                                                                                |
| `date_precision` schema (#38) lands after this plan                          | T15 is conditional; the strict schema makes the gap visible in CI.                                                                                                               |
| Real data can only be written after #48 and the four former clubs            | Stated in "What this plan does not write"; T20 proves the adapter reports exactly those names.                                                                                   |

Done when: T1 to T20 are checked (T15 may be skipped as stated); `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm data:validate` pass; `data/` has no diff; the T20 dry-run output is in the PR; ADR 0015 is Accepted with Diego's answers to approval items 1 to 4; the auditors' review is approved (`agentes:aprobado`).

## Suggested follow-up issues (not planned here)

1. **API-Football adapter** (league and cups 2022 to 2024 on the free plan): reuses `core/`; server-only key from the environment, request budget under 100 per day with a hard stop and a dry-run cost estimate; filter fixtures by round to separate Liga Profesional from Copa de la Liga (ADR 0003: 581 fixtures for 2022); reduced or synthetic fixtures if the vendor terms forbid committing responses; cross-check against openfootball 2022 to 2024 (ids, dates, scores) to set `verified: true`; cups need new competitions (Copa Argentina, Libertadores, Sudamericana). Depends on the ADR 0003 open decision only for seasons beyond 2024.
2. **Kaggle adapter** (1931 to 2023, season precision): needs #38 merged; tournament-name normalization (`Liga Profesional  2015`, `2016/2017`, `Campeonato 1985/86`); sourced season start and end dates (ADR 0011); season-precision id scheme; skips tournaments already covered by openfootball (one source per match, ADR 0011 decision 6; home and away swaps noted in ADR 0003); reuses `copa-de-la-liga-profesional` for 2021 to 2023. The CSV is not committed: fixtures must be synthetic.
3. **Add the four former Primera clubs** (Arsenal de Sarandí, Colón de Santa Fe, Patronato de Paraná, San Martín de Tucumán) to `data/clubs.json`, if #8 does not take them explicitly, following plan 0007 rules. Together with #48, this unblocks the first real openfootball data commit.
