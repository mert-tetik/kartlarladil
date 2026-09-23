-- Repair subscription feature entitlements in environments where the
-- 20260920 migration was not applied, or where PostgREST still exposes only
-- the legacy five-argument quota function.
--
-- Quota writes remain atomic and server-only. The application must not fall
-- back to a client-side count/insert pair because concurrent requests could
-- bypass the image-translation lifetime limit.

alter table public.ai_usage_events
  drop constraint if exists ai_usage_events_event_type_check;

alter table public.ai_usage_events
  add constraint ai_usage_events_event_type_check
  check (event_type in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate', 'image_text_translate'));

create index if not exists ai_usage_events_user_type_created_idx
  on public.ai_usage_events(user_id, event_type, created_at desc);

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
  subscription_plan text;
  subscription_status text;
  subscription_ends_at timestamptz;
  daily_limit integer;
  monthly_limit integer;
  daily_count integer;
  monthly_count integer;
begin
  if p_user_id is null or p_event_type not in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate') then
    raise exception 'invalid_ai_usage_event';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_event_type, 0));

  select plan, status, ends_at
  into subscription_plan, subscription_status, subscription_ends_at
  from public.user_subscriptions
  where user_id = p_user_id;

  if subscription_plan in ('basic', 'pro')
    and (
      (subscription_status in ('active', 'on_trial', 'past_due') and (subscription_ends_at is null or subscription_ends_at > now()))
      or (subscription_status = 'cancelled' and subscription_ends_at > now())
    ) then
    effective_plan := subscription_plan;
  end if;

  -- Custom-card creation and Learn answer validation are foundational and
  -- unlimited for every plan. Pro also bypasses the normal AI quotas.
  if p_event_type in ('create_card', 'quiz_validate') or effective_plan = 'pro' then
    insert into public.ai_usage_events (user_id, event_type, plan)
    values (p_user_id, p_event_type, effective_plan);
    return 'ok';
  end if;

  if effective_plan = 'basic' then
    daily_limit := 30;
    monthly_limit := 900;
  else
    daily_limit := 10;
    monthly_limit := 200;
  end if;

  select count(*) into daily_count
  from public.ai_usage_events
  where user_id = p_user_id
    and event_type = p_event_type
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  select count(*) into monthly_count
  from public.ai_usage_events
  where user_id = p_user_id
    and event_type = p_event_type
    and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');

  if daily_count >= daily_limit then
    return 'daily_limit';
  end if;

  if monthly_count >= monthly_limit then
    return 'monthly_limit';
  end if;

  insert into public.ai_usage_events (user_id, event_type, plan)
  values (p_user_id, p_event_type, effective_plan);

  return 'ok';
end;
$$;

create or replace function public.record_image_text_translation_if_available(
  p_user_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  effective_plan text := 'free';
  subscription_plan text;
  subscription_status text;
  subscription_ends_at timestamptz;
  usage_count integer;
begin
  if p_user_id is null then
    raise exception 'invalid_ai_usage_user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':image_text_translate', 0));

  select plan, status, ends_at
  into subscription_plan, subscription_status, subscription_ends_at
  from public.user_subscriptions
  where user_id = p_user_id;

  if subscription_plan in ('basic', 'pro')
    and (
      (subscription_status in ('active', 'on_trial', 'past_due') and (subscription_ends_at is null or subscription_ends_at > now()))
      or (subscription_status = 'cancelled' and subscription_ends_at > now())
    ) then
    effective_plan := subscription_plan;
  end if;

  if effective_plan <> 'pro' then
    select count(*) into usage_count
    from public.ai_usage_events
    where user_id = p_user_id
      and event_type = 'image_text_translate';

    if usage_count >= 2 then
      return 'feature_limit';
    end if;
  end if;

  insert into public.ai_usage_events (user_id, event_type, plan)
  values (p_user_id, 'image_text_translate', effective_plan);

  return 'ok';
end;
$$;

revoke all on table public.ai_usage_events from anon, authenticated;
grant all on table public.ai_usage_events to service_role;

revoke all on function public.record_ai_usage_if_within_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.record_ai_usage_if_within_limit(uuid, text) to service_role;

revoke all on function public.record_image_text_translation_if_available(uuid) from public, anon, authenticated;
grant execute on function public.record_image_text_translation_if_available(uuid) to service_role;

-- The legacy signature accepts caller-supplied limits and counts all AI
-- events together. It must not remain an executable quota path.
do $$
begin
  if to_regprocedure('public.record_ai_usage_if_within_limit(uuid,text,text,integer,integer)') is not null then
    execute 'revoke all on function public.record_ai_usage_if_within_limit(uuid, text, text, integer, integer) from public, anon, authenticated, service_role';
  end if;
end;
$$;

notify pgrst, 'reload schema';
