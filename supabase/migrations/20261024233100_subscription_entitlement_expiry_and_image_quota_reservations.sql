begin;

-- Keep the trigger helper's name resolution deterministic (also clears the
-- mutable-search_path security advisor finding for this public function).
alter function public.set_push_subscription_updated_at()
  set search_path = pg_catalog, public, pg_temp;

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
set search_path = pg_catalog, public, pg_temp
as $$
declare
  active_count integer;
  learned_count integer;
begin
  -- Match add_user_cards_with_active_limit's key so direct status transitions
  -- and batch additions serialize against the same per-user active-card cap.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

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

-- Game rewards are issued by the authenticated server action, which calls
-- this RPC with the service-role client after validating the user's level.
-- Revoke the explicit anon grant as well as PUBLIC/default execution rights.
alter function public.increment_game_points(uuid, integer)
  set search_path = pg_catalog, public, pg_temp;
revoke all on function public.increment_game_points(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.increment_game_points(uuid, integer)
  to service_role;

-- These account-mutating reward RPCs are called by authenticated server
-- actions through the service-role client, never directly by browser clients.
revoke all on function
  public.award_chest_gem_reward(uuid, text, text),
  public.award_chest_gem_rewards(uuid, text, text),
  public.award_chest_reward(uuid, text, text, integer),
  public.award_chest_rewards(uuid, text, text, integer),
  public.award_progress_gem_reward(uuid, text, text, integer, integer, integer, integer),
  public.award_progress_gem_rewards(uuid, text, text, integer, integer, integer, integer),
  public.claim_mission_gem_reward(uuid, text, text, integer, integer, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer, text, integer),
  public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer),
  public.convert_gem_to_points(uuid, text, text),
  public.increment_ai_practice_points(uuid, integer),
  public.increment_chest_points(uuid, integer),
  public.increment_mission_points(uuid, integer),
  public.spend_gem(uuid, text, integer, text, text),
  public.spend_gem_and_mark_card_learned(uuid, text, integer),
  public.spend_gem_and_remove_card(uuid, text, integer)
from public, anon, authenticated;
grant execute on function
  public.award_chest_gem_reward(uuid, text, text),
  public.award_chest_gem_rewards(uuid, text, text),
  public.award_chest_reward(uuid, text, text, integer),
  public.award_chest_rewards(uuid, text, text, integer),
  public.award_progress_gem_reward(uuid, text, text, integer, integer, integer, integer),
  public.award_progress_gem_rewards(uuid, text, text, integer, integer, integer, integer),
  public.claim_mission_gem_reward(uuid, text, text, integer, integer, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer, text, integer),
  public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer),
  public.convert_gem_to_points(uuid, text, text),
  public.increment_ai_practice_points(uuid, integer),
  public.increment_chest_points(uuid, integer),
  public.increment_mission_points(uuid, integer),
  public.spend_gem(uuid, text, integer, text, text),
  public.spend_gem_and_mark_card_learned(uuid, text, integer),
  public.spend_gem_and_remove_card(uuid, text, integer)
to service_role;

