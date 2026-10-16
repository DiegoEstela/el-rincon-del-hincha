# Review report — Plan 0005 (issue #14)

| Auditor                | Round 1                       | Round 2          | Round 3  |
| ---------------------- | ----------------------------- | ---------------- | -------- |
| code-reviewer          | APPROVED (with one important) | —                | APPROVED |
| security-auditor       | APPROVED (with advisories)    | —                | —        |
| data-integrity-auditor | CHANGES REQUIRED              | CHANGES REQUIRED | APPROVED |

## What the audits changed

- **Coverage notice (data audit, rounds 1 to 3).** This is the finding that mattered most for the product rule "incomplete data is never presented as complete".
  - Round 1: a head-to-head dropped a competition covered for only one club.
  - The first fix (code review) restricted the notice to coverage rows overlapping the period, which removed false warnings but left a hole: a coverage row that ended before the period means the ingestion stopped, not that the competition is irrelevant, so the notice could say complete while a cup was not loaded.
  - Round 2 asked for the seasons table as the universe of competitions played. Final rule: competitions with counted matches, or a coverage row of any club involved overlapping the period, or a season overlapping the period in which a club involved has any coverage row or any match ever. A competition neither club ever touched stays unlisted.
  - Accepted limitation, documented for the UI: a competition with no row and no match anywhere is unknown to the engine, and a club that left a competition shows it as `missing` for later fans (a safe false warning).
- **Privacy (security audit).** The `RangeError` for an invalid start date no longer contains the date; a test with three bad dates guards it.
- **Documentation.** `docs/methodology.md` documents the final selection rule and three UI notes: an empty period must not show a complete-coverage badge, relegations have no coverage qualifier, and final series can include legs outside the period.
- **Line endings.** An editing tool converted files to CRLF once; the final review verified 0 CRLF files.

## Advisories for the route handlers (issue #43)

`fanPeriod` throws on an invalid date and `headToHead` throws when club and rival are the same; both are reachable from user input, so Zod validation and a 400 response belong in the route handlers.

## Not addressed (deliberate)

- `rivals.test.ts` has no test of the season-based rule; the rivals path calls the same shared function.
- `known` in `relevantCompetitionIds` could dedupe by season before the lookup (micro-optimization).
- The real-data golden fixtures are tracked in issue #36 because `data/` is still empty.

## Known

`pnpm audit` reports only the dev-only `braces` advisory tracked in #4.
