-- Shareable comparisons (ADR 0006, section 4).
-- Private by construction: RLS is enabled with no policies and no role has any privilege on the
-- table. The only way in is two security definer functions callable by service_role alone, so even
-- a leaked secret key cannot list comparisons. The birth date is never stored: start_date is the
-- date the fan chose as the start of following the club. There is no name, email, IP or user agent.

create extension if not exists pgcrypto with schema extensions;

create table public.comparisons (
  slug text primary key,
  club_id text not null references public.clubs (id),
  start_date date not null,
  nickname text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  check (slug ~ '^[A-Za-z0-9_-]{22}$'),
  check (start_date >= date '1880-01-01'),
  check (
    nickname is null
    or (
      char_length(nickname) between 1 and 24
      and nickname !~ '[[:cntrl:]]'
      and nickname !~ '^\s|\s$'
    )
  ),
  check (expires_at > created_at and expires_at <= created_at + interval '90 days')
);

create index comparisons_expires_at_idx on public.comparisons (expires_at);
create index comparisons_club_id_idx on public.comparisons (club_id);

alter table public.comparisons enable row level security;
revoke all on table public.comparisons from public, anon, authenticated, service_role;

-- Creates a comparison and returns its slug (128 random bits, base64url, 22 characters).
create function public.create_comparison(p_club_id text, p_start_date date, p_nickname text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := nullif(regexp_replace(p_nickname, '^\s+|\s+$', '', 'g'), '');
  v_slug text;
  v_attempt integer := 0;
begin
  if p_club_id is null or p_start_date is null then
    raise exception 'club and start date are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clubs c where c.id = p_club_id) then
    raise exception 'unknown club' using errcode = '22023';
  end if;
  if p_start_date < date '1880-01-01'
    or p_start_date > (now() at time zone 'America/Argentina/Buenos_Aires')::date then
    raise exception 'start date out of range' using errcode = '22023';
  end if;
  if v_nickname is not null
    and (char_length(v_nickname) > 24 or v_nickname ~ '[[:cntrl:]]') then
    raise exception 'invalid nickname' using errcode = '22023';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_slug := translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_');
    begin
      insert into public.comparisons (slug, club_id, start_date, nickname)
      values (v_slug, p_club_id, p_start_date, v_nickname);
      return v_slug;
    exception
      when unique_violation then
        if v_attempt >= 2 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

-- Returns zero or one row: only the comparison of this slug, and only while it has not expired.
create function public.get_comparison(p_slug text)
returns table (club_id text, start_date date, nickname text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.club_id, c.start_date, c.nickname, c.expires_at
  from public.comparisons c
  where p_slug ~ '^[A-Za-z0-9_-]{22}$'
    and c.slug = p_slug
    and c.expires_at > now()
$$;

revoke all on function public.create_comparison(text, date, text) from public, anon, authenticated;
grant execute on function public.create_comparison(text, date, text) to service_role;
revoke all on function public.get_comparison(text) from public, anon, authenticated;
grant execute on function public.get_comparison(text) to service_role;
