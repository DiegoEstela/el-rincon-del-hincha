# Review report: plan 0011 (ingestion core and openfootball adapter, issue #7)

## Verdicts

| Auditor                | Verdict  |
| ---------------------- | -------- |
| code-reviewer          | APPROVED |
| security-auditor       | APPROVED |
| data-integrity-auditor | APPROVED |

`ui-designer-auditor` was not needed: no UI, styles or routes changed.

## Findings and what was done

Fixed in this PR:

1. **Multi-file write was not atomic** (code-reviewer, important). If a later `rename` failed, files already replaced stayed replaced. `commitDataset` now restores them (or removes files that did not exist) and a test asserts the bytes are unchanged after an injected failure.
2. **Flaky tests under load** (code-reviewer and data-integrity-auditor). The line-lookup test re-read every file about 2,400 times; it now caches the lines and the slow Prettier runs have explicit timeouts.
3. **A pure module imported the file system** (code-reviewer). `IngestError` moved to `scripts/ingest/core/errors.ts`; `normalize.ts` no longer reaches `node:fs` through `commit.ts`.
4. **Redirects** (security-auditor). `fetch` now uses `redirect: "error"`, so a 3xx can never leave the host allowlist.
5. **Size cap read after the whole body** (security-auditor). The body is now read in chunks and aborted as soon as it passes the cap; a declared `content-length` over the cap is rejected first.
6. **Predictable temp file** (security-auditor). The temp file is removed and recreated with the `wx` flag, so it never follows a symlink or reuses a stale file.
7. `stageGroup` throws instead of returning a placeholder; a team playing itself is rejected; errors about the `# Date` header name its real line; `merge` uses a `Map`; the CLI registry has a justified `any` and an `instanceof Error` guard.
8. The comment on the 2025 season end now names the confirming sources (La Nación and Noticias NQN) instead of an uncited claim.

Known and left as is:

- `pnpm audit --audit-level=high` reports the dev-only `braces` advisory GHSA-vfj7-8cjw-p6xm (issue #4); it is not introduced by this branch.
- The Copa Sudamericana qualifier score (Vélez 2-3 Banfield) and Rosario Central 1-3 Vélez were not independently confirmed beyond winners and dates. Those records are `verified: false`, which is the correct state.
- The partial status of the 2025 season exists only in the run report. The coverage table (#12) must make it visible when real data is committed.
- The two-step rename can still leave a mixed state if the process is killed between renames. Git shows any partial change and a rerun is idempotent.

## Checks run

`pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` (83 files, 1244 tests), `pnpm data:validate`, `pnpm build`, `pnpm e2e` (190 tests). Real-source dry run (T20): hashes matched, all 8 files parsed, and the run failed only with the 5 unresolved club names, writing nothing.