-- This RPC remains user-callable for the quiz action, so bind its target user
-- to the authenticated session before it writes a SECURITY DEFINER table.
create or replace function public.award_quiz_streak_points(
  p_user_id uuid,
  p_session_id uuid,
  p_streak integer,
  p_points integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  insert into public.quiz_streak_rewards (user_id, session_id, streak, points)
  values (p_user_id, p_session_id, p_streak, p_points)
  on conflict (session_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set streak_points = streak_points + p_points
  where user_id = p_user_id;

  return true;
end;
$$;
revoke all on function public.award_quiz_streak_points(uuid, uuid, integer, integer)
  from public, anon;
grant execute on function public.award_quiz_streak_points(uuid, uuid, integer, integer)
  to authenticated, service_role;

-- These client-callable reward functions verify auth.uid() against p_user_id;
-- remove any explicit anon/PUBLIC grants while retaining authenticated access.
revoke all on function public.award_quiz_bonus_points(uuid, uuid, text, integer)
  from public, anon;
revoke all on function public.award_quiz_result_points(uuid, uuid, integer, integer)
  from public, anon;
revoke all on function public.claim_quiz_result_medals(uuid, uuid, integer)
  from public, anon;

-- Trigger-only routine; direct RPC execution is not part of the application.
revoke all on function public.sync_subscription_display_name()
  from public, anon, authenticated;

-- RLS protects profile rows, but table-level INSERT/UPDATE grants still let a
-- user change protected columns on their own row (including paid theme and
-- reward balances). Keep direct writes limited to user-editable preferences;
-- paid theme changes go through authenticated server actions using service_role.
revoke all privileges on table public.user_profiles from public, anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant insert (
  user_id,
  display_name,
  preferred_language_code,
  preferred_ui_locale,
  preferred_tier,
  onboarding_completed,
  profile_picture_index,
  leaderboard_visible,
  updated_at
) on table public.user_profiles to authenticated;
grant update (
  user_id,
  display_name,
  preferred_language_code,
  preferred_ui_locale,
  preferred_tier,
  onboarding_completed,
  profile_picture_index,
  leaderboard_visible,
  push_marketing_enabled,
  updated_at
) on table public.user_profiles to authenticated;

-- The product intentionally lets a verified Google Play purchase be restored
-- by multiple FoxiesDeck accounts. Backfill every account already represented
-- by a subscription so RTDN updates continue reaching all of them.
insert into public.google_play_purchase_accounts (purchase_token, user_id)
select distinct s.google_play_purchase_token, s.user_id
from public.user_subscriptions as s
where s.provider = 'google_play'
  and s.google_play_purchase_token is not null
on conflict (purchase_token, user_id) do nothing;

-- Fail the migration rather than silently leaving any paid-access or reward
-- bypass available through the public Supabase API.
do $$
declare
  exposed_definer_functions integer;
begin
  if has_table_privilege('anon', 'public.user_profiles', 'select')
    or has_table_privilege('anon', 'public.user_profiles', 'insert')
    or has_table_privilege('anon', 'public.user_profiles', 'update')
    or has_table_privilege('anon', 'public.user_profiles', 'delete')
    or has_table_privilege('anon', 'public.user_profiles', 'truncate')
    or has_table_privilege('anon', 'public.user_profiles', 'references') then
    raise exception 'subscription_security_check_failed: anon_user_profiles_access';
  end if;

  if not has_table_privilege('authenticated', 'public.user_profiles', 'select')
    or exists (
      select 1
      from unnest(array[
        'user_id',
        'display_name',
        'preferred_language_code',
        'preferred_ui_locale',
        'preferred_tier',
        'onboarding_completed',
        'profile_picture_index',
        'leaderboard_visible',
        'updated_at'
      ]) as required_column(column_name)
      where not has_column_privilege(
        'authenticated', 'public.user_profiles', required_column.column_name, 'insert'
      )
    )
    or exists (
      select 1
      from unnest(array[
        'user_id',
        'display_name',
        'preferred_language_code',
        'preferred_ui_locale',
        'preferred_tier',
        'onboarding_completed',
        'profile_picture_index',
        'leaderboard_visible',
        'push_marketing_enabled',
        'updated_at'
      ]) as required_column(column_name)
      where not has_column_privilege(
        'authenticated', 'public.user_profiles', required_column.column_name, 'update'
      )
    ) then
    raise exception 'subscription_security_check_failed: expected_profile_access_missing';
  end if;

  if has_table_privilege('authenticated', 'public.user_profiles', 'delete')
    or has_table_privilege('authenticated', 'public.user_profiles', 'truncate') then
    raise exception 'subscription_security_check_failed: direct_profile_delete_access';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.user_profiles'::regclass and relrowsecurity
  ) then
    raise exception 'subscription_security_check_failed: profile_rls_disabled';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'user_profiles'
      and (
        has_column_privilege(
          'anon', 'public.user_profiles', column_info.column_name, 'select'
        ) or has_column_privilege(
          'anon', 'public.user_profiles', column_info.column_name, 'insert'
        ) or has_column_privilege(
          'anon', 'public.user_profiles', column_info.column_name, 'update'
        ) or has_column_privilege(
          'anon', 'public.user_profiles', column_info.column_name, 'references'
        )
      )
  ) then
    raise exception 'subscription_security_check_failed: anon_profile_column_access';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = 'user_profiles'
      and (
        (
          column_info.column_name not in (
            'user_id',
            'display_name',
            'preferred_language_code',
            'preferred_ui_locale',
            'preferred_tier',
            'onboarding_completed',
            'profile_picture_index',
            'leaderboard_visible',
            'updated_at'
          )
          and has_column_privilege(
            'authenticated', 'public.user_profiles', column_info.column_name, 'insert'
          )
        )
        or (
          column_info.column_name not in (
            'user_id',
            'display_name',
            'preferred_language_code',
            'preferred_ui_locale',
            'preferred_tier',
            'onboarding_completed',
            'profile_picture_index',
            'leaderboard_visible',
            'push_marketing_enabled',
            'updated_at'
          )
          and has_column_privilege(
            'authenticated', 'public.user_profiles', column_info.column_name, 'update'
          )
        )
        or has_column_privilege(
          'authenticated', 'public.user_profiles', column_info.column_name, 'references'
        )
      )
  ) then
    raise exception 'subscription_security_check_failed: unexpected_profile_column_write';
  end if;

  if exists (
    select 1
    from unnest(array[
      'theme',
      'ai_practice_points',
      'blue_gems',
      'chest_points',
      'game_points',
      'gem_points',
      'green_gems',
      'mission_points',
      'purple_gems',
      'quiz_result_medals',
      'quiz_result_points',
      'streak_points'
    ]) as protected_column(column_name)
    where has_column_privilege(
      'authenticated',
      'public.user_profiles',
      protected_column.column_name,
      'insert'
    ) or has_column_privilege(
      'authenticated',
      'public.user_profiles',
      protected_column.column_name,
      'update'
    )
  ) then
    raise exception 'subscription_security_check_failed: protected_profile_write';
  end if;

  if has_column_privilege('service_role', 'public.user_profiles', 'theme', 'update') is false then
    raise exception 'subscription_security_check_failed: service_role_theme_update_missing';
  end if;

  if has_table_privilege('anon', 'public.user_subscriptions', 'select')
    or has_table_privilege('anon', 'public.user_subscriptions', 'insert')
    or has_table_privilege('anon', 'public.user_subscriptions', 'update')
    or has_table_privilege('anon', 'public.user_subscriptions', 'delete')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'select')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'insert')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'update')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'delete')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'truncate')
    or has_table_privilege('authenticated', 'public.user_subscriptions', 'references')
    or has_table_privilege('anon', 'public.user_subscriptions', 'truncate')
    or has_table_privilege('anon', 'public.user_subscriptions', 'references') then
    raise exception 'subscription_security_check_failed: direct_subscription_table_access';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.user_subscriptions'::regclass and relrowsecurity
  ) then
    raise exception 'subscription_security_check_failed: subscription_rls_disabled';
  end if;

  select count(*) into exposed_definer_functions
  from pg_proc as function_info
  join pg_namespace as namespace_info on namespace_info.oid = function_info.pronamespace
  where namespace_info.nspname = 'public'
    and function_info.prosecdef
    and has_function_privilege('anon', function_info.oid, 'execute');

  if exposed_definer_functions > 0 then
    raise exception 'subscription_security_check_failed: anon_security_definer_functions=%',
      exposed_definer_functions;
  end if;

  if has_function_privilege(
    'authenticated', 'public.increment_game_points(uuid, integer)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.increment_chest_points(uuid, integer)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.increment_mission_points(uuid, integer)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.increment_ai_practice_points(uuid, integer)', 'execute'
  ) then
    raise exception 'subscription_security_check_failed: direct_reward_rpc_access';
  end if;

  if has_function_privilege(
    'anon', 'public.enforce_user_card_subscription_limits()', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.enforce_user_card_subscription_limits()', 'execute'
  ) then
    raise exception 'subscription_security_check_failed: direct_card_limit_trigger_rpc';
  end if;

  if not has_function_privilege(
    'service_role', 'public.get_active_paid_subscription_plan(uuid)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.get_active_paid_subscription_plan(uuid)', 'execute'
  ) or has_function_privilege(
    'anon', 'public.get_active_paid_subscription_plan(uuid)', 'execute'
  ) then
    raise exception 'subscription_security_check_failed: paid_plan_helper_access';
  end if;

  if not has_function_privilege(
    'service_role', 'public.record_ai_usage_if_within_limit(uuid, text)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.record_ai_usage_if_within_limit(uuid, text)', 'execute'
  ) or has_function_privilege(
    'anon', 'public.record_ai_usage_if_within_limit(uuid, text)', 'execute'
  ) then
    raise exception 'subscription_security_check_failed: ai_quota_rpc_access';
  end if;

  if has_table_privilege('authenticated', 'public.image_text_translation_reservations', 'select')
    or has_table_privilege('authenticated', 'public.image_text_translation_reservations', 'insert')
    or has_table_privilege('authenticated', 'public.image_text_translation_reservations', 'update')
    or has_table_privilege('authenticated', 'public.image_text_translation_reservations', 'delete')
    or has_table_privilege('anon', 'public.image_text_translation_reservations', 'select')
    or has_table_privilege('anon', 'public.image_text_translation_reservations', 'insert')
    or has_table_privilege('anon', 'public.image_text_translation_reservations', 'update')
    or has_table_privilege('anon', 'public.image_text_translation_reservations', 'delete') then
    raise exception 'subscription_security_check_failed: image_reservation_table_access';
  end if;

  if not has_function_privilege(
    'service_role', 'public.reserve_image_text_translation(uuid)', 'execute'
  ) or has_function_privilege(
    'authenticated', 'public.reserve_image_text_translation(uuid)', 'execute'
  ) or has_function_privilege(
    'anon', 'public.reserve_image_text_translation(uuid)', 'execute'
  ) then
    raise exception 'subscription_security_check_failed: image_reservation_rpc_access';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger_info
    join pg_proc as function_info on function_info.oid = trigger_info.tgfoid
    where trigger_info.tgrelid = 'public.user_cards'::regclass
      and trigger_info.tgname = 'enforce_user_card_subscription_limits'
      and not trigger_info.tgisinternal
      and position(
        'before insert or update of status on public.user_cards'
        in lower(pg_get_triggerdef(trigger_info.oid))
      ) > 0
      and function_info.prosecdef
      and position(
        'public.get_active_paid_subscription_plan(new.user_id)'
        in lower(pg_get_functiondef(function_info.oid))
      ) > 0
      and position(
        'hashtextextended(new.user_id::text, 0)'
        in lower(pg_get_functiondef(function_info.oid))
      ) > 0
      and position(
        'old.status is distinct from ''active'''
        in lower(pg_get_functiondef(function_info.oid))
      ) > 0
      and position(
        'old.status is distinct from ''learned'''
        in lower(pg_get_functiondef(function_info.oid))
      ) > 0
  ) then
    raise exception 'subscription_security_check_failed: user_card_quota_trigger_incorrect';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
