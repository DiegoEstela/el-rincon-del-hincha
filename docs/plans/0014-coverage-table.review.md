# Review report: plan 0014, Phase 1 (coverage table, issue #12)

Phase 2 (registering the competitions that are not loaded) is a separate PR and is not covered here.

## Verdicts

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| security-auditor       | APPROVED |
| data-integrity-auditor | APPROVED |

`ui-designer-auditor` was not needed: no UI, styles or routes changed.

## What the data auditor verified (with web access through curl)

- `pnpm data:validate`, `pnpm data:coverage --check` and the data-model, domain and coverage integration tests are green.
- The four Copa de la Liga edition dates of the gap list (12 Feb to 4 Jun 2021, 10 Feb to 22 May 2022, 17 Aug to 16 Dec 2023, 25 Jan to 5 May 2024) match the es.wikipedia infoboxes, and 2024 is called "la quinta y última edición".
- The Copa Diego Armando Maradona 2020 has 24 teams and 135 matches on Wikipedia, equal to the 135 matches loaded, so the edition is fully loaded.
- Six clubs hand-checked against `matches.json` (Aldosivi, Belgrano, Tigre, San Martín de San Juan, Arsenal, San Martín de Tucumán): no stretch covers a season the club did not play, and every club has an even match count per season, so there is no hole inside a season.
- Season dates and match totals agree with en.wikipedia for 2018-19 to 2025, and the relegated and promoted sets match.
- Over-claim analysis: Primera 2025 has exactly 16 matches per club until 2025-05-04 (the knockout stage is the gap); the 2020 stretches are true but vacuous because no Primera tournament was played from 2020-03-10 to 2021-07-15; the Copa 2020 stretch ends 2021-02-11, so the one later match (2021-03-31) is under-claimed, never over-claimed.

## Code review findings and what was done

- Gaps are now checked in the generator: a gap that ends before it starts or two gaps of one competition that share a day fail with a clear message (tests added, 100% branches kept).
- A test now covers a malformed record: no coverage is derived, the validator rejects the run and nothing is written.
- The methodology states that the generator only sees a missing tail, not a missing head or a hole inside a season, and that a new source must be checked against its header counts.
- Not changed: the fallback row for a competition without seasons cannot be reached (a declared gap gives every club a row), which is now noted in a comment.
- The `stats-world` test was relaxed from "no issue" to "only `missing-coverage` for `intl-z` and `league-old`" on purpose, so the engine's `missing` status stays testable. The reviewer accepted it.

## Known limits

- Phase 2 is open: the cups that are not loaded are not registered, so a short period can still read complete. No screen may show a complete badge before Phase 2 (stated in the methodology).
- The overlap rule compares adjacent rows only: a third overlap inside nested rows shows after the first is fixed, but the file still fails.
- `coverage-overclaim` only catches seasons with no match at all; partial seasons are enforced by the generator.
