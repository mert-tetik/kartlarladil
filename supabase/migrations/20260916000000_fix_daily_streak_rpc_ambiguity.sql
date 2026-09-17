-- Fix the daily login RPC failing with 42702 because its return column name
-- activity_date can collide with a PL/pgSQL/table column reference.
create or replace function public.record_daily_login(p_timezone text default 'UTC')
returns table (
  current_streak integer,
  activity_date date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_today_date date;
  v_streak_count integer := 0;
begin
  if v_caller_id is null then
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

  v_today_date := (pg_catalog.timezone(p_timezone, pg_catalog.now()))::date;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_caller_id::text || ':daily-streak', 0)
  );

  insert into public.user_daily_logins (user_id, activity_date)
  values (v_caller_id, v_today_date)
  on conflict (user_id, activity_date) do nothing;

  select coalesce(min(offsets.day_offset), 0)::integer
    into v_streak_count
    from pg_catalog.generate_series(
      0,
      (
        select count(*)::integer
          from public.user_daily_logins as daily_login
         where daily_login.user_id = v_caller_id
           and daily_login.activity_date <= v_today_date
      )
    ) as offsets(day_offset)
   where not exists (
     select 1
       from public.user_daily_logins as daily_login
      where daily_login.user_id = v_caller_id
        and daily_login.activity_date = v_today_date - offsets.day_offset
   );

  return query select greatest(v_streak_count, 1), v_today_date;
end;
$$;

revoke execute on function public.record_daily_login(text) from public, anon;
grant execute on function public.record_daily_login(text) to authenticated;
