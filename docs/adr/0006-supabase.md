# 0006 — Supabase: schema, RLS, shareable comparisons and free-plan limits

Status: **Proposed** (plan 0006, issue #6). The security and infrastructure decisions listed in "Decisions needing approval" are recommended by this ADR and are waiting for Diego's explicit confirmation (the orchestrator will ask): comparisons only through the two security definer functions, optional nickname up to 24 characters, 22-character slug, daily purge with pg_cron, removal of the default grants, keep-alive and key migration as follow-up issues. The product constraints stay: the birth date never travels in a URL and comparisons expire after 90 days.

## Context

The app reads football data from Supabase (Postgres), fed from `data/` by an idempotent seed/sync (issue #10). The master prompt (sections 2, 5.5, 6 and 9) and CLAUDE.md fix the constraints:

- Supabase **free plan**; its limits (pausing, quotas) must be measured and written down here.
- `data/` is the source of truth. ADR 0009 makes the English, snake_case field names of the Zod schemas in `src/data-model/schemas.ts` the contract, with **no translation layer**: Supabase columns use the same names.
- ADR 0010: Postgres only **selects** rows; every statistic is computed in `src/domain`. Indexes on `(home_id, date)` and `(away_id, date)` are for fetching.
- Shareable comparisons (section 5.5): random slug, club and start date only, optional nickname, no real name, birth date never in a URL, **data expires after 90 days**.
- Keys are used only on the server (`server-only`); every table has Row Level Security (RLS).

## Supabase free plan, verified on 2026-10-16

Fetched from the official docs on 2026-10-16 (Markdown versions of the pages):

| Item                        | Free plan                                                                                                                                                                   | Source  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Projects                    | 2 active free projects per owner/admin; paused projects do not count                                                                                                        | [1] [2] |
| Pausing                     | **Free projects are paused after 1 week of inactivity**; paid plans are never paused                                                                                        | [3] [1] |
| Restoring a paused project  | One-click restore from the dashboard for a 1-year window; after that, only a downloadable backup                                                                            | [4]     |
| Database size               | 500 MB per project; above it the project goes **read-only** (1 GB disk). Fair-use 402 restrictions per org                                                                  | [1] [5] |
| Egress                      | 5 GB (plus 5 GB cached egress on the pricing page)                                                                                                                          | [1] [3] |
| Monthly active users (Auth) | 50,000 MAU                                                                                                                                                                  | [1]     |
| File storage                | 1 GB                                                                                                                                                                        | [1]     |
| Edge Function invocations   | 500,000                                                                                                                                                                     | [1]     |
| Compute                     | Nano (shared CPU, up to 0.5 GB RAM); "subject to change"                                                                                                                    | [6]     |
| Backups                     | **No automatic backups** on the free plan                                                                                                                                   | [3]     |
| Log retention               | 1 day                                                                                                                                                                       | [3]     |
| Cron (`pg_cron`)            | Supabase Cron is a Postgres module enabled from the dashboard or with `create extension pg_cron`; the docs list no plan restriction                                         | [7] [8] |
| API keys                    | Legacy `anon` and `service_role` JWT keys are **deprecated by the end of 2026**; use `sb_publishable_...` and `sb_secret_...`                                               | [9]     |
| Default grants              | Tables created in `public` get SELECT/INSERT/UPDATE/DELETE for `anon`, `authenticated`, `service_role` by default on existing projects; Supabase is moving to opt-in grants | [10]    |

Sources: [1] https://supabase.com/docs/guides/platform/billing-on-supabase · [2] https://supabase.com/docs/guides/platform/billing-faq · [3] https://supabase.com/pricing · [4] https://supabase.com/docs/guides/platform/upgrading · [5] https://supabase.com/docs/guides/platform/database-size · [6] https://supabase.com/docs/guides/platform/compute-and-disk · [7] https://supabase.com/docs/guides/cron · [8] https://supabase.com/docs/guides/cron/install · [9] https://supabase.com/docs/guides/api/api-keys · [10] https://supabase.com/docs/guides/api/securing-your-api

What this means here:

- **Size is not a concern.** Tens of thousands of matches at a few hundred bytes each are a few MB, far below 500 MB. Comparisons are about 100 bytes each and are purged after 90 days.
- **Pausing is a concern.** A low-traffic MVP can go a week without database requests. ISR keeps serving cached pages, but revalidation and comparisons would fail until Diego restores the project. A keep-alive is needed (see "Decisions needing approval").
- **No backups**, but `data/` in git is the source of truth: the whole reference dataset can be rebuilt with migrations plus seed. Only comparisons (ephemeral by design) would be lost.

## Decision

### 1. Migrations

- SQL files in `supabase/migrations/`, named `YYYYMMDDHHMMSS_snake_name.sql` (the format the Supabase CLI expects), applied in order and never edited after they reach the real project. Changes go in a new migration.
- A table is created, constrained, indexed, granted and has RLS enabled **in the same file**, so no applied state ever has a table without RLS.
- The first migration starts with `alter default privileges ... revoke` for schema `public`, and every table and function gets an explicit `revoke all` plus explicit `grant`s. We do not rely on Supabase's default grants, which are changing.

### 2. Reference tables mirror the nine data files

Tables `clubs`, `competitions`, `seasons`, `matches`, `titles`, `movements`, `rivalries`, `coverage`, `standings` in schema `public`. Table name = data file name without `.json`. Column names = Zod schema keys, one to one.

- **Types:** slugs and text as `text`; dates as `date` (calendar dates in America/Argentina/Buenos_Aires, never `timestamptz`); counts as `integer`; flags as `boolean`; `aliases` as `text[]`; `colors` as one `jsonb` column with checks (keeps the nested `{primary, secondary, tertiary?}` contract with no mapping).
- **Enums as `text` + `CHECK (col in (...))`**, not Postgres enum types: adding or removing a value is a one-line constraint change, and a static test compares the list with the Zod enum.
- **Reserved words:** `from`, `to` (coverage) and `end` (seasons) are SQL reserved words and are always written double-quoted. The contract wins over convenience (ADR 0009).
- **Optional Zod fields** (`notes`, rivalry `name`) are nullable columns; the seed maps a missing key to `null`.
- **Constraints equal the Zod schema plus the cheap single-row and referential rules of the validator**, never stricter than `pnpm data:validate`, so any dataset that validates also loads: non-blank `source` (`check (source ~ '\S')`), non-blank ids, hex colors, non-negative goals and penalties, score present for `played`/`administrative_result`, penalty consistency, `home_id <> away_id`, `start <= "end"`, `"from" <= "to"`, `won + drawn + lost = played`, and foreign keys for every reference. A title's competition must equal its season's competition through a composite foreign key `(season_id, competition_id) -> seasons (id, competition_id)`. Duplicate matches are blocked by a unique index on `(season_id, date, least(home_id, away_id), greatest(home_id, away_id))`. Time-dependent rules (`future-played-match`) and cross-record rules (`date-outside-season`, `title-without-support`, `standings-mismatch`) stay in the validator only.
- **Primary keys:** `id` for entities with one; `(club_a, club_b)` for rivalries, `(club_id, competition_id, "from")` for coverage, `(club_id, season_id)` for standings, the same composite keys as `recordKey` in `schemas.ts`. The seed upserts on these keys.
- **Indexes:** `matches (home_id, date)`, `matches (away_id, date)`, `matches (season_id)`, `seasons (competition_id)`, `titles (club_id, awarded_on)`, `movements (club_id, date)`, plus indexes backing the remaining foreign keys.

### 3. RLS and grants on every table

- RLS is enabled on every table, with no exception (static test).
- Reference tables: `revoke all ... from anon, authenticated` (removes TRUNCATE, which RLS does not cover), then `grant select ... to anon, authenticated` and one policy `for select to anon, authenticated using (true)`. **No insert, update or delete policy exists**, so even a stray grant cannot write. `service_role` gets `select, insert, update, delete` for the seed; it bypasses RLS by design.
- The secret (service role) key is used **only** by server code (`src/data/**` with `import "server-only"`) and by the seed script; never in the client bundle, never `NEXT_PUBLIC_`.

### 4. Comparisons: no direct table access for anyone except the owner

Table `comparisons (slug text primary key, club_id text references clubs, start_date date, nickname text null, created_at timestamptz default now(), expires_at timestamptz default now() + interval '90 days')`.

- `slug`: 128 random bits from `extensions.gen_random_bytes(16)`, base64url, 22 characters, generated in the database; check `slug ~ '^[A-Za-z0-9_-]{22}$'`.
- `nickname`: optional, trimmed, 1 to 24 characters, no control characters. The UI labels it "apodo" and never asks for a real name. There is no name, email, IP, user agent or birth date column.
- `start_date` is the date the fan started following the club (not the birth date), between 1880-01-01 and the creation day in Buenos Aires.
- `expires_at` must be after `created_at` and at most 90 days after it.
- **Access path (chosen):** RLS enabled with **zero policies**, and `revoke all` on the table from `anon`, `authenticated` **and** `service_role`. The only way in is two `security definer` functions owned by `postgres`, with `set search_path = ''` and schema-qualified names:
  - `public.create_comparison(p_club_id text, p_start_date date, p_nickname text) returns text` (the slug);
  - `public.get_comparison(p_slug text) returns table (club_id, start_date, nickname, expires_at)`, which returns zero or one row and only when `expires_at > now()`.

  `execute` is revoked from `public`, `anon` and `authenticated` and granted only to `service_role`. Next.js route handlers / server actions call them with the secret key. Result: the browser can never touch the table; even server code (or a leaked secret key) cannot list comparisons, because no role has `select` on the table and no function returns more than the row matching one slug.

- **Expiry:** reads are authoritative (`get_comparison` filters `expires_at > now()`, so an expired row is unreadable the second it expires), and a daily `pg_cron` job (`delete from public.comparisons where expires_at <= now()`) physically deletes expired rows, so the 90-day promise is a real deletion. The job lives in its own migration and uses `cron.unschedule` before `cron.schedule` so re-applying is safe.

### 5. Database functions for history (outline only; built in a later issue)

Following ADR 0010 they return **rows, never aggregates**: `security invoker`, `stable`, `set search_path = ''`, `execute` to `anon, authenticated, service_role`.

- `club_matches(p_club_id text, p_from date, p_to date default null) returns setof public.matches`: a `union all` of the home and away selects, each served by its `(home_id, date)` / `(away_id, date)` index, ordered by `date, id`.
- `head_to_head_matches(p_club_a text, p_club_b text, p_from date, p_to date default null) returns setof public.matches`: both orientations, same indexes. The comparison passes the later of the two start dates as `p_from` (section 5.5).
- Supporting reads (titles, movements, coverage, rivalries of a club) are plain filtered selects from the repositories; no view is needed.

### 6. Seed / sync (issue #10, outline)

Idempotent and transactional, run with the secret key from a trusted machine or CI:

- Validate first (`pnpm data:validate` must pass), then sync in foreign-key order: clubs, competitions, seasons, matches, titles, movements, rivalries, coverage, standings.
- Upsert on the primary keys above (`insert ... on conflict (pk) do update set ... where (row) is distinct from (excluded row)`), then delete rows whose key is no longer in `data/`, in reverse order.
- Preferred shape: one `security invoker` function `public.sync_dataset(payload jsonb)` executable only by `service_role`, so the whole dataset applies in one transaction (all or nothing). The alternative (one supabase-js `upsert` per table) is simpler but leaves partial states visible on failure. Issue #10 makes the final call.
- Running the seed twice in a row changes zero rows.

## Decisions needing approval

1. **(Diego, security)** Comparisons reachable only through two `security definer` functions with `execute` granted only to `service_role`; no role can `select` the table.
2. **(Diego, product)** Nickname limit **24 characters**; friend's side of a comparison is **not stored** (computed per request from what the friend picks); comparisons store only the creator's club, start date and optional nickname.
3. **(Diego, product/security)** Slug of **22 characters** (128 random bits).
4. **(Diego, infra)** Enable `pg_cron` on the project for the daily purge. Fallback if rejected: a daily Vercel cron or GitHub Actions job calling a `purge_expired_comparisons()` function with the secret key (needs a workflow change, which is a guardrail, and a new secret).
5. **(Diego, infra)** **Keep-alive** against the 1-week pause: a daily cheap read (Vercel cron hitting a server route, or a GitHub Actions job). Follow-up issue; not built here.
6. **(Diego, security)** Move to the **new API keys** (`sb_publishable_...`, `sb_secret_...`) before the end of 2026, since the legacy `anon`/`service_role` keys are deprecated. Env variable names are settled in the follow-up that adds `src/data/` repositories.
7. **(Diego, security)** First migration revokes Supabase's default grants on `public` for future objects (`alter default privileges`), so every new table or function is private until a migration grants it explicitly.

## Consequences

- Column names, enums and nullability are checked against the Zod schemas by static tests; a rename in `schemas.ts` fails CI until a migration follows.
- Any table without RLS, any policy or grant that lets `anon`/`authenticated` write, and any `security definer` function without a pinned `search_path` fail CI.
- Statistics stay in TypeScript (ADR 0010); SQL functions only fetch rows by club and date range.
- The free plan is enough for size and traffic; the risks are pausing after a week without requests and the absence of backups (mitigated by `data/` in git).
- Moving to a paid plan, adding Supabase Auth (stage 2) or exposing new tables needs a new migration with explicit grants and an update to this ADR.
