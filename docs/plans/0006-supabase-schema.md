---
issue: 6
status: review
date: 2026-10-16
---

# Plan 0006: Supabase schema, migrations and RLS

Related ADRs: [0006](../adr/0006-supabase.md) (new, this plan), [0003](../adr/0003-data-sources.md) (data sources), [0009](../adr/0009-data-model-naming.md) (English names are the contract), [0010](../adr/0010-stats-engine-in-typescript.md) (Postgres only fetches rows).

## Goal

Create the Postgres schema the app will read from: one table per data file with the same names and constraints as the Zod schemas, a private `comparisons` table for shareable comparisons with a 90-day expiry, and RLS on every table, enforced by static tests that run in CI without Docker or a live database. Document the schema, the RLS approach, the server-only use of the secret key and the verified free-plan limits in ADR 0006, and give Diego exact steps to apply the migrations to the real project.

## Acceptance criteria (copied from issue #6)

- Given the data model (clubs, competitions, seasons, matches, titles, movements, rivalries, coverage), when migrations are applied to an empty database, then all tables exist with keys, constraints and indexes.
- Given the anonymous role, when it queries the football data tables, then it can read but not write.
- Given the comparisons table (slug, club, start date, optional nickname, created_at), when it is created, then it supports a 90-day expiry and never stores a real name.
- Given a table without RLS, when the migration check runs, then it fails (every table has RLS enabled).
- Given the decision is made, when the PR is reviewed, then `docs/adr/0006-*` documents the schema, the RLS approach and that the service role is used only on the server.

Out of scope (from the issue): loading data (seed, #10) and the comparison feature UI (#16). Also out of scope here: the history functions (outlined only), `src/data/` repositories, keep-alive, env variable changes.

Note: the issue lists eight entities; `standings` (ADR 0009, plan 0003) is the ninth data file and gets a table too.

## Approval needed from Diego (before /build)

Details and reasoning in ADR 0006, "Decisions needing approval".

1. **Security:** comparisons are reachable only through two `security definer` functions (`create_comparison`, `get_comparison`) whose `execute` is granted only to `service_role`; no role, not even `service_role`, has `select` on the table, so listing is impossible.
2. **Product:** nickname optional, 1 to 24 characters; only the creator's club, start date and nickname are stored (the friend's choice is computed per request, never stored).
3. **Product/security:** slug of 22 base64url characters (128 random bits).
4. **Infra:** enable `pg_cron` for a daily purge of expired comparisons (fallback: Vercel cron or GitHub Actions, which touches a guardrailed workflow and adds a secret).
5. **Infra:** a keep-alive against the free plan's pause after 1 week of inactivity (follow-up issue, not built here).
6. **Security:** move to the new `sb_publishable_` / `sb_secret_` keys before the end of 2026 (legacy `anon` / `service_role` keys are deprecated). Follow-up when `src/data/` is built.
7. **Security:** the first migration revokes Supabase's default grants on schema `public` for future objects (tables, sequences and functions for `anon`, `authenticated`, `service_role`, plus `execute` on functions from `public`). The static gate asserts tables, functions and the three roles.

If 1 is rejected, the alternative is "table with no policies, service role reads it directly with `.eq('slug', ...)`": simpler, but any server bug or a leaked secret key could list every comparison.

## Approach

### Files

```
supabase/migrations/
  <ts1>_reference_tables.sql        default-privilege revoke, 9 tables, constraints, indexes, grants, RLS, read policies
  <ts2>_comparisons.sql             comparisons table, RLS (no policies), revokes, create_comparison, get_comparison
  <ts3>_comparisons_purge_cron.sql  pg_cron extension + daily purge job (separate so it can be dropped if item 4 is rejected)
supabase/checks/verify.sql          one do block: catalog checks + RLS smoke test, always ends by raising its report (Diego runs it once)
tests/unit/supabase/sql-model.ts            dependency-free extractor of tables, columns, checks, policies, grants, functions
tests/unit/supabase/sql-model.test.ts       tests of the extractor on inline SQL fixtures (positive and negative)
tests/unit/supabase/migrations.test.ts      security gate over supabase/migrations/*.sql
tests/unit/supabase/schema-parity.test.ts   column, enum and nullability parity with src/data-model/schemas.ts
```

`<tsN>` is `YYYYMMDDHHMMSS` taken when the file is created (CLI format). The extractor lives under `tests/` because it is test tooling only.

