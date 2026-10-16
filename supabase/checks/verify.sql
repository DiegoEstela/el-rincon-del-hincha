-- Live security check for the Supabase schema (plan 0006, ADR 0006).
-- Run it once after applying the migrations: Dashboard, SQL Editor, paste, Run.
--
-- HOW TO READ THE OUTPUT: the SQL Editor shows only the result of the last statement, so this file
-- is ONE do block that always ends by raising an exception, and the error message IS the report.
-- It looks like "ERROR: P0001: verify.sql report ..." followed by one line per check: "OK <name>"
-- or "FAIL <name> (expected ..., got ...)". A FAIL is reported through that same message. The
-- first line says "RESULT: ALL N CHECKS OK" when every line starts with OK. Seeing an error is
-- NORMAL here: it is how the script reports.
--
-- It has no side effects: raising an exception aborts the single statement and rolls back
-- everything it did (the throwaway club and comparison, and any write a broken schema might have
-- allowed). There is no begin, commit or rollback to run by hand.
--
-- If a check cannot run (for example the comparison flow), it shows as a FAIL line with the
-- database error text instead of stopping the report.
--
-- pgcrypto must live in the extensions schema (create extension pgcrypto with schema extensions):
-- create_comparison calls extensions.gen_random_bytes, so without it the comparison flow checks fail.

do $verify$
declare
  v_lines text[] := array[]::text[];
  v_case record;
  v_outcome text;
  v_slug text;
  v_rows integer;
  v_failed integer;
