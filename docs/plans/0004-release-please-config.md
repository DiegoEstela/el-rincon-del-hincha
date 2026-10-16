---
issue: 31
status: done
date: 2026-10-16
---

# Plan 0004: Keep release-please in 0.x

## Goal

release-please proposed 1.0.0 (PR 28) because no release exists yet and its default initial version is 1.0.0. The project rule is that 1.0.0 is only published when Diego decides. Diego chose to stay in 0.x (decision of 2026-10-16).

## Approach

- Add `release-please-config.json` (node release type, plain `vX.Y.Z` tags, `bump-minor-pre-major`) and `.release-please-manifest.json` anchored at `0.1.0`. The action reads both from the repo root by default, so the protected workflow file is not touched.
- Below 1.0.0: `feat` bumps minor, `fix` bumps patch, breaking changes bump minor.
- First release will therefore be 0.2.0 (two `feat` commits already landed).

## Tasks

- [x] Test first: `tests/unit/release-config.test.ts` (red: files missing).
- [x] Add the config and the manifest (green).
- [ ] After merge: confirm release-please updates or replaces PR 28 with a 0.x version; close PR 28 if it is not updated.

## Risks

- PR 28 keeps proposing 1.0.0 until release-please reruns; it is never merged because it lacks the `agentes:aprobado` label.
- To force a specific first version later, a temporary `release-as` can be added.
