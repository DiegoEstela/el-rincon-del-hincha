# Rincón del Hincha — Guide for Claude

Mobile-first web app that rebuilds each fan's football history from the date they started following their club.
Created by Diego Estela Lopez · Original idea by Juan Farre.

## Language policy

- Everything is written in **English**: code, comments, commits, issues, PRs, ADRs, plans, docs, agents, skills and hooks.
- The only exception is the **user-facing copy of the app**, which is **Rioplatense Spanish** (voseo, healthy football humor).
- Conversation with Diego is always in **Spanish**.

## Commands

pnpm dev | pnpm lint | pnpm typecheck | pnpm test | pnpm e2e | pnpm build | pnpm data:validate | pnpm data:seed

## Mandatory flow

/idea -> issue · /plan #N -> docs/plans · /build -> TDD on a branch · /review -> auditors · /ship -> PR + merge · /release
Nothing is merged without an issue, a plan, an approved review (label `agentes:aprobado`) and green CI.

## Rules

- Never commit or push to main. Never force push. Never --no-verify. Never `vercel --prod`.
- Never read or write .env* (except .env.example). Never commit secrets. Keys are only used on the server (`server-only`).
- Do not modify .claude/settings.json, .claude/hooks/** or .github/workflows/** (guardrails).
- If .claude/AUTOPILOT_OFF exists: no push, no PR, no merge.
- Pure business logic lives in src/domain with tests first. Calculation rules live in docs/methodology.md.
- Data: data/ is the source of truth; every record has a source; partial coverage is shown, never invented.
- No official crests or brands: generic SVG crests built from club colors.
- App copy in Rioplatense Spanish with voseo and healthy humor. No betting.
- Footer with version and credits on every page.
- Commits: Conventional Commits (type and description in English).
- Architecture decisions -> ADR in docs/adr.
- Next.js here is v16: read node_modules/next/dist/docs/ before writing Next-specific code.

## Human checkpoints (stop and ask Diego)

Credentials or accounts · product decision not covered · data conflict without a source · a guardrail blocked twice.
