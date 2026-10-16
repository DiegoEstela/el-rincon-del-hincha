# Review report — Plan 0003 (issue #9)

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| security-auditor       | APPROVED |
| data-integrity-auditor | APPROVED |

All three approved with non-blocking notes. Verified independently by the orchestrator before the review: 330 tests passing, 100 percent branches in `src/data-model` and `src/domain`, no change in `.claude/**`, `.github/**`, `package.json` or the lockfile. The 100 percent is not gamed: no `istanbul`, `v8 ignore` or `any` in the changed code.

## Addressed after the review

- `groupBy` no longer copies the array on every insert (security and code review).
- The CLI prints `directory not found` and exits 1 for a missing directory instead of a raw stack trace (test first: it failed before the fix). The usage comment now says the directory argument may point outside the repo.
- The BOM in the CLI is written as the escape `﻿` so an editor cannot drop it (code review).
- Two tests added (data-integrity review): exactly 00:00Z maps to the previous Buenos Aires day, and a season spanning two calendar years.
- `docs/methodology.md` now says non-league competitions need a final, matching the code.

## Not addressed (deliberate)

- `standings-mismatch` tallies matches per standings row (rows times matches). It is fine for the expected volume; index by season if standings grow.
- A record that fails the shape check is dropped, which can add noise such as a `standings-mismatch` next to the real error. Noisy but not wrong, as the plan describes.
- Error messages echo input-derived strings without truncation. It is a local CLI that prints to stderr.
- The commits bundle tests with the implementation, so red-first cannot be proven from history. The catalogue test (one failing fixture per rule) and the new CLI test, which was observed failing before its fix, are the evidence.

## Known

`pnpm audit` reports only the dev-only `braces` advisory tracked in #4.
