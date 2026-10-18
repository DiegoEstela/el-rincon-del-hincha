# Review of plan 0016: rivalry detail (#66)

Date: 2026-10-18. Branch `feat/66-rivalry-detail`.

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| ui-designer-auditor    | APPROVED |
| data-integrity-auditor | APPROVED |
| security-auditor       | APPROVED |

## Applied

- `encodeURIComponent` on the club id in the document URL (defense in depth).
- Long names for PJ, PG, PE, PP as `aria-label` (touch and screen readers do not get `title`).
- `IDENTICAL_MANY` hoisted to a module constant; the `useClubDocuments` doc says the loader must be idempotent and cached.

## Accepted, not changed

- Runtime route cache keeps one entry per distinct unknown id (ADR 0019). On Vercel it is the platform cache; when self-hosting, add a proxy rule that answers 404 for ids outside the slug pattern.
- The two plain coverage lines under the notice push the numbers down on phones; `CoverageNotice` is shared with `/rivales`, so any change is a separate issue.
- Duplicated header markup in the two pending branches of `RivalryScreen` (small, covered by tests).
- Pre-existing `braces` advisory (issue #4).
