begin;

-- All paid access must have a verified, future expiry. An active-looking row
-- with a missing/invalid expiry is stale or incomplete and must fail closed.
create or replace function public.get_active_paid_subscription_plan(p_user_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select plan
  from public.user_subscriptions
  where user_id = p_user_id
    and provider in ('google_play', 'admin')
    and plan in ('basic', 'pro')
    and ends_at is not null
    and ends_at > now()
    and status in ('active', 'on_trial', 'past_due', 'cancelled')
  limit 1;
$$;

revoke all on function public.get_active_paid_subscription_plan(uuid) from public, anon, authenticated;
grant execute on function public.get_active_paid_subscription_plan(uuid) to service_role;

create table if not exists public.image_text_translation_reservations (
  reservation_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'basic', 'pro')),
  created_at timestamptz not null default now()
);

create index if not exists image_text_translation_reservations_user_created_idx
  on public.image_text_translation_reservations (user_id, created_at);

alter table public.image_text_translation_reservations enable row level security;
revoke all on table public.image_text_translation_reservations from public, anon, authenticated;
grant all on table public.image_text_translation_reservations to service_role;

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
begin
  if p_user_id is null
    or p_event_type is null
    or p_event_type not in ('chat', 'translate', 'ask', 'create_card', 'quiz_validate') then
    raise exception 'invalid_ai_usage_event';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_event_type, 0));
  effective_plan := coalesce(public.get_active_paid_subscription_plan(p_user_id), 'free');

  -- Learn validation and custom-card generation are intentionally unlimited.
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

  if daily_count >= daily_limit then return 'daily_limit'; end if;
  if monthly_count >= monthly_limit then return 'monthly_limit'; end if;

  insert into public.ai_usage_events (user_id, event_type, plan)
  values (p_user_id, p_event_type, effective_plan);
  return 'ok';
end;
$$;

revoke all on function public.record_ai_usage_if_within_limit(uuid, text) from public, anon, authenticated;
grant execute on function public.record_ai_usage_if_within_limit(uuid, text) to service_role;

create or replace function public.reserve_image_text_translation(p_user_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  effective_plan text := 'free';
  used_count integer;
  reserved_count integer;
  new_reservation_id uuid;
begin
  if p_user_id is null then
    raise exception 'invalid_ai_usage_user';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':image_text_translate', 0));

  -- Calls are bounded to 120 seconds. Ten minutes leaves ample room for a
  -- transient provider delay while recovering reservations from crashed work.
  delete from public.image_text_translation_reservations
  where user_id = p_user_id
    and created_at < now() - interval '10 minutes';

  effective_plan := coalesce(public.get_active_paid_subscription_plan(p_user_id), 'free');

  if effective_plan <> 'pro' then
    select count(*) into used_count
    from public.ai_usage_events
    where user_id = p_user_id
      and event_type = 'image_text_translate';

    select count(*) into reserved_count
    from public.image_text_translation_reservations
    where user_id = p_user_id;

    if used_count + reserved_count >= 2 then
      return 'feature_limit';
    end if;
  end if;

  insert into public.image_text_translation_reservations (user_id, plan)
  values (p_user_id, effective_plan)
  returning reservation_id into new_reservation_id;

  return new_reservation_id::text;
end;
$$;

create or replace function public.complete_image_text_translation(
  p_user_id uuid,
  p_reservation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  reserved_plan text;
begin
  if p_user_id is null or p_reservation_id is null then
    raise exception 'invalid_image_text_translation_reservation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':image_text_translate', 0));

  select plan into reserved_plan
  from public.image_text_translation_reservations
  where reservation_id = p_reservation_id
    and user_id = p_user_id
  for update;

  if not found then
    if exists (
      select 1 from public.ai_usage_events
      where id = p_reservation_id
        and user_id = p_user_id
        and event_type = 'image_text_translate'
    ) then
      return 'ok';
    end if;
    raise exception 'image_text_translation_reservation_not_found';
  end if;

  insert into public.ai_usage_events (id, user_id, event_type, plan)
  values (p_reservation_id, p_user_id, 'image_text_translate', reserved_plan);

  delete from public.image_text_translation_reservations
  where reservation_id = p_reservation_id
    and user_id = p_user_id;

  return 'ok';
end;
$$;

create or replace function public.release_image_text_translation(
  p_user_id uuid,
  p_reservation_id uuid
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_user_id is null or p_reservation_id is null then
    raise exception 'invalid_image_text_translation_reservation';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':image_text_translate', 0));
  delete from public.image_text_translation_reservations
  where reservation_id = p_reservation_id
    and user_id = p_user_id;
  return 'ok';
