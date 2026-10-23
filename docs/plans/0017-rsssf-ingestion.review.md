# Review of plan 0017: RSSSF ingestion, first slice (#70)

Date: 2026-10-23. Branch `feat/70-rsssf-ingestion`.

| Auditor                | Verdict                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| code-reviewer          | CHANGES REQUIRED, then fixed (one important item, the rest applied)     |
| data-integrity-auditor | APPROVED (270 matches, 30 standings and the coverage checked by script) |
| security-auditor       | APPROVED                                                                |
| ui-designer-auditor    | APPROVED                                                                |

## Applied after the review

- A fixture abandoned twice before it is completed is now an error (it used to drop one silently).
- A completion before the abandonment, a bad completion date and a played match without a score are collected problems.
- A table exception for a tournament whose table is not checked is reported as unused.
- Slicer markers outside latin1 and numeric entities out of range fail with a clear message.
- Comments and ADR 0020 aligned with the code (source prefix, the wording about encodings and writes).
- The 44 px end to end test measures the layout height, not the animated box.

## Accepted, not changed

- Table exceptions apply to the whole row of a club (they say why); listing the expected fields is a refinement for the day an exception is needed.
- `--cross-check` and `--network` are wired in the core but not implemented for RSSSF yet (T22 and the network loader): this PR does not claim them.
- The run report marks the extending tournament as complete; cosmetic.
- Long official club names are no longer search keys in the picker; natural names are.
- Data auditor note for later: the old openfootball record `2025-03-22-godoy-cruz-talleres-cordoba` (abandoned and resumed per RSSSF) may need its date checked against a second source.

## Second slice: titles (2026-10-23)

| Auditor                | Verdict                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| data-integrity-auditor | APPROVED (nine titles, dates and table marks recomputed by script) |
| code-reviewer          | CHANGES REQUIRED, then fixed                                       |

Applied: the title date falls back to the last match of the season in the data as it will be after the run (not to the season `end`), a season with no match reports a problem, the matches of the adapter that the run replaces never date a title, and tests cover two finals in one season, a season with no match, the order of the two adapters and a second run.

Accepted, not changed: a title removed from a config is not cleaned up until the dataset is edited in a data PR; the table check covers the 2025 tournaments only (the other seasons have no final table in the excerpts); the layout parsers throw plain errors like the rest of the parsing layer.