### Table design (full rationale in ADR 0006, section 2)

| Table          | Primary key                         | Notable columns and constraints                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clubs`        | `id`                                | `aliases text[] not null` (no null or empty item), `colors jsonb not null` (object, keys only `primary`/`secondary`/`tertiary`, `#RRGGBB`), `jersey_pattern` check of 6 values, `founded integer`                                                                           |
| `competitions` | `id`                                | `type` check (`league`, `national_cup`, `international`, `other`), `scope` check (`domestic`, `international`), `afa_recognized boolean`, `notes text null`                                                                                                                 |
| `seasons`      | `id`; unique `(id, competition_id)` | FK `competition_id`; `start date`, `"end" date`, check `start <= "end"`                                                                                                                                                                                                     |
| `matches`      | `id`                                | FKs `season_id`, `home_id`, `away_id`; `home_id <> away_id`; goals and penalties `>= 0` or null; `decision` null or check; `status` check; score required for `played`/`administrative_result`; penalties iff `decision = 'penalties'`, with equal goals and unequal counts |
| `titles`       | `id`                                | FK `club_id`; composite FK `(season_id, competition_id) -> seasons (id, competition_id)`; `awarded_on date`                                                                                                                                                                 |
| `movements`    | `id`                                | FKs `club_id`, `season_id`; `type` check (`relegation`, `promotion`)                                                                                                                                                                                                        |
| `rivalries`    | `(club_a, club_b)`                  | FKs both clubs; `name text null`                                                                                                                                                                                                                                            |
| `coverage`     | `(club_id, competition_id, "from")` | FKs; `"to" date null`; check `"to" is null or "from" <= "to"`                                                                                                                                                                                                               |
| `standings`    | `(club_id, season_id)`              | FKs; counts `>= 0`; check `won + drawn + lost = played`                                                                                                                                                                                                                     |
| `comparisons`  | `slug`                              | see ADR 0006, section 4                                                                                                                                                                                                                                                     |

Every reference table: `source text not null check (source ~ '\S')`; every slug id `check (id <> '')` (Zod `min(1)`); `verified boolean not null` on matches and titles. Unique index `matches (season_id, date, least(home_id, away_id), greatest(home_id, away_id))`. Indexes `matches (home_id, date)`, `matches (away_id, date)`, `matches (season_id)`, `seasons (competition_id)`, `titles (club_id, awarded_on)`, `titles (season_id, competition_id)`, `movements (club_id, date)`, `movements (season_id)`, `coverage (competition_id)`, `standings (season_id)`, `rivalries (club_b)`.

Rule: DB constraints are **never stricter than `pnpm data:validate`** (a validated dataset must always load). Anything stricter (for example rivalry `club_a <> club_b`, unordered rivalry duplicates) goes to the validator first in a separate issue.

### Grants and RLS pattern (per reference table)

```sql
alter table public.<t> enable row level security;
revoke all on table public.<t> from anon, authenticated;
grant select on table public.<t> to anon, authenticated;
grant select, insert, update, delete on table public.<t> to service_role;
create policy "<t>_read" on public.<t> for select to anon, authenticated using (true);
```

### Comparisons (ADR 0006, section 4)

Table with RLS enabled and **no policies**; `revoke all` from `anon`, `authenticated`, `service_role`. `create_comparison` validates input (club exists, start date range, nickname trimmed and normalized to null when blank) and returns the slug, retrying once on a unique violation. `get_comparison` returns at most one row, only when `expires_at > now()`, and returns no row for a malformed slug. Both: `language plpgsql` (or `sql`), `security definer`, `set search_path = ''`, every name schema-qualified, `revoke execute ... from public, anon, authenticated`, `grant execute ... to service_role`.

Purge: `create extension if not exists pg_cron with schema pg_catalog;` then `select cron.unschedule('purge-expired-comparisons') where exists (select 1 from cron.job where jobname = 'purge-expired-comparisons');` and `select cron.schedule('purge-expired-comparisons', '17 6 * * *', $$delete from public.comparisons where expires_at <= now()$$);` (daily, 03:17 Buenos Aires).

### History functions and seed (outline only, later issues)

