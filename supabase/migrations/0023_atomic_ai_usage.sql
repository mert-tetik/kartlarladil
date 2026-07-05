-- Atomic AI usage quota check and record.
-- This function counts existing usage within the current UTC day/month and inserts
-- a new event only when both daily and monthly limits have not been reached yet.
-- It prevents race-condition bypasses from parallel requests.

create or replace function public.record_ai_usage_if_within_limit(
  p_user_id uuid,
  p_event_type text,
  p_plan text,
  p_daily_limit integer,
  p_monthly_limit integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_count integer;
  monthly_count integer;
begin
  select count(*)
  into daily_count
  from public.ai_usage_events
  where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'utc');

  select count(*)
  into monthly_count
  from public.ai_usage_events
  where user_id = p_user_id
    and created_at >= date_trunc('month', now() at time zone 'utc');

  if daily_count >= p_daily_limit then
    return 'daily_limit';
  end if;

  if monthly_count >= p_monthly_limit then
    return 'monthly_limit';
  end if;

  insert into public.ai_usage_events (user_id, event_type, plan)
  values (p_user_id, p_event_type, p_plan);

  return 'ok';
end;
$$;

grant execute on function public.record_ai_usage_if_within_limit(uuid, text, text, integer, integer) to authenticated, service_role;
