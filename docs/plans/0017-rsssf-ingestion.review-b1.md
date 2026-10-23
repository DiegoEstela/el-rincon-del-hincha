# Review — plan 0017, Phase B, PR B1 (opponents and the cup layout, issue #70)

Branch `feat/70-opponents-and-cup-layout`. No change to `data/`.

| Auditor  | Verdict               | Outcome                                                            |
| -------- | --------------------- | ------------------------------------------------------------------ |
| Security | Approved              | No findings                                                        |
| Data     | Changes required (M1) | Fixed: the CLI now prints the names dropped without being resolved |
| Code     | Changes required (1)  | Same finding as M1, fixed; suggestions below                       |

## Fixes after the review

- `scripts/ingest/core/report.ts`: the CLI prints a WARNING line with every unresolved name of the dropped matches of a cup, so a missing alias of an app club is seen. Tested (`report.test.ts`), plus a test of the exact case (app club with a missing alias against a known opponent).
- A comment on the Zod refinement points to the SQL constraints, so both change together.

## Accepted as they are

- L1: the same-season spelling-variant check does not run on dropped matches. It only concerns clubs that are not app clubs, so no figure changes.
- `opponentCrest` is not used by a screen yet (decision D-B2 of Diego); it ships tested and is wired when a screen shows an opponent crest.
- The opponents set of `groupRivals` is rebuilt per call: the club list is small and the call is made once per render.
- Before B2 writes figures, three of them are checked against a second source (Copa Argentina 2025 final, Trofeo de Campeones 2025, Supercopa Argentina 2024) and the source is recorded in the plan.

## Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test --coverage` (1,983 tests, 100% branches in `src/**`), `pnpm data:validate`, `pnpm data:coverage --check`.
