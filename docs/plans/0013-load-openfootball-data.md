---
issue: 8
status: done
date: 2026-10-17
---

# Plan 0013: Load the openfootball data into data/

Related: [plan 0011](0011-ingest-openfootball.md) (the adapter), [plan 0012](0012-five-clubs.md) (the clubs that unblocked it), [ADR 0003](../adr/0003-data-sources.md), [ADR 0015](../adr/0015-ingestion-adapter-contract.md).

## Goal

First real data commit: run `pnpm data:ingest openfootball` and commit the three files it owns, `data/competitions.json`, `data/seasons.json` and `data/matches.json`. Nothing is edited by hand; the output is exactly what the adapter produces from the pinned openfootball commit `18fcfc4`.

`Refs #8` (not `Closes`): issue #8 also asks for titles, movements, rivalries and disputed titles, which come from other sources and other plans.

## What the data contains

- 2 competitions (`primera-division`, `copa-de-la-liga-profesional`), both `afa_recognized: true`.
- 8 seasons: 2018-19, 2019-20, 2020 (Copa Diego Armando Maradona), 2021, 2022, 2023, 2024 and 2025 Apertura (partial).
- 2,435 matches, every one `verified: false`, each with a permalink `source` to its exact line in the pinned file.
- Coverage is **not** complete: only the main league tournament of each year, nothing before 2018-19 and the 2025 Apertura only until 2025-05-04. The coverage table (#12) must say so before any screen shows a head-to-head record.

## Tasks

- [x] **T1.** Run the adapter against the real source: 8 files parsed, header counts equal, `data/` written, `pnpm data:validate` ok (4 files).
- [x] **T2.** Idempotence: a second run reports `+0 -0 =2435` and the file hash is unchanged.
- [x] **T3.** `pnpm lint` (Prettier check on `data/`) passes.
- [x] **T4.** Sanity checks: matches per season equal the file headers, all 34 clubs have at least one match, exactly one match is decided on penalties (Boca 1-1 Banfield, 5-3, the 2020 Copa de la Liga final, 2021-01-17) and exactly one match is a title final.
- [x] **T5.** Spot checks of five matches against sources independent of openfootball (below).
- [x] **T6.** Full gates: lint, typecheck, tests with coverage, `data:validate`, build, e2e.

## Spot checks (2026-10-17)

Five matches picked at fixed positions of the file (indexes 101, 777, 1203, 1800 and 2300), not chosen for being easy. Date and score agree with every source consulted.

| Match in `data/matches.json`                                                 | Independent sources                                                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2018-10-20 Godoy Cruz 2-0 Aldosivi (Superliga, matchday 9)                   | Diario de Cuyo (20 Oct 2018, "Godoy Cruz volvió a sonreír"), La Capital MdP, Unidiversidad. Goals: Burgoa and Ángel González.           |
| 2021-07-31 Platense 1-1 Independiente (Liga Profesional, matchday 4)         | ESPN (game 610208), Goal, Elonce. Goals: Schott and Roa.                                                                                |
| 2022-07-30 Atlético Tucumán 2-0 Newell's (Liga Profesional, matchday 11)     | Río Negro, Cadena 3, Diario de Cuyo (30 Jul 2022), Canal 26. ESPN lists it on 31 Jul because of its own time zone; Argentina is 30 Jul. |
| 2023-07-25 Barracas Central 0-0 Arsenal (Liga Profesional, matchday 26)      | ESPN (game 656569), El Gráfico. Referee Lamolina.                                                                                       |
| 2025-02-28 San Martín de San Juan 3-1 Belgrano (Torneo Apertura, matchday 8) | Minutouno, ESPN (game 728060), Futbol Total.                                                                                            |

## Limits (stated, not hidden)

- All 2,435 matches stay `verified: false`: five spot checks do not verify the file. The API-Football cross-check for 2022 to 2024 (follow-up of #7) is what can set `verified: true`.
- The kickoff time is not stored, so a late-night match is dated by the day the source writes (Buenos Aires). The 2022-07-30 match above shows the risk with foreign sites that use another time zone.
- The two odd 2020 matches (Vélez 2-3 Banfield, Rosario Central 1-3 Vélez) were not independently confirmed beyond winners and dates (see plan 0012 and the review of plan 0011).
- Supabase is not touched. `pnpm data:seed` (#10) needs credentials that only Diego can load.

## Impact

- **Data:** about 1.3 MB of JSON in `data/` (Prettier-formatted, so larger than the compact estimate). Not imported by the app yet, so no bundle impact.
- **Design, security:** none. No new dependency, no secret, no personal data.
- **Next:** #10 (seed), #12 (coverage table), then the screens that read the data.

## Definition of done

Files committed byte-for-byte as produced by the adapter, CI green (including the `data` job on the full dataset), reviews approved, plan marked done.