begin
  begin
    -- Catalog checks. Each row is one report line: name, expected, actual, ok.
    for v_case in
      -- (a) Expected: 0 tables without row level security.
      select
        'tables without RLS' as name,
        '0' as expected,
        count(*)::text as actual,
        count(*) = 0 as ok
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and c.relrowsecurity = false

      union all

      -- (b) Expected: 9 policies, all named <table>_read, command SELECT, roles exactly anon and
      -- authenticated (compared as sets, so the order Postgres stores them in does not matter).
      select
        'policies on public tables',
        '9 select policies named *_read for anon, authenticated',
        count(*)::text || ' policies, ' || count(*) filter (
          where cmd = 'SELECT' and policyname = tablename || '_read'
            and roles::text[] <@ array['anon', 'authenticated']
            and roles::text[] @> array['anon', 'authenticated']
        )::text || ' as expected',
        count(*) = 9 and count(*) filter (
          where cmd = 'SELECT' and policyname = tablename || '_read'
            and roles::text[] <@ array['anon', 'authenticated']
            and roles::text[] @> array['anon', 'authenticated']
        ) = 9
      from pg_policies
      where schemaname = 'public'

      union all

      -- (c) Expected: false for every table. anon and authenticated cannot write or truncate.
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

      union all

      -- Expected: false. Nobody has any direct privilege on comparisons.
      select
        'role can touch comparisons: ' || r,
        'false',
        has_table_privilege(r, 'public.comparisons', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')::text,
        not has_table_privilege(r, 'public.comparisons', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      from unnest(array['anon', 'authenticated', 'service_role']) as r

      union all

      select
        'service_role can select comparisons',
        'false',
        has_table_privilege('service_role', 'public.comparisons', 'SELECT')::text,
        not has_table_privilege('service_role', 'public.comparisons', 'SELECT')

      union all

      -- Expected: only service_role may execute the two comparison functions.
      select
        'execute ' || f || ' as ' || r,
        (r = 'service_role')::text,
        has_function_privilege(r, f, 'EXECUTE')::text,
        has_function_privilege(r, f, 'EXECUTE') = (r = 'service_role')
      from unnest(array['public.create_comparison(text, date, text)', 'public.get_comparison(text)']) as f,
        unnest(array['anon', 'authenticated', 'service_role']) as r
    loop
      v_lines := v_lines || format(
        '%s %s%s',
        case when coalesce(v_case.ok, false) then 'OK' else 'FAIL' end,
        v_case.name,
        case when coalesce(v_case.ok, false) then '' else format(' (expected %s, got %s)', v_case.expected, v_case.actual) end
      );
    end loop;

    -- (d) Behavior as each role. Expected: reading a data table works, every write is refused with
    -- insufficient_privilege (any other error means the privilege was there). A statement that is
    -- wrongly allowed is rolled back with everything else when the script raises at the end.
    for v_case in
      select * from (values
        ('anon can read clubs', 'anon', 'select count(*) from public.clubs', 'allowed'),
        ('anon insert into clubs', 'anon', 'insert into public.clubs (id) values (''verify-anon'')', 'refused'),
        ('anon truncate clubs', 'anon', 'truncate public.clubs', 'refused'),
        ('anon reads comparisons', 'anon', 'select count(*) from public.comparisons', 'refused'),
        ('anon calls get_comparison', 'anon', 'select * from public.get_comparison(''aaaaaaaaaaaaaaaaaaaaaa'')', 'refused'),
        ('service_role reads comparisons directly', 'service_role', 'select count(*) from public.comparisons', 'refused')
      ) as t(name, role_name, stmt, expected)
    loop
      begin
        execute format('set local role %I', v_case.role_name);
        execute v_case.stmt;
        v_outcome := 'allowed';
      exception
        when insufficient_privilege then
          v_outcome := 'refused';
        when others then
          v_outcome := 'error: ' || sqlerrm;
      end;
      execute 'reset role';
      v_lines := v_lines || format(
        '%s %s%s',
        case when v_outcome = v_case.expected then 'OK' else 'FAIL' end,
        v_case.name,
        case when v_outcome = v_case.expected then '' else format(' (expected %s, got %s)', v_case.expected, v_outcome) end
      );
    end loop;

    -- (e) Expected: as service_role, a comparison can be created and read back through the
    -- functions only. Needs pgcrypto in the extensions schema (see the top of this file).
    insert into public.clubs (id, name, short_name, aliases, colors, jersey_pattern, founded, city, source)
    values (
      'verify-club', 'Verify', 'Verify', array[]::text[],
      '{"primary": "#112233", "secondary": "#445566"}'::jsonb,
      'solid', 1900, 'Nowhere', 'verify'
    );

    begin
      execute 'set local role service_role';
      v_slug := public.create_comparison('verify-club', date '2020-01-01', '  Hincha  ');
      v_lines := v_lines || case when length(v_slug) = 22
        then 'OK create_comparison returns a 22 character slug'
        else format('FAIL create_comparison returns a 22 character slug (expected 22, got %s)', length(v_slug)) end;
      select count(*) into v_rows from public.get_comparison(v_slug);
      v_lines := v_lines || case when v_rows = 1
        then 'OK get_comparison finds it'
        else format('FAIL get_comparison finds it (expected 1, got %s)', v_rows) end;
      select count(*) into v_rows from public.get_comparison('not-a-valid-slug');
      v_lines := v_lines || case when v_rows = 0
        then 'OK get_comparison with a malformed slug'
        else format('FAIL get_comparison with a malformed slug (expected 0, got %s)', v_rows) end;
      select count(*) into v_rows from public.get_comparison(v_slug) where nickname = 'Hincha';
      v_lines := v_lines || case when v_rows = 1
        then 'OK nickname is trimmed'
        else format('FAIL nickname is trimmed (expected 1, got %s)', v_rows) end;
    exception
      when others then
        v_lines := v_lines || format('FAIL service_role comparison flow (expected it to work, got %s)', sqlerrm);
    end;
    execute 'reset role';
  exception
    when others then
      v_lines := v_lines || format('FAIL verify.sql stopped early (%s)', sqlerrm);
  end;

  select count(*) into v_failed from unnest(v_lines) as l where l not like 'OK %';

  -- Always raise: the exception aborts this statement (nothing it did is kept) and the SQL Editor
  -- shows the message. Every line below the first must start with OK.
  raise exception E'verify.sql report (this error is expected, it carries the results)\n%\n%',
    case when v_failed = 0
      then format('RESULT: ALL %s CHECKS OK', coalesce(array_length(v_lines, 1), 0))
      else format('RESULT: %s OF %s CHECKS FAILED', v_failed, coalesce(array_length(v_lines, 1), 0)) end,
    array_to_string(v_lines, E'\n');
end;
$verify$;
