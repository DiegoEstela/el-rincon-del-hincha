---
name: build
description: Implements a plan with TDD on an isolated branch and worktree. Usage: /build NNNN
---

1. If .claude/AUTOPILOT_OFF exists, work locally only and say so.
2. Create the branch `feat/N-slug` (or fix/, chore/, data/) in an isolated worktree.
3. For each task of the plan: write the test -> check that it fails -> implement the minimum -> green test -> refactor -> conventional commit (`feat(vitrina): ...`). Mark the task `[x]` in the plan.
4. When done: `pnpm lint && pnpm typecheck && pnpm test && pnpm data:validate && pnpm build && pnpm e2e`.
5. Mark the plan `status: done` and continue with /review.
