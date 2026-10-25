-- The Free and Basic pricing limits are shared across AI Practice, text
-- translation, and Ask. Serialize all three event types on one per-user lock
-- and count them together so concurrent requests cannot exceed the advertised
-- daily or monthly quota by using different AI surfaces simultaneously. The
-- legacy per-feature locks are also acquired so in-flight calls using the old
-- function body cannot race the shared quota during this migration rollout.
create or replace function public.record_ai_usage_if_within_limit(
  p_user_id uuid,
  p_event_type text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  effective_plan text := 'free';
  daily_limit integer;
  monthly_limit integer;
  daily_count integer;
  monthly_count integer;
  quota_event_types text[];
  lock_scope text;
begin
  if p_user_id is null
    or p_event_type is null
    or p_event_type not in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate') then
    raise exception 'invalid_ai_usage_event';
  end if;

  if p_event_type in ('chat', 'translate', 'ask') then
    quota_event_types := array['chat', 'translate', 'ask'];
    lock_scope := 'shared_ai';
  else
    quota_event_types := array[p_event_type];
    lock_scope := p_event_type;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || lock_scope, 0));
  if p_event_type in ('chat', 'translate', 'ask') then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':ask', 0));
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':chat', 0));
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':translate', 0));
  end if;

  effective_plan := coalesce(public.get_active_paid_subscription_plan(p_user_id), 'free');

  -- Custom-card generation is unlimited for every plan. Quiz validation is
  -- limited to 15/day for Free, while paid plans keep it unlimited.
  if p_event_type = 'create_card'
    or effective_plan = 'pro'
    or (p_event_type = 'quiz_validate' and effective_plan <> 'free') then
    insert into public.ai_usage_events (user_id, event_type, plan)
    values (p_user_id, p_event_type, effective_plan);
    return 'ok';
  end if;

  if p_event_type = 'quiz_validate' then
    daily_limit := 15;
    monthly_limit := null;
  elsif effective_plan = 'basic' then
    daily_limit := 30;
    monthly_limit := 900;
  else
    daily_limit := 10;
    monthly_limit := 200;
  end if;

  select count(*) into daily_count
  from public.ai_usage_events
  where user_id = p_user_id
    and event_type = any(quota_event_types)
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  select count(*) into monthly_count
  from public.ai_usage_events
  where user_id = p_user_id
    and event_type = any(quota_event_types)
    and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');

  if daily_count >= daily_limit then return 'daily_limit'; end if;
  if monthly_count >= monthly_limit then return 'monthly_limit'; end if;

  insert into public.ai_usage_events (user_id, event_type, plan)
  values (p_user_id, p_event_type, effective_plan);
  return 'ok';
end;
$$;

revoke all on function public.record_ai_usage_if_within_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.record_ai_usage_if_within_limit(uuid, text) to service_role;

do $$
declare
  usage_function regprocedure := 'public.record_ai_usage_if_within_limit(uuid, text)'::regprocedure;
begin
  if (select prosecdef from pg_proc where oid = usage_function) then
    raise exception 'AI usage quota function must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', usage_function, 'EXECUTE')
    or has_function_privilege('authenticated', usage_function, 'EXECUTE')
    or not has_function_privilege('service_role', usage_function, 'EXECUTE') then
    raise exception 'AI usage quota function grants are not restricted to service_role';
  end if;
end;
$$;
