-- Live security check for the Supabase schema (plan 0006, ADR 0006).
-- Run it once after applying the migrations: Dashboard, SQL Editor, paste, Run.
-- It is read-only: everything happens inside a transaction that is rolled back at the end, and the
-- only rows it writes are a throwaway club and comparison that disappear with the rollback.
-- Every check writes a row to a temporary table; the final select shows all of them.
-- Read the "ok" column: it must be true on every row. "expected" says what a correct schema returns.

begin;

create temp table verify_results (
  check_name text,
  expected text,
  actual text,
  ok boolean
);
grant all on table verify_results to public;

-- (a) Expected: 0 tables without row level security.
insert into verify_results
select
  'tables without RLS',
  '0',
  count(*)::text,
  count(*) = 0
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relrowsecurity = false;

-- (b) Expected: 9 policies, all named <table>_read, command SELECT, roles anon and authenticated.
insert into verify_results
select
  'policies on public tables',
  '9 select policies named *_read for anon, authenticated',
  count(*)::text || ' policies, ' || count(*) filter (
    where cmd = 'SELECT' and policyname = tablename || '_read' and roles::text[] = array['anon', 'authenticated']::text[]
  )::text || ' as expected',
  count(*) = 9 and count(*) filter (
    where cmd = 'SELECT' and policyname = tablename || '_read' and roles::text[] = array['anon', 'authenticated']::text[]
  ) = 9
from pg_policies
where schemaname = 'public';

-- (c) Expected: anon and authenticated cannot write or truncate any table; nobody can touch comparisons directly.
insert into verify_results
select
  'anon or authenticated can write: ' || c.relname,
  'false',
  (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))::text,
  not (has_table_privilege('anon', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE')
    or has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname <> 'verify_results';

insert into verify_results
select
  'role can read comparisons: ' || r,
  'false',
  has_table_privilege(r, 'public.comparisons', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')::text,
  not has_table_privilege(r, 'public.comparisons', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
from unnest(array['anon', 'authenticated', 'service_role']) as r;

insert into verify_results
values (
  'service_role can select comparisons',
  'false',
  has_table_privilege('service_role', 'public.comparisons', 'SELECT')::text,
  not has_table_privilege('service_role', 'public.comparisons', 'SELECT')
);

-- Expected: only service_role may execute the two comparison functions.
insert into verify_results
select
  'execute ' || f || ' as ' || r,
  (r = 'service_role')::text,
  has_function_privilege(r, f, 'EXECUTE')::text,
  has_function_privilege(r, f, 'EXECUTE') = (r = 'service_role')
from unnest(array['public.create_comparison(text, date, text)', 'public.get_comparison(text)']) as f,
  unnest(array['anon', 'authenticated', 'service_role']) as r;

-- (d) Expected: as anon, reading a data table works and every write is refused.
set local role anon;

do $$
begin
  perform count(*) from public.clubs;
  insert into verify_results values ('anon can read clubs', 'allowed', 'allowed', true);
exception
  when insufficient_privilege then
    insert into verify_results values ('anon can read clubs', 'allowed', 'refused', false);
end;
$$;

do $$
begin
  insert into public.clubs (id) values ('verify-anon');
  insert into verify_results values ('anon insert into clubs', 'refused', 'allowed', false);
exception
  when insufficient_privilege then
    insert into verify_results values ('anon insert into clubs', 'refused', 'refused', true);
end;
$$;

do $$
begin
  truncate public.clubs;
  insert into verify_results values ('anon truncate clubs', 'refused', 'allowed', false);
exception
  when insufficient_privilege then
    insert into verify_results values ('anon truncate clubs', 'refused', 'refused', true);
end;
$$;

do $$
begin
  perform count(*) from public.comparisons;
  insert into verify_results values ('anon reads comparisons', 'refused', 'allowed', false);
exception
  when insufficient_privilege then
    insert into verify_results values ('anon reads comparisons', 'refused', 'refused', true);
end;
$$;

do $$
begin
  perform * from public.get_comparison('aaaaaaaaaaaaaaaaaaaaaa');
  insert into verify_results values ('anon calls get_comparison', 'refused', 'allowed', false);
exception
  when insufficient_privilege then
    insert into verify_results values ('anon calls get_comparison', 'refused', 'refused', true);
end;
$$;

reset role;

-- (e) Expected: as service_role, a comparison can be created and read back through the functions only.
insert into public.clubs (id, name, short_name, aliases, colors, jersey_pattern, founded, city, source)
values (
  'verify-club', 'Verify', 'Verify', array[]::text[],
  '{"primary": "#112233", "secondary": "#445566"}'::jsonb,
  'solid', 1900, 'Nowhere', 'verify'
);

set local role service_role;

do $$
declare
  v_slug text;
  v_rows integer;
begin
  v_slug := public.create_comparison('verify-club', date '2020-01-01', '  Hincha  ');
  insert into verify_results values ('create_comparison returns a 22 character slug', '22', length(v_slug)::text, length(v_slug) = 22);
  select count(*) into v_rows from public.get_comparison(v_slug);
  insert into verify_results values ('get_comparison finds it', '1', v_rows::text, v_rows = 1);
  select count(*) into v_rows from public.get_comparison('not-a-valid-slug');
  insert into verify_results values ('get_comparison with a malformed slug', '0', v_rows::text, v_rows = 0);
  select count(*) into v_rows from public.get_comparison(v_slug) where nickname = 'Hincha';
  insert into verify_results values ('nickname is trimmed', '1', v_rows::text, v_rows = 1);
exception
  when others then
    insert into verify_results values ('service_role comparison flow', 'works', sqlerrm, false);
end;
$$;

do $$
begin
  perform count(*) from public.comparisons;
  insert into verify_results values ('service_role reads comparisons directly', 'refused', 'allowed', false);
exception
  when insufficient_privilege then
    insert into verify_results values ('service_role reads comparisons directly', 'refused', 'refused', true);
end;
$$;

reset role;

-- Read this table: every row must have ok = true.
select * from verify_results order by ok, check_name;

rollback;
