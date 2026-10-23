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
