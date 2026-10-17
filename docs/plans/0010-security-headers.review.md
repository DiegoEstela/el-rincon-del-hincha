# Review report: plan 0010 (security headers and CSP, issue #55)

## Verdicts

| Auditor          | Verdict  |
| ---------------- | -------- |
| code-reviewer    | APPROVED |
| security-auditor | APPROVED |

`ui-designer-auditor` and `data-integrity-auditor` were not needed: the diff touches no UI, data or `src/domain` code.

## Checks run

- `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (71 files, 1123 tests), `pnpm data:validate`, `pnpm build` and `pnpm e2e` (190 tests) all green on the branch.
- `pnpm audit --audit-level=high`: only the known dev-only `braces` advisory GHSA-vfj7-8cjw-p6xm (issue #4).

## Non-blocking notes (not fixed in this PR)

1. The e2e test "cannot be framed by another page" is weak (hardcoded `localhost:3000`, fixed timeout). The `X-Frame-Options` and `frame-ancestors` headers are already asserted on every route.
2. The e2e test "keeps the full referrer inside the site" can pass without asserting if no document request is captured. Add `expect(navigation).toBeDefined()`.
3. Dev-only: older Safari may not match `ws:` against `'self'` for HMR. Add `ws://localhost:*` to the dev `connect-src` only if it ever breaks.
4. `tests/unit/next-config.test.ts` reads `[0].headers[0]`; finding the header by key would be sturdier.
5. HSTS is sent by Vercel on its HTTPS domains. Set it explicitly if a custom domain is attached.
6. `script-src 'unsafe-inline'` is the main residual weakness. It is justified and recorded in ADR 0014 (with when to revisit).

## Still open

T10 (Vercel preview check of the PR) is done after the PR is opened, before merge.
