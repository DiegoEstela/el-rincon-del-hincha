# Review — plan 0018 (vitrina, issue #67)

Branch `feat/67-vitrina`. Four auditors reviewed the diff in parallel.

| Auditor  | Verdict                         | Outcome                                                        |
| -------- | ------------------------------- | -------------------------------------------------------------- |
| Security | Approved                        | Suggestion applied: `source` is now checked in the title guard |
| Data     | Approved                        | No findings                                                    |
| Code     | Approved with 2 important items | Both fixed (see below)                                         |
| UI       | Changes required                | All findings fixed (see below)                                 |

## Fixes applied after the review

- Accessible name of each trophy starts with the text it shows (WCAG 2.5.3, label in name).
- Counters use the singular when the count is 1 ("Trofeo que te falta").
- Disputed titles carry a visible "No cuenta" tag, not only a dashed outline.
- The per-competition coverage lines are folded under "Ver qué cargamos" so the note does not push the shelf down on phones.
- The caption of a silhouette is clamped to the seasons of the title window that the fan lived, so "te falta" is never claimed for a season before the fan arrived.
- The detail dialog keeps its padding on an inner box, so a click on the padding no longer closes it as a backdrop click.
- `titleCoverage` computes the last titled season with `lastIndexOf`; the clock comment in the screen is explicit.

## Verification

- `pnpm lint`, `pnpm typecheck`: clean.
- `pnpm test --coverage`: 1,933 tests, 100% statements and branches in `src/**`.
- `pnpm build` and `pnpm e2e`: green for the vitrina on iphone, android and desktop; `/vitrina` is 151.5 KB gzip JS (limit 170).

## Verdict

Approved for PR once CI is green.
