-- Subscription entitlements are server-owned. Payment tokens, webhook state,
-- and checkout reservations must never be writable or readable by browser clients.

alter table public.user_subscriptions
  add column if not exists lemon_squeezy_updated_at timestamptz;

drop policy if exists "Users read own subscription" on public.user_subscriptions;
revoke all on table public.user_subscriptions from anon, authenticated;
grant all on table public.user_subscriptions to service_role;

create table if not exists public.google_play_purchase_tokens (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id text not null,
  order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_play_purchase_tokens_user_idx
  on public.google_play_purchase_tokens(user_id);

alter table public.google_play_purchase_tokens enable row level security;
revoke all on table public.google_play_purchase_tokens from anon, authenticated;
grant all on table public.google_play_purchase_tokens to service_role;

-- Preserve ownership of purchases that were recorded before this hardening.
insert into public.google_play_purchase_tokens (purchase_token, user_id, subscription_id, order_id)
select
  google_play_purchase_token,
  user_id,
  coalesce(google_play_subscription_id, 'unknown'),
  google_play_order_id
from public.user_subscriptions
where provider = 'google_play'
  and google_play_purchase_token is not null
on conflict (purchase_token) do nothing;

create table if not exists public.google_play_rtdn_events (
  message_id text primary key,
  payload jsonb not null,
  user_id uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_play_rtdn_events_user_created_idx
  on public.google_play_rtdn_events(user_id, created_at desc);

alter table public.google_play_rtdn_events enable row level security;
revoke all on table public.google_play_rtdn_events from anon, authenticated;
grant all on table public.google_play_rtdn_events to service_role;

create table if not exists public.lemon_checkout_reservations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reservation_id uuid not null default gen_random_uuid(),
  variant_id text not null,
  checkout_url text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lemon_checkout_reservations enable row level security;
revoke all on table public.lemon_checkout_reservations from anon, authenticated;
grant all on table public.lemon_checkout_reservations to service_role;

-- Serialises checkout creation per user. A second tab can reuse a finished
-- reservation but cannot create a second payable checkout.
create or replace function public.reserve_lemon_checkout(
  p_user_id uuid,
  p_variant_id text
)
returns table (
  reservation_id uuid,
  checkout_url text,
  should_create boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.lemon_checkout_reservations%rowtype;
  next_reservation_id uuid;
begin
  if p_user_id is null or p_variant_id is null or btrim(p_variant_id) = '' then
    raise exception 'invalid_checkout_reservation';
  end if;

  insert into public.user_subscriptions (user_id, plan, status)
  values (p_user_id, 'free', 'free')
  on conflict (user_id) do nothing;

  perform 1
  from public.user_subscriptions
  where user_id = p_user_id
  for update;

  select *
  into existing
  from public.lemon_checkout_reservations
  where user_id = p_user_id;

  if found and existing.expires_at > now() and existing.variant_id = p_variant_id then
    return query select existing.reservation_id, existing.checkout_url, false;
    return;
  end if;

  next_reservation_id := gen_random_uuid();

  insert into public.lemon_checkout_reservations (
    user_id,
    reservation_id,
    variant_id,
    checkout_url,
    expires_at,
    updated_at
  )
  values (
    p_user_id,
    next_reservation_id,
    p_variant_id,
    null,
    now() + interval '20 minutes',
    now()
  )
  on conflict (user_id) do update
  set reservation_id = excluded.reservation_id,
      variant_id = excluded.variant_id,
      checkout_url = null,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at;

  return query select next_reservation_id, null::text, true;
end;
$$;

create or replace function public.complete_lemon_checkout_reservation(
  p_user_id uuid,
  p_reservation_id uuid,
  p_checkout_url text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  stored_url text;
begin
  if p_user_id is null or p_reservation_id is null or p_checkout_url is null or btrim(p_checkout_url) = '' then
    raise exception 'invalid_checkout_reservation';
  end if;

  update public.lemon_checkout_reservations
  set checkout_url = p_checkout_url,
      expires_at = now() + interval '30 minutes',
      updated_at = now()
  where user_id = p_user_id
    and reservation_id = p_reservation_id
    and expires_at > now()
  returning checkout_url into stored_url;

  if stored_url is null then
    raise exception 'checkout_reservation_not_found';
  end if;

  return stored_url;
end;
$$;

create or replace function public.clear_lemon_checkout_reservation(
  p_user_id uuid,
  p_reservation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.lemon_checkout_reservations
  where user_id = p_user_id
    and reservation_id = p_reservation_id;
end;
$$;

revoke all on function public.reserve_lemon_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_lemon_checkout_reservation(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.clear_lemon_checkout_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_lemon_checkout(uuid, text) to service_role;
grant execute on function public.complete_lemon_checkout_reservation(uuid, uuid, text) to service_role;
grant execute on function public.clear_lemon_checkout_reservation(uuid, uuid) to service_role;

-- Lemon can retry and deliver events out of order. The provider timestamp is
-- the ordering key, and an active Google entitlement must not be overwritten.
create or replace function public.apply_lemon_subscription_update(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_customer_id text,
  p_subscription_id text,
  p_variant_id text,
  p_product_id text,
  p_customer_portal_url text,
  p_renews_at timestamptz,
  p_ends_at timestamptz,
  p_updated_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_provider text;
  current_status text;
  current_ends_at timestamptz;
  current_updated_at timestamptz;
  incoming_updated_at timestamptz := coalesce(p_updated_at, now());
begin
  if p_user_id is null
    or p_plan not in ('basic', 'pro')
    or p_status not in ('free', 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired') then
    raise exception 'invalid_lemon_subscription_update';
  end if;

  insert into public.user_subscriptions (user_id, plan, status)
  values (p_user_id, 'free', 'free')
  on conflict (user_id) do nothing;

  select provider, status, ends_at, lemon_squeezy_updated_at
  into current_provider, current_status, current_ends_at, current_updated_at
  from public.user_subscriptions
  where user_id = p_user_id
  for update;

  if current_provider = 'google_play'
    and (
      (current_status in ('active', 'on_trial', 'past_due') and (current_ends_at is null or current_ends_at > now()))
      or (current_status = 'cancelled' and current_ends_at > now())
    ) then
    return false;
  end if;

  if current_provider = 'lemon_squeezy'
    and current_updated_at is not null
    and incoming_updated_at <= current_updated_at then
    return false;
  end if;

  update public.user_subscriptions
  set plan = p_plan,
      status = p_status,
      provider = 'lemon_squeezy',
      lemon_squeezy_customer_id = p_customer_id,
      lemon_squeezy_subscription_id = p_subscription_id,
      lemon_squeezy_variant_id = p_variant_id,
      lemon_squeezy_product_id = p_product_id,
      customer_portal_url = p_customer_portal_url,
      renews_at = p_renews_at,
      ends_at = p_ends_at,
      lemon_squeezy_updated_at = incoming_updated_at,
      updated_at = now()
  where user_id = p_user_id;

  delete from public.lemon_checkout_reservations where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.apply_lemon_subscription_update(uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.apply_lemon_subscription_update(uuid, text, text, text, text, text, text, text, timestamptz, timestamptz, timestamptz) to service_role;

-- AI quota writes are server-only and serialised per user. This prevents both
-- cross-account quota tampering and parallel requests exceeding a quota.
create or replace function public.record_ai_usage_if_within_limit(
  p_user_id uuid,
  p_event_type text,
  p_plan text,
  p_daily_limit integer,
  p_monthly_limit integer
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

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

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

  case effective_plan
    when 'pro' then
      daily_limit := 150;
      monthly_limit := 4500;
    when 'basic' then
      daily_limit := 30;
      monthly_limit := 900;
    else
      daily_limit := 10;
      monthly_limit := 200;
  end case;

  select count(*) into daily_count
  from public.ai_usage_events
  where user_id = p_user_id
    and created_at >= date_trunc('day', now() at time zone 'utc');

  select count(*) into monthly_count
  from public.ai_usage_events
  where user_id = p_user_id
    and created_at >= date_trunc('month', now() at time zone 'utc');

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

drop policy if exists "Users read own AI usage" on public.ai_usage_events;
drop policy if exists "Users insert own AI usage" on public.ai_usage_events;
revoke all on table public.ai_usage_events from anon, authenticated;
grant all on table public.ai_usage_events to service_role;
revoke all on function public.record_ai_usage_if_within_limit(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.record_ai_usage_if_within_limit(uuid, text, text, integer, integer) to service_role;

-- Enforce free card limits at the database boundary as well as in the UI. The
-- advisory lock makes concurrent card additions and learn transitions safe.
create or replace function public.enforce_user_card_subscription_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_plan text;
  subscription_status text;
  subscription_ends_at timestamptz;
  effective_plan text := 'free';
  active_count integer;
  learned_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 1));

  select plan, status, ends_at
  into subscription_plan, subscription_status, subscription_ends_at
  from public.user_subscriptions
  where user_id = new.user_id;

  if subscription_plan in ('basic', 'pro')
    and (
      (subscription_status in ('active', 'on_trial', 'past_due') and (subscription_ends_at is null or subscription_ends_at > now()))
      or (subscription_status = 'cancelled' and subscription_ends_at > now())
    ) then
    effective_plan := subscription_plan;
  end if;

  if effective_plan <> 'free' then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'active' then
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

    if learned_count >= 50 then
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
