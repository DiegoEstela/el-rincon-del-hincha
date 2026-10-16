# Review report — Plan 0006 (issue #6)

| Auditor          | Round 1          | Round 2  | Round 3                                  |
| ---------------- | ---------------- | -------- | ---------------------------------------- |
| code-reviewer    | CHANGES REQUIRED | APPROVED | APPROVED                                 |
| security-auditor | APPROVED         | APPROVED | CHANGES REQUIRED (fixed, not re-audited) |

The three-round limit was reached. Diego was told and decided on 2026-10-16 to merge without a fourth audit of the last fix.

## What the audits changed

- **Blocking bug (code review, round 1).** The `matches` penalty `CHECK` evaluated to NULL when `decision` was NULL and both penalty counts were set; a CHECK treats NULL as passing, so the database accepted a row the validator rejects. Fixed with `is not distinct from`, and covered by a truth-table test of 972 cases that runs a small three-valued SQL evaluator against the real validator `checkScores`. The test is shown to fail on a kept copy of the old check.
- **Missing static tests.** Foreign keys (derived from the Zod schemas), indexes (parsed from the plan), row checks and the composite title key are now tested; 21 deleted constraints on scratch copies each turned a test red.
- **`verify.sql`** ended in `rollback`, so the SQL Editor would have shown no rows. It is now one `DO` block that always ends by raising an exception carrying the report (the single statement is rolled back, no side effects), with a minimum-checks floor so zero checks cannot read as all OK. It had not been executed on a real Postgres when this review was written; its first live run (Diego, 2026-10-16) reported ALL 32 CHECKS OK.
- **Statement allowlist in the SQL gate.** Unrecognised statements used to be ignored silently. Now only an allowlist passes; `disable` and `force row level security`, unknown grant targets, `E'...'` strings, anything other than the exact `cron.schedule` and `cron.unschedule` shapes, and unreadable `$` all fail loudly.
- **Round 3 security finding (fixed).** Dollar-quote tags with digits or non-ASCII letters (`$a1$`, `$é$`) were not recognised, so a lone quote inside one could hide a `grant` from the gate. The tag grammar now follows PostgreSQL and any other `$` fails the gate. Verified with the auditor's exact input, a `$é$` variant and a plain grant (all red). **This last fix was not re-audited.**
- **Honesty about status.** The ADR was first marked Accepted citing a delegation by Diego that was not explicit; it went back to Proposed and is now Accepted with his explicit confirmation of the seven decisions.

## Not done here

- Resolved after the review (plan T13): the migrations were applied to the live Supabase project on 2026-10-16 and `verify.sql` reported ALL 32 CHECKS OK, as reported by Diego. Steps are in the README, section "Database migrations".
- `v_min_checks` is a floor (16 of about 31 emitted lines), not an exact count.
- Plpgsql and function bodies are not inspected by the gate for `grant` or `alter` statements.

## Known

`pnpm audit` reports only the dev-only `braces` advisory tracked in #4.