end;
$$;

create or replace function public.record_image_text_translation_if_available(p_user_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  reservation_result text;
begin
  reservation_result := public.reserve_image_text_translation(p_user_id);
  if reservation_result = 'feature_limit' then return 'feature_limit'; end if;
  perform public.complete_image_text_translation(p_user_id, reservation_result::uuid);
  return 'ok';
end;
$$;

revoke all on function public.reserve_image_text_translation(uuid) from public, anon, authenticated;
revoke all on function public.complete_image_text_translation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_image_text_translation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_image_text_translation_if_available(uuid) from public, anon, authenticated;
grant execute on function public.reserve_image_text_translation(uuid) to service_role;
grant execute on function public.complete_image_text_translation(uuid, uuid) to service_role;
grant execute on function public.release_image_text_translation(uuid, uuid) to service_role;
grant execute on function public.record_image_text_translation_if_available(uuid) to service_role;

create or replace function public.enforce_user_card_subscription_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
  learned_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));

  if public.get_active_paid_subscription_plan(new.user_id) is not null then
    return new;
  end if;

  if new.status = 'active'
    and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    select count(*) into active_count
    from public.user_cards
    where user_id = new.user_id and status = 'active';

    if active_count >= 20 then
      raise exception 'free_active_card_limit';
    end if;
  end if;

  if new.status = 'learned' and (tg_op = 'INSERT' or old.status is distinct from 'learned') then
    select count(*) into learned_count
    from public.user_cards
    where user_id = new.user_id and status = 'learned';

    if learned_count >= 100 then
      raise exception 'free_learned_card_limit';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_user_card_subscription_limits on public.user_cards;
create trigger enforce_user_card_subscription_limits
  before insert or update of status on public.user_cards
  for each row
  execute function public.enforce_user_card_subscription_limits();

revoke all on function public.enforce_user_card_subscription_limits() from public, anon, authenticated;

create or replace function public.developer_admin_dashboard_stats()
returns table (
  total_users bigint,
  basic_subscribers bigint,
  pro_subscribers bigint,
  active_cards bigint,
  learned_cards bigint,
  total_cards bigint,
  monthly_recurring_revenue_try numeric,
  revenue_priced_subscribers bigint,
  revenue_unpriced_subscribers bigint
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.user_profiles),
    (select count(*) from public.user_subscriptions
      where provider in ('google_play', 'admin')
        and plan = 'basic'
        and status in ('active', 'on_trial', 'past_due', 'cancelled')
        and ends_at is not null and ends_at > now()),
    (select count(*) from public.user_subscriptions
      where provider in ('google_play', 'admin')
        and plan = 'pro'
        and status in ('active', 'on_trial', 'past_due', 'cancelled')
        and ends_at is not null and ends_at > now()),
    (select count(*) from public.user_cards where status = 'active'),
    (select count(*) from public.user_cards where status = 'learned'),
    (select count(*) from public.user_cards),
    (select coalesce(sum(recurring_monthly_try), 0)
      from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and ends_at is not null and ends_at > now()
        and auto_renew_enabled = true
        and recurring_monthly_try is not null),
    (select count(*) from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and ends_at is not null and ends_at > now()
        and auto_renew_enabled = true
        and recurring_monthly_try is not null),
    (select count(*) from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and ends_at is not null and ends_at > now()
        and auto_renew_enabled = true
        and recurring_monthly_try is null);
$$;

revoke all on function public.developer_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.developer_admin_dashboard_stats() to service_role;

notify pgrst, 'reload schema';

commit;
