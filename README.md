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

## Database migrations

The Postgres schema lives in `supabase/migrations/` (see `docs/adr/0006-supabase.md` and `docs/plans/0006-supabase-schema.md`). `pnpm test` checks the SQL statically (RLS on every table, no write access for `anon`/`authenticated`, schema parity with the Zod schemas); no database or Docker is needed. Agents never run `login`, `link` or `db push`: a human applies the migrations.

1. At the repo root, on the branch of the PR: `npx supabase@2.121.0 --version`.
2. `npx supabase@2.121.0 login` (opens the browser; the token stays on your machine).
3. `npx supabase@2.121.0 link --project-ref <project-ref>`. The ref is the `xxxx` in `https://supabase.com/dashboard/project/xxxx`. It asks for the database password (Project Settings, Database). If it asks for `supabase/config.toml`, run `npx supabase@2.121.0 init` first, answer "no" to the editor prompts and commit `config.toml`.
4. `npx supabase@2.121.0 db push --dry-run` and check that it lists exactly the three migration files.
5. `npx supabase@2.121.0 db push`.
6. Dashboard, SQL Editor: paste and run `supabase/checks/verify.sql`. The script always ends with an error on purpose: the error message is the report (the editor shows only the last result, and the error also rolls back everything the script did). Read it as one line per check: the first line says `RESULT: ALL N CHECKS OK`, and every following line must start with `OK`. Any line starting with `FAIL` is a problem, and it is reported through the same message. If you see `No rows returned` or no `verify.sql report`, the script did not run as expected: tell the builder.
7. Dashboard, Advisors, Security Advisor: expect no "RLS disabled" or "function search_path mutable" findings.
8. Dashboard, Integrations, Cron: the job `purge-expired-comparisons` is listed.

The migrations are not idempotent (for example `create table` has no `if not exists`), so the no-CLI paste fallback fails if you run a file a second time; paste each file exactly once. `db push` tracks what was applied and never repeats a migration.

Without the CLI, paste each migration in order into the SQL Editor, run steps 6 to 8, and before the first future `db push` run `npx supabase@2.121.0 migration repair --status applied 20261016120000 20261016120100 20261016120200`.

## How the agents work

The repo ships seven subagents and seven skills in `.claude/` (`/idea`, `/plan`, `/build`, `/review`, `/ship`, `/release`, `/backlog`). Their limits are enforced by hooks in `.claude/hooks/`, permissions in `.claude/settings.json` and GitHub branch protection. See `docs/adr/0004-agents-and-guardrails.md`.

## Docs

- `docs/methodology.md` — calculation rules
- `docs/adr/` — architecture decisions
- `docs/plans/` — implementation plans
