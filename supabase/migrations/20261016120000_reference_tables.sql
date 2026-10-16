-- Reference tables: one table per data file, same names as the Zod schemas (ADR 0009).
-- Plan 0006, ADR 0006. Style guide (the static tests parse this file): lowercase keywords,
-- schema-qualified public. names, one column or constraint per line.
--
-- Database constraints are never stricter than `pnpm data:validate`: a validated dataset must
-- always load. Time-dependent and cross-record rules stay in the validator.

-- Supabase grants every new object in schema public to anon, authenticated and service_role by
-- default. Take that away so each table and function stays private until a migration grants it.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public;

-- clubs -----------------------------------------------------------------------------------------

create table public.clubs (
  id text primary key,
  name text not null,
  short_name text not null,
  aliases text[] not null,
  colors jsonb not null,
  jersey_pattern text not null,
  founded integer not null,
  city text not null,
  source text not null,
  check (id <> ''),
  check (name <> ''),
  check (short_name <> ''),
  check (city <> ''),
  check (source ~ '\S'),
  check (array_position(aliases, null) is null and array_position(aliases, '') is null),
  check (jsonb_typeof(colors) = 'object'),
  check (colors ?& array['primary', 'secondary']),
  check ((colors - 'primary' - 'secondary' - 'tertiary') = '{}'::jsonb),
  check (colors ->> 'primary' ~ '^#[0-9a-fA-F]{6}$'),
  check (colors ->> 'secondary' ~ '^#[0-9a-fA-F]{6}$'),
  check (colors ->> 'tertiary' is null or colors ->> 'tertiary' ~ '^#[0-9a-fA-F]{6}$'),
  check (jersey_pattern in ('solid', 'vertical_stripes', 'sash', 'hoops', 'halves', 'other'))
);

alter table public.clubs enable row level security;
revoke all on table public.clubs from anon, authenticated;
grant select on table public.clubs to anon, authenticated;
grant select, insert, update, delete on table public.clubs to service_role;
create policy "clubs_read" on public.clubs for select to anon, authenticated using (true);

-- competitions ----------------------------------------------------------------------------------

create table public.competitions (
  id text primary key,
  name text not null,
  type text not null,
  scope text not null,
  organizer text not null,
  afa_recognized boolean not null,
  notes text,
  source text not null,
  check (id <> ''),
  check (name <> ''),
  check (organizer <> ''),
  check (source ~ '\S'),
  check (type in ('league', 'national_cup', 'international', 'other')),
  check (scope in ('domestic', 'international'))
);

alter table public.competitions enable row level security;
revoke all on table public.competitions from anon, authenticated;
grant select on table public.competitions to anon, authenticated;
grant select, insert, update, delete on table public.competitions to service_role;
create policy "competitions_read" on public.competitions for select to anon, authenticated using (true);

-- seasons ---------------------------------------------------------------------------------------

create table public.seasons (
  id text primary key,
  competition_id text not null references public.competitions (id),
  name text not null,
  start date not null,
  "end" date not null,
  source text not null,
  unique (id, competition_id),
  check (id <> ''),
  check (competition_id <> ''),
  check (name <> ''),
  check (source ~ '\S'),
  check (start <= "end")
);

create index seasons_competition_id_idx on public.seasons (competition_id);

alter table public.seasons enable row level security;
revoke all on table public.seasons from anon, authenticated;
grant select on table public.seasons to anon, authenticated;
grant select, insert, update, delete on table public.seasons to service_role;
create policy "seasons_read" on public.seasons for select to anon, authenticated using (true);

-- matches ---------------------------------------------------------------------------------------

create table public.matches (
  id text primary key,
  season_id text not null references public.seasons (id),
  date date not null,
  home_id text not null references public.clubs (id),
  away_id text not null references public.clubs (id),
  home_goals integer,
  away_goals integer,
  decision text,
  home_penalties integer,
  away_penalties integer,
  stage text not null,
  is_final boolean not null,
  status text not null,
  source text not null,
  verified boolean not null,
  check (id <> ''),
  check (season_id <> ''),
  check (home_id <> ''),
  check (away_id <> ''),
  check (source ~ '\S'),
  check (home_id <> away_id),
  check (home_goals is null or home_goals >= 0),
  check (away_goals is null or away_goals >= 0),
  check (home_penalties is null or home_penalties >= 0),
  check (away_penalties is null or away_penalties >= 0),
  check (decision is null or decision in ('penalties', 'extra_time')),
  check (status in ('played', 'suspended', 'administrative_result')),
  check (status = 'suspended' or (home_goals is not null and away_goals is not null)),
  -- decision is nullable, so compare with "is [not] distinct from": the check must never be NULL,
  -- because a CHECK accepts NULL. Same rule as penalties-inconsistent in the validator.
  check (
    (decision is distinct from 'penalties' and home_penalties is null and away_penalties is null)
    or (
      decision is not distinct from 'penalties'
      and home_penalties is not null
      and away_penalties is not null
      and home_penalties <> away_penalties
      and home_goals is not distinct from away_goals
    )
  )
);

