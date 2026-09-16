-- Daily streaks are based on one immutable login row per user and calendar day.
-- The date log is the source of truth; the current streak is derived atomically
-- whenever the app records an entry.

create table if not exists public.user_daily_logins (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create index if not exists user_daily_logins_user_date_idx
  on public.user_daily_logins(user_id, activity_date desc);

alter table public.user_daily_logins enable row level security;

revoke all on table public.user_daily_logins from anon, authenticated;
grant select on table public.user_daily_logins to authenticated;

drop policy if exists user_daily_logins_select_own on public.user_daily_logins;
create policy user_daily_logins_select_own
  on public.user_daily_logins
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop function if exists public.record_daily_login(text);
create function public.record_daily_login(p_timezone text default 'UTC')
returns table (
  current_streak integer,
  activity_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  today_date date;
  streak_count integer := 0;
begin
  if caller_id is null then
    raise exception 'daily_streak_auth_required';
  end if;

  if p_timezone is null
     or not exists (
       select 1
         from pg_catalog.pg_timezone_names as timezone_name
        where timezone_name.name = p_timezone
     ) then
    raise exception 'daily_streak_invalid_timezone';
  end if;

  today_date := (pg_catalog.timezone(p_timezone, pg_catalog.now()))::date;

  -- Serialize entries for one user so concurrent first visits cannot produce
  -- inconsistent streak calculations.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text || ':daily-streak', 0)
  );

  insert into public.user_daily_logins (user_id, activity_date)
  values (caller_id, today_date)
  on conflict (user_id, activity_date) do nothing;

  -- Find the first missing day when walking backwards from today. Counting
  -- matching rows is not enough here: an older run must not jump across a gap
  -- and accidentally inflate the current streak.
  select coalesce(min(day_offset), 0)::integer
    into streak_count
    from pg_catalog.generate_series(
      0,
      (
        select count(*)::integer
          from public.user_daily_logins as login
         where login.user_id = caller_id
           and login.activity_date <= today_date
      )
    ) as offsets(day_offset)
   where not exists (
     select 1
       from public.user_daily_logins as login
      where login.user_id = caller_id
        and login.activity_date = today_date - offsets.day_offset
   );

  return query select greatest(streak_count, 1), today_date;
end;
$$;

revoke execute on function public.record_daily_login(text) from public, anon;
grant execute on function public.record_daily_login(text) to authenticated;
