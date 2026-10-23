# Review — plan 0017, Phase B, PR B2 (domestic cups 2023 to 2025, issue #70)

Branch `feat/70-cups-data-2023-2025`.

| Auditor  | Verdict  | Outcome                                                                                                                                                          |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data     | Approved | Every kept match (60, 60 and 62 of the Copa Argentina) and the 8 single-match sections agree with the excerpts; the 11 titles belong to the winner of each final |
| Code     | Approved | Five suggestions, applied below                                                                                                                                  |
| Security | Approved | No findings                                                                                                                                                      |

## Applied after the review

- A test of a glued shoot-out note with a `pso` inside the name; a test that the adapter writes only the competitions of its tournaments; a comment on the silent exit of the title when neither side is an app club.
- `/acerca` now says that the cups are used too (the sentence said "solo la primera división").
- Section C of `docs/spike/rsssf-cups-names-b2.md` records its final state.

## Left as they are

- `pickLiga` is repeated in two e2e specs; a shared helper is not worth a file for two lines.
- The plain spellings `CA Central Córdoba` and `CA Sarmiento` are global aliases of Santiago del Estero and Junín. PR B2b and B3 re-check the page tables before they rely on them, as B2 did.
- A club that is not in an edition has no coverage row for it (Aldosivi has none for the Copa Argentina 2024): honest, and earlier editions are not claimed.

## Verification

`pnpm lint`, `pnpm typecheck`, `pnpm test --coverage` (2,061 tests, 100% branches in `src/**`), `pnpm data:validate`, `pnpm data:coverage --check`, `pnpm build`, `pnpm e2e` (326 passed). Cross-check of the 11 editions with the Spanish Wikipedia in the plan.