-- The same fixture cannot appear twice, whichever club is listed as home (validator: duplicate-match).
create unique index matches_fixture_key on public.matches (season_id, date, least(home_id, away_id), greatest(home_id, away_id));
-- History queries per club (ADR 0010: Postgres only fetches rows).
create index matches_home_id_date_idx on public.matches (home_id, date);
create index matches_away_id_date_idx on public.matches (away_id, date);
create index matches_season_id_idx on public.matches (season_id);

alter table public.matches enable row level security;
revoke all on table public.matches from anon, authenticated;
grant select on table public.matches to anon, authenticated;
grant select, insert, update, delete on table public.matches to service_role;
create policy "matches_read" on public.matches for select to anon, authenticated using (true);

-- titles ----------------------------------------------------------------------------------------

create table public.titles (
  id text primary key,
  club_id text not null references public.clubs (id),
  competition_id text not null references public.competitions (id),
  season_id text not null references public.seasons (id),
  awarded_on date not null,
  shared boolean not null,
  source text not null,
  verified boolean not null,
  -- The title's competition must be the competition of its season.
  foreign key (season_id, competition_id) references public.seasons (id, competition_id),
  check (id <> ''),
  check (club_id <> ''),
  check (competition_id <> ''),
  check (season_id <> ''),
  check (source ~ '\S')
);

create index titles_club_id_awarded_on_idx on public.titles (club_id, awarded_on);
create index titles_season_id_competition_id_idx on public.titles (season_id, competition_id);
create index titles_competition_id_idx on public.titles (competition_id);

alter table public.titles enable row level security;
revoke all on table public.titles from anon, authenticated;
grant select on table public.titles to anon, authenticated;
grant select, insert, update, delete on table public.titles to service_role;
create policy "titles_read" on public.titles for select to anon, authenticated using (true);

-- movements -------------------------------------------------------------------------------------

create table public.movements (
  id text primary key,
  club_id text not null references public.clubs (id),
  type text not null,
  date date not null,
  season_id text not null references public.seasons (id),
  source text not null,
  check (id <> ''),
  check (club_id <> ''),
  check (season_id <> ''),
  check (source ~ '\S'),
  check (type in ('relegation', 'promotion'))
);

create index movements_club_id_date_idx on public.movements (club_id, date);
create index movements_season_id_idx on public.movements (season_id);

alter table public.movements enable row level security;
revoke all on table public.movements from anon, authenticated;
grant select on table public.movements to anon, authenticated;
grant select, insert, update, delete on table public.movements to service_role;
create policy "movements_read" on public.movements for select to anon, authenticated using (true);

-- rivalries -------------------------------------------------------------------------------------
-- No club_a <> club_b or unordered-duplicate check: the validator does not enforce them yet.

create table public.rivalries (
  club_a text not null references public.clubs (id),
  club_b text not null references public.clubs (id),
  is_classic boolean not null,
  name text,
  source text not null,
  primary key (club_a, club_b),
  check (club_a <> ''),
  check (club_b <> ''),
  check (source ~ '\S')
);

create index rivalries_club_b_idx on public.rivalries (club_b);

alter table public.rivalries enable row level security;
revoke all on table public.rivalries from anon, authenticated;
grant select on table public.rivalries to anon, authenticated;
grant select, insert, update, delete on table public.rivalries to service_role;
create policy "rivalries_read" on public.rivalries for select to anon, authenticated using (true);

-- coverage --------------------------------------------------------------------------------------

create table public.coverage (
  club_id text not null references public.clubs (id),
  competition_id text not null references public.competitions (id),
  "from" date not null,
  "to" date,
  complete boolean not null,
  source text not null,
  primary key (club_id, competition_id, "from"),
  check (club_id <> ''),
  check (competition_id <> ''),
  check (source ~ '\S'),
  check ("to" is null or "from" <= "to")
);

create index coverage_competition_id_idx on public.coverage (competition_id);

alter table public.coverage enable row level security;
revoke all on table public.coverage from anon, authenticated;
grant select on table public.coverage to anon, authenticated;
grant select, insert, update, delete on table public.coverage to service_role;
create policy "coverage_read" on public.coverage for select to anon, authenticated using (true);

-- standings -------------------------------------------------------------------------------------

create table public.standings (
  club_id text not null references public.clubs (id),
  season_id text not null references public.seasons (id),
  played integer not null,
  won integer not null,
  drawn integer not null,
  lost integer not null,
  source text not null,
  primary key (club_id, season_id),
  check (club_id <> ''),
  check (season_id <> ''),
  check (source ~ '\S'),
  check (played >= 0 and won >= 0 and drawn >= 0 and lost >= 0),
  check (won + drawn + lost = played)
);

create index standings_season_id_idx on public.standings (season_id);

alter table public.standings enable row level security;
revoke all on table public.standings from anon, authenticated;
grant select on table public.standings to anon, authenticated;
grant select, insert, update, delete on table public.standings to service_role;
create policy "standings_read" on public.standings for select to anon, authenticated using (true);