`club_matches(p_club_id, p_from, p_to)` and `head_to_head_matches(p_club_a, p_club_b, p_from, p_to)` return `setof public.matches` (rows, never aggregates, ADR 0010), `security invoker`, `stable`, `set search_path = ''`, built as `union all` of home and away selects to use both indexes. Seed/sync (#10): validate, upsert on the primary keys in FK order, delete missing keys in reverse order, ideally inside one transaction via `sync_dataset(payload jsonb)` executable only by `service_role`. This plan only guarantees the keys those upserts need.

### Static test approach (no Docker)

A small extractor reads every `supabase/migrations/*.sql` in name order, strips `--` and `/* */` comments and dollar-quoted bodies (kept separately per function), splits on top-level `;`, and recognizes a fixed set of statement shapes: `create table`, `alter table ... enable row level security`, `create policy`, `grant` / `revoke`, `create [or replace] function`, `create [unique] index`. Migrations follow a style guide that keeps them parseable (lowercase keywords, schema-qualified `public.` names, one column or constraint per line). The extractor fails loudly on a `create table` it cannot parse, so a style slip is a red test, not a silent pass.

### Discarded alternatives

- **Postgres enum types:** values cannot be removed and adding them needs special handling in transactions; text plus check is simpler and equally safe for our size.
- **Flattened color columns (`color_primary` ...):** breaks the ADR 0009 "same names, no mapping" contract.
- **Renaming `from`/`to`/`end` columns:** would add a translation layer in the seed and repositories; quoting is cheaper.
- **Comparisons readable by `anon` through an RLS policy filtered by slug:** a `select` policy cannot stop `select *` listing (RLS filters rows, it cannot require a `where slug = ...`), so it was rejected.
- **Service role reading the comparisons table directly:** works, but listing would be one query away for any server bug or leaked key (kept as the fallback if Diego rejects decision 1).
- **Comparisons in a non-exposed schema:** the definer functions already give the same isolation; an extra schema adds config (exposed schemas list) for no gain.
- **Expiry only by filtered reads:** the master prompt says the data expire; rows must be deleted, not just hidden.
- **Purge from GitHub Actions:** needs editing `.github/workflows/**` (guardrail) and storing the secret key in GitHub; pg_cron needs no key outside the database.
- **`libpg-query` (real Postgres parser via native/WASM) for the static tests:** most accurate, but a new heavy dev dependency with a history of native-build trouble on Windows; our migrations are few and follow a style guide. Revisit if the extractor grows past about 200 lines.
- **Docker-based tests (`supabase start`, pgTAP):** not available on Diego's machine or required by CI; `supabase/checks/verify.sql` covers the live check once.
- **SQL views with aggregates (P/W/D/L):** forbidden by ADR 0010.

## Tasks

Each task: write the test first, see it fail, implement, see it pass, `pnpm lint && pnpm typecheck && pnpm test`.

- [x] **T1. Extractor: tables and columns.** Test (`sql-model.test.ts`): an inline `create table public.x (id text primary key, "from" date not null, notes text, ...)` yields table `x`, columns with names unquoted, types, nullability, primary key (inline and table-level composite); a malformed `create table` throws. Implement `parseMigrations(sql: string[])` in `tests/unit/supabase/sql-model.ts`.
- [x] **T2. Extractor: checks, RLS, policies, grants, functions, indexes.** Tests: `in (...)` lists from check constraints by column; `enable row level security`; `create policy ... for <cmd> to <roles>` (missing `to` means `public`); `grant`/`revoke` privileges and roles; functions with `security definer|invoker` and `set search_path`; index column lists. Implement.
- [x] **T3. Security gate tests, red.** `migrations.test.ts` over the real directory: the set of tables is exactly the nine data files plus `comparisons`; every table has RLS enabled in the same file that creates it; every table has a primary key; no policy whose command is `insert`, `update`, `delete` or `all` targets `anon`, `authenticated` or `public`; no policy without an explicit `to`; no net grant of anything other than `select` to `anon`/`authenticated`/`public` on any table (revokes applied in order); every `security definer` function sets `search_path = ''`; file names match `^\d{14}_[a-z0-9_]+\.sql$` and are unique. Red because there are no migrations yet.
- [x] **T4. Schema parity tests, red.** `schema-parity.test.ts`: for each entry of `FILE_SCHEMAS`, table `<file without .json>` has exactly the keys of `schema.shape` as columns; columns are nullable iff the Zod field is nullable or optional; enum check lists equal the Zod enum `options` (`jersey_pattern`, `type`, `scope`, `decision`, `status`, movement `type`); every `source` column has a non-blank check; date fields are `date`; `count` fields are `integer`; primary key columns equal `KEY_FIELDS` (export `KEY_FIELDS` or a `keyFields(file)` helper from `schemas.ts` with its own unit test).
- [x] **T5. Migration `<ts1>_reference_tables.sql`, part 1:** default-privilege revoke, `clubs`, `competitions`, `seasons` with constraints, grants, RLS and read policy. Parity and gate tests pass for these three.
- [x] **T6. Part 2: `matches`** with all checks, the duplicate-match unique index and the `(home_id, date)` / `(away_id, date)` indexes. Add gate test: both history indexes exist.
- [x] **T7. Part 3: `titles`, `movements`, `rivalries`, `coverage`, `standings`** with composite FK, control-total check and FK indexes. Gate and parity tests fully green for reference tables.
- [x] **T8. Comparisons tests, red.** Gate tests: `comparisons` has no policy; no grant of any table privilege to `anon`, `authenticated` or `service_role` remains after revokes; columns are exactly `slug, club_id, start_date, nickname, created_at, expires_at`; no column name matches `/name|email|birth|ip|user_agent/` except `nickname`; `expires_at` default contains `interval '90 days'`; checks exist for slug format, nickname length 24, expiry window; `create_comparison` and `get_comparison` are `security definer`, `search_path = ''`, `execute` revoked from `public, anon, authenticated` and granted only to `service_role`; `get_comparison` body filters `expires_at > now()` and `slug = p_slug`.
- [x] **T9. Migration `<ts2>_comparisons.sql`.** Implement until T8 is green.
- [x] **T10. Purge job.** Test: a migration enables `pg_cron` and schedules `purge-expired-comparisons` with `unschedule` guarded before `schedule`, and the job deletes only `expires_at <= now()`. Implement `<ts3>_comparisons_purge_cron.sql`. Skip this task (and drop the test) if Diego rejects decision 4.
- [x] **T11. `supabase/checks/verify.sql`.** Test: the file is a single `do` block (no `begin`, `commit` or `rollback`) that always ends with `raise exception` carrying one `OK <name>` / `FAIL <name>` line per check, because the SQL Editor shows only the last result and the exception rolls back everything. Content: (a) list `public` tables with `relrowsecurity = false` (expect zero rows); (b) list policies on `public` tables (expect only the nine `_read` policies); (c) `has_table_privilege('anon', ..., 'INSERT,UPDATE,DELETE,TRUNCATE')` for every table (expect all false) and `has_table_privilege('service_role', 'public.comparisons', 'SELECT')` (expect false); (d) `set local role anon;` then an `insert into public.clubs` inside a `do` block that catches and reports `insufficient_privilege`, and `select count(*) from public.clubs` succeeds; (e) as `service_role`, `create_comparison` returns a 22-character slug and `get_comparison` returns that one row, all rolled back.
- [x] **T12. README section "Database migrations"** with Diego's steps below (no test; docs only), and ADR 0006 status left as Proposed until Diego approves the list above.
- [ ] **T13. Human checkpoint.** Diego applies the migrations and runs `verify.sql`; the builder records the outcome (date, CLI version, any issue) in the PR description and flips ADR 0006 to Accepted.

## Tests to write

- **Unit (vitest, `tests/unit/supabase/`)**: extractor tests (T1, T2), security gate (T3, T6, T8, T10, T11), schema parity (T4). They run in the existing `pnpm test` and `ci.yml` with no new dependency and no network.
- **Integration**: none automated (no Docker, no live DB in CI). `supabase/checks/verify.sql` is the one-off live check, plus the dashboard Security Advisor.
- **E2E**: none (no UI change).

### Edge cases

- Quoted reserved identifiers `"from"`, `"to"`, `"end"` are parsed as `from`, `to`, `end` and match the Zod keys.
- A policy declared with `for all` or without `to` (defaults to `public`) fails the gate.
- `grant all` or `grant truncate` to `anon` fails, even with RLS enabled (TRUNCATE ignores RLS).
- A later migration that re-grants a write privilege after an earlier revoke fails (grants evaluated in file order).
- A table created in one file with RLS enabled only in a later file fails.
- A `security definer` function with `set search_path = public` (not empty) fails.
- Optional Zod field (`notes`, rivalry `name`) maps to a nullable column; `nullable` (`to`, goals) too; a required field mapped to a nullable column fails parity.
- A new enum value added in Zod without a migration fails parity.
- Comments containing `create table` or `grant` do not confuse the extractor.
- Penalty check: `decision = 'penalties'` with equal goals, both counts present and different passes; any other combination fails (mirrors `penalties-inconsistent`). Covered by reading the check text in parity tests and by `verify.sql` only for the happy path.
- Nickname: blank or whitespace becomes null; 25 characters is rejected; control characters rejected.
- `get_comparison` with an expired slug, a malformed slug, or an empty string returns zero rows.

## Impact

- **Data:** new tables only; no data loaded (seed is #10). Data that passes `pnpm data:validate` must load: the constraint list is kept no stricter than the validator. Optional `KEY_FIELDS` export from `src/data-model/schemas.ts` (keeps 100% branch coverage).
- **Design:** none (no UI).
- **Security:** RLS on every table; anon and authenticated are read-only on reference data and have no access to comparisons; TRUNCATE revoked; definer functions pinned to an empty `search_path`; secret key server-only. Comparisons store no personal data beyond an optional nickname, and are deleted after 90 days.
- **Performance:** history indexes on `(home_id, date)` and `(away_id, date)`; dataset of a few MB, far under the 500 MB free quota. Static tests add milliseconds to `pnpm test`.

## Risks

- **Extractor too lax or too strict.** Mitigated by its own negative fixtures and by failing on unparseable `create table`. Diego's live `verify.sql` and the Security Advisor are the second line.
- **Constraint stricter than the validator** blocks the seed in #10. Mitigated by the "never stricter" rule and by the seed running the validator first; a seed failure on a constraint means the validator needs the rule.
- **`pg_cron` not available or `cron.schedule` not permitted through `db push`.** The purge lives in its own migration; if it fails, Diego can enable Cron from the dashboard (Integrations, Cron) and re-run, or decision 4 falls back to an external scheduler. Reads stay correct either way.
- **Free-plan pause** after 1 week without requests: follow-up keep-alive issue (decision 5).
- **Legacy key deprecation** at the end of 2026: follow-up (decision 6).
- **Migration history drift** if anything is pasted into the SQL editor: use the CLI path below; if the fallback is used, run `migration repair` before the next `db push`.

## How Diego applies the migrations

The Supabase CLI is **not installed** on this machine (`supabase --version`: command not found, checked 2026-10-16). Recommended: run it through `npx` without installing it globally (npx offered `supabase@2.121.0`). It keeps the migration history in the project, so future migrations are one `db push`, and `--dry-run` shows exactly what will run.

1. In a terminal at the repo root, on the branch of this PR: `npx supabase@2.121.0 --version`.
2. `npx supabase@2.121.0 login` (opens the browser; stores a personal access token on your machine, not in the repo).
3. `npx supabase@2.121.0 link --project-ref <project-ref>`. The ref is the `xxxx` in `https://supabase.com/dashboard/project/xxxx`. It asks for the database password (Project Settings, Database). If it asks for `supabase/config.toml`, run `npx supabase@2.121.0 init` first and say "no" to the editor prompts; commit `config.toml` in this PR.
4. `npx supabase@2.121.0 db push --dry-run` and check that it lists exactly the three migration files.
5. `npx supabase@2.121.0 db push`.
6. Dashboard, SQL Editor: paste and run `supabase/checks/verify.sql`; compare with the expected results written in the file.
7. Dashboard, Advisors, Security Advisor: expect no "RLS disabled" or "function search_path mutable" findings.
8. If item 4 of the approvals was accepted: Dashboard, Integrations, Cron: the job `purge-expired-comparisons` is listed.
9. Tell the builder the result (it goes in the PR).

Fallback (no CLI): paste each migration file in order into the SQL Editor and run it, then step 6 and 7. Before the first future `db push`, run `npx supabase@2.121.0 migration repair --status applied <ts1> <ts2> <ts3>` so the CLI knows they are applied.

Agents never run `login`, `link` or `db push` (credentials are a human checkpoint).

## Done when

- All tasks checked; `pnpm lint`, `pnpm typecheck`, `pnpm test` green; coverage thresholds unchanged.
- Diego approved the seven decisions (or the plan was updated for each rejection).
- Diego applied the migrations, `verify.sql` matched the expected output, and the Security Advisor shows no RLS or search_path findings.
- ADR 0006 is Accepted; follow-up issues exist for: history functions, seed/sync design (#10 updated with the outline), keep-alive, new API keys, comparison rate limiting (#16).
