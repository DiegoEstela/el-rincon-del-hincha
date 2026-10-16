# 0004 — Agents and guardrails

## Context

Agents may run the whole cycle (issue, plan, build, review, ship, release). Limits must be enforced by code, not by good intentions.

## Decision

Seven subagents and seven skills in `.claude/`, plus three hooks written in Node (`guard-bash.mjs`, `guard-files.mjs`, `format.mjs`) with unit tests in `tests/unit/hooks/`, permissions in `.claude/settings.json` and GitHub branch protection on `main`.

Adjustments made against the master prompt (it asked to follow current docs and record deviations):

- Hooks export a pure `evaluate()` function so every rule is unit-testable.
- `.env.example` stays editable (it is the committed template); every other `.env*` file is blocked.
- The `.env` rule matches file names only, so `process.env` or branches like `feat/main-menu` are not false positives.
- Shell commands touching `.claude/hooks`, `.claude/settings.json` or `.github/workflows` are blocked only when they write (redirects, sed -i, mv, cp, rm, Set-Content...). Reads and `git add` pass.
- Branch pushes to `main` are detected per refspec token instead of by substring.
- Bootstrap order: workflows are written **before** `settings.json` is registered, because registering it locks `.github/workflows/**`.
- Hook, agent and skill text is in English; only the app's user-facing copy is Rioplatense Spanish.

## Consequences

Changing guardrails afterwards requires Diego to create `.claude/GUARDRAILS_UNLOCK` by hand. `.claude/AUTOPILOT_OFF` stops push, PR and merge.
