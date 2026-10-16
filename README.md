# Rincón del Hincha

> "La historia de tu club ya está escrita. La tuya se sigue jugando."

Rincón del Hincha compares **fans against fans**. Pick your club and the date you started living it (your birth date by default) and the app rebuilds your "DNI futbolero": titles lived and still missing, record against every rival, finals, streaks and more.

Created by **Diego Estela Lopez** · Original idea by **Juan Farre**.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind CSS · Motion · Zod · Supabase · API-Football + curated dataset · PostHog · Vitest · Playwright · pnpm · Vercel.

## Run it

```bash
pnpm install
cp .env.example .env.local   # fill in your own values
pnpm dev
```

Other commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm build`, `pnpm data:validate`.

## How the agents work

The repo ships seven subagents and seven skills in `.claude/` (`/idea`, `/plan`, `/build`, `/review`, `/ship`, `/release`, `/backlog`). Their limits are enforced by hooks in `.claude/hooks/`, permissions in `.claude/settings.json` and GitHub branch protection. See `docs/adr/0004-agents-and-guardrails.md`.

## Docs

- `docs/methodology.md` — calculation rules
- `docs/adr/` — architecture decisions
- `docs/plans/` — implementation plans
