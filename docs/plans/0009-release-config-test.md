---
issue: 53
status: done
date: 2026-10-17
---

# Plan 0009: Release-config test stops pinning manifest version 0.1.0

Related: plan [0004](0004-release-please-config.md) (release-please configuration), issues #31 and #33. No new ADR: this change keeps the existing release policy (stay in 0.x, manifest in sync with `package.json`) and only fixes how the test expresses it.

## Goal

`tests/unit/release-config.test.ts` line 23 asserts `expect(manifest["."]).toBe("0.1.0")`. Every release-please PR bumps the manifest and `package.json`, so the required `test` check fails on release PR #28 (0.2.0) with `expected '0.2.0' to be '0.1.0'` and blocks releases. The intent of the test is "below 1.0.0 and in sync with `package.json`", not "exactly 0.1.0". The same `it` block already asserts `startsWith("0.")` and `pkg.version === manifest["."]` (lines 24 and 25), so the fix is to drop the pinned assertion and prove that the remaining rule accepts 0.1.0 and 0.2.0 and rejects 1.0.0 and a mismatch.

## Acceptance criteria (copied from issue #53)

- Given the manifest and `package.json` are both at `0.1.0`, when `pnpm test` runs, then the release-config test passes.
- Given the manifest and `package.json` are both at `0.2.0`, when `pnpm test` runs, then the release-config test passes.
- Given the manifest version reaches `1.0.0`, when the test runs, then it fails.
- Given the manifest version differs from the `package.json` version, when the test runs, then it fails.
- Given the fix is merged, when release PR #28 is updated, then it can pass the required `test` check.

Out of scope (from the issue): any app code change; changing the release-please configuration or workflow; cutting or publishing a release.

## Approach

- In `tests/unit/release-config.test.ts`, add a small local helper (test file only, not in `src/`) that encodes the rule: `isValidPreMajorRelease(manifestVersion, pkgVersion)` returns true only when `manifestVersion.startsWith("0.")` and `manifestVersion === pkgVersion`.
- Add a table test (`it.each`) over fixed fixtures so the acceptance criteria are covered without editing the real files: `0.1.0/0.1.0` true, `0.2.0/0.2.0` true, `1.0.0/1.0.0` false, `0.2.0/0.1.0` false.
- Rewrite the existing "anchors the last released version..." case to apply the same rule to the real `.release-please-manifest.json` and `package.json`, removing the `toBe("0.1.0")` line. Keep two explicit `expect`s (`startsWith("0.")` and equality with `package.json`) so a failure message says which half broke.

### Discarded alternatives

- **Just delete line 23**: fixes CI, but nothing proves the 1.0.0 and mismatch criteria fail; the table test is a few lines and makes the criteria executable.
- **Regex on full semver (`/^0\.\d+\.\d+$/`)**: stricter, but release-please always writes clean semver here and the issue asks for `startsWith("0.")`; not worth the divergence.
- **Move the rule to `src/domain`**: it is release tooling, not business logic; the issue says test-only.
- **Bump the pinned value to 0.2.0**: breaks again on the next release.

## Tasks

- [x] T1 (test first, ~15 min): add the `it.each` table test for `isValidPreMajorRelease` with the four fixtures above. Run `pnpm test tests/unit/release-config.test.ts`: red because the helper does not exist yet.
- [x] T2 (~10 min): add the helper in the test file. The table test goes green.
- [x] T3 (~10 min): in the real-files case, remove `expect(manifest["."]).toBe("0.1.0")`, keep the `startsWith("0.")` and `package.json` equality assertions. Verify locally by temporarily setting both files to `0.2.0` (test passes), then manifest to `1.0.0` (fails) and a mismatch (fails); revert both files to `0.1.0` before committing.
- [x] T4 (~10 min): `pnpm lint`, `pnpm typecheck`, `pnpm test`. Commit `test(release): check the manifest stays in 0.x and matches package.json instead of pinning 0.1.0` with `Fixes #53`.

## Tests to write

- Unit (`tests/unit/release-config.test.ts`): the table test (2 pass cases, 2 fail cases) and the real-files case.
- Integration and e2e: none (no runtime code changes).
- Edge cases: `1.0.0` rejected; `0.2.0` vs `0.1.0` rejected; the real files remain at `0.1.0` on this branch.

## Impact

- Data: none. Design: none. Security: none (no secrets, no workflow change). Performance: none.
- Guardrails: `.github/workflows/**`, `release-please-config.json` and `.release-please-manifest.json` are not modified (manual edits in T3 are local only and reverted).

## Risks and mitigation

- **Leaving a temporary 0.2.0 or 1.0.0 in a committed file** (T3 manual check): `git diff` must show only the test file before committing.
- **Release PR #28 still red after merge**: release-please regenerates the PR on the next push to `main`; if it does not, rebase or re-run its checks. Verify the `test` check on #28 is green.
- **Loosening too much**: the other cases in the file (`bump-minor-pre-major`, no `release-as: 1.x`, workflow without `release-type`) still guard against an accidental 1.0.0.

## Definition of done

- `pnpm lint`, `pnpm typecheck` and `pnpm test` green locally and in CI.
- The diff touches only `tests/unit/release-config.test.ts` (plus this plan's status).
- The four acceptance fixtures are covered by the table test.
- After merge, release PR #28 passes the required `test` check.
