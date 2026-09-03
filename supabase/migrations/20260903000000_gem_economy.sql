create extension if not exists pgcrypto;

-- Gem balances and separately tracked point sources. Existing users start at zero;
-- no historical chest rows are backfilled.
alter table public.user_profiles
  add column if not exists blue_gems integer not null default 0 check (blue_gems >= 0),
  add column if not exists green_gems integer not null default 0 check (green_gems >= 0),
  add column if not exists purple_gems integer not null default 0 check (purple_gems >= 0),
  add column if not exists gem_points integer not null default 0 check (gem_points >= 0),
  add column if not exists game_points integer not null default 0 check (game_points >= 0);

create table if not exists public.gem_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gem_type text not null check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null check (amount <> 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 120),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists gem_transactions_user_created_idx
  on public.gem_transactions(user_id, created_at desc);

create table if not exists public.chest_gem_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_key text not null,
  tier text not null check (tier in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby')),
  gem_type text not null check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_key)
);

create index if not exists chest_gem_rewards_user_created_idx
  on public.chest_gem_rewards(user_id, created_at desc);

alter table public.gem_transactions enable row level security;
alter table public.chest_gem_rewards enable row level security;
revoke all on table public.gem_transactions, public.chest_gem_rewards from anon, authenticated;
grant select on table public.gem_transactions, public.chest_gem_rewards to authenticated;

drop policy if exists gem_transactions_select_own on public.gem_transactions;
create policy gem_transactions_select_own on public.gem_transactions
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists chest_gem_rewards_select_own on public.chest_gem_rewards;
create policy chest_gem_rewards_select_own on public.chest_gem_rewards
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.award_chest_gem_reward(
  p_user_id uuid,
  p_claim_key text,
  p_tier text
)
returns table (
  awarded boolean,
  gem_type text,
  amount integer,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_type text;
  selected_amount integer;
  roll numeric;
  existing_reward public.chest_gem_rewards%rowtype;
  profile_row public.user_profiles%rowtype;
begin
  if p_user_id is null or p_claim_key is null or btrim(p_claim_key) = '' then
    raise exception 'invalid_gem_claim';
  end if;
  if p_tier not in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby') then
    raise exception 'invalid_chest_tier';
  end if;

  -- A claim key represents one logical chest. Serialize retries and concurrent
  -- requests for that chest before checking/inserting its reward row.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));

  roll := random() * 100;

  -- One roll per chest. The row lock plus unique key makes retries safe.
  insert into public.chest_gem_rewards (user_id, claim_key, tier, gem_type, amount)
  values (
    p_user_id,
    p_claim_key,
    p_tier,
    case
      when roll < case p_tier when 'wood' then 75 when 'iron' then 60 when 'gold' then 42 when 'diamond' then 25 when 'emerald' then 12 else 5 end then 'blue'
      when roll < (case p_tier when 'wood' then 95 when 'iron' then 90 when 'gold' then 82 when 'diamond' then 70 when 'emerald' then 55 else 30 end) then 'green'
      else 'purple'
    end,
    1
  )
  on conflict (user_id, claim_key) do nothing
  returning chest_gem_rewards.gem_type, chest_gem_rewards.amount
    into selected_type, selected_amount;

  if not found then
    select * into existing_reward
      from public.chest_gem_rewards
     where user_id = p_user_id and claim_key = p_claim_key;
    select * into profile_row from public.user_profiles where user_id = p_user_id for update;
    return query select false, existing_reward.gem_type, existing_reward.amount,
      profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems;
    return;
  end if;

  -- Amounts are chosen after the type roll so every table range is respected.
  selected_amount := case
    when selected_type = 'blue' then floor(random() * (case p_tier when 'wood' then 3 when 'iron' then 3 when 'gold' then 4 when 'diamond' then 4 when 'emerald' then 5 else 6 end - case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 3 when 'diamond' then 5 when 'emerald' then 8 else 10 end + 1))::integer + case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 3 when 'diamond' then 5 when 'emerald' then 8 else 10 end
    when selected_type = 'green' then floor(random() * (case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 2 when 'diamond' then 3 when 'emerald' then 4 else 5 end - 1 + 1))::integer + 1
    else floor(random() * (case p_tier when 'wood' then 1 when 'iron' then 1 when 'gold' then 1 when 'diamond' then 2 when 'emerald' then 2 else 3 end - 1 + 1))::integer + 1
  end;

  update public.chest_gem_rewards set amount = selected_amount
   where user_id = p_user_id and claim_key = p_claim_key;

  select * into profile_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;

  update public.user_profiles set
    blue_gems = blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
    green_gems = green_gems + case when selected_type = 'green' then selected_amount else 0 end,
    purple_gems = purple_gems + case when selected_type = 'purple' then selected_amount else 0 end
   where user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
  values (p_user_id, selected_type, selected_amount, 'chest:' || p_tier, p_claim_key);

  return query select true, selected_type, selected_amount,
    profile_row.blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
    profile_row.green_gems + case when selected_type = 'green' then selected_amount else 0 end,
    profile_row.purple_gems + case when selected_type = 'purple' then selected_amount else 0 end;
end;
$$;

create or replace function public.convert_gem_to_points(p_user_id uuid, p_gem_type text, p_idempotency_key text)
returns table (success boolean, points integer, blue_gems integer, green_gems integer, purple_gems integer, gem_points integer)
language plpgsql security definer set search_path = public as $$
declare cost integer; balance integer; current_profile public.user_profiles%rowtype;
begin
  if p_gem_type not in ('blue','green','purple') or p_idempotency_key is null then raise exception 'invalid_gem_conversion'; end if;
  cost := case p_gem_type when 'blue' then 1 when 'green' then 5 else 20 end;
  select * into current_profile from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  balance := case p_gem_type when 'blue' then current_profile.blue_gems when 'green' then current_profile.green_gems else current_profile.purple_gems end;
  if balance < 1 then raise exception 'insufficient_gems'; end if;
  update public.user_profiles set
    blue_gems = blue_gems - case when p_gem_type = 'blue' then 1 else 0 end,
    green_gems = green_gems - case when p_gem_type = 'green' then 1 else 0 end,
    purple_gems = purple_gems - case when p_gem_type = 'purple' then 1 else 0 end,
    gem_points = gem_points + cost where user_id = p_user_id;
  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, p_gem_type, -1, 'convert-to-points', p_idempotency_key);
  return query select true, cost, current_profile.blue_gems - case when p_gem_type='blue' then 1 else 0 end,
    current_profile.green_gems - case when p_gem_type='green' then 1 else 0 end,
    current_profile.purple_gems - case when p_gem_type='purple' then 1 else 0 end,
    current_profile.gem_points + cost;
end; $$;

-- Quiz chests use one transaction for the existing point reward and the new
-- gem reward. The gem claim row is the idempotency boundary for both rewards.
create or replace function public.award_chest_reward(p_user_id uuid, p_claim_key text, p_tier text, p_points integer)
returns table (awarded boolean, points integer, gem_type text, amount integer, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare gem_result record; already_exists boolean;
begin
  if p_points is null or p_points <= 0 then raise exception 'invalid_points'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));
  select exists(select 1 from public.chest_gem_rewards where user_id = p_user_id and claim_key = p_claim_key) into already_exists;
  select * into gem_result from public.award_chest_gem_reward(p_user_id, p_claim_key, p_tier);
  if not already_exists then
    update public.user_profiles set chest_points = chest_points + p_points where user_id = p_user_id;
    if not found then raise exception 'profile_not_found'; end if;
    insert into public.chest_rewards(user_id, tier, points) values (p_user_id, p_tier, p_points);
  end if;
  return query select gem_result.awarded, p_points, gem_result.gem_type, gem_result.amount,
    gem_result.blue_gems, gem_result.green_gems, gem_result.purple_gems;
end; $$;

-- Mission claims use the same transaction boundary as quiz chests. Existing
-- claimed missions return claimed=false and therefore never receive a
-- retroactive gem reward.
create or replace function public.claim_mission_reward_with_gems(
  p_user_id uuid,
  p_mission_id text,
  p_reward_type text,
  p_chest_tier text,
  p_points integer,
  p_progress integer
)
returns table (
  claimed boolean,
  mission_points integer,
  chest_points integer,
  gem_type text,
  amount integer,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_result record;
  gem_type_result text;
  gem_amount_result integer;
  blue_gems_result integer;
  green_gems_result integer;
  purple_gems_result integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_mission_id, 0));

  select * into claim_result
    from public.claim_mission_reward(
      p_user_id,
      p_mission_id,
      p_reward_type,
      p_chest_tier,
      p_points,
      p_progress
    );

  if claim_result.claimed and p_reward_type = 'chest' then
    select gem_type, amount, blue_gems, green_gems, purple_gems
      into gem_type_result, gem_amount_result, blue_gems_result, green_gems_result, purple_gems_result
      from public.award_chest_gem_reward(p_user_id, 'mission:' || p_mission_id, p_chest_tier);
  else
    select up.blue_gems, up.green_gems, up.purple_gems
      into blue_gems_result, green_gems_result, purple_gems_result
      from public.user_profiles up
     where up.user_id = p_user_id;
  end if;

  return query select
    claim_result.claimed,
    claim_result.mission_points,
    claim_result.chest_points,
    gem_type_result,
    gem_amount_result,
    blue_gems_result,
    green_gems_result,
    purple_gems_result;
end;
$$;

create or replace function public.spend_gem(p_user_id uuid, p_gem_type text, p_amount integer, p_reason text, p_idempotency_key text)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare current_profile public.user_profiles%rowtype; balance integer;
begin
  if p_gem_type not in ('blue','green','purple') or p_amount <= 0 or p_idempotency_key is null then raise exception 'invalid_gem_spend'; end if;
  select * into current_profile from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  balance := case p_gem_type when 'blue' then current_profile.blue_gems when 'green' then current_profile.green_gems else current_profile.purple_gems end;
  if balance < p_amount then raise exception 'insufficient_gems'; end if;
  update public.user_profiles set blue_gems = blue_gems - case when p_gem_type='blue' then p_amount else 0 end,
    green_gems = green_gems - case when p_gem_type='green' then p_amount else 0 end,
    purple_gems = purple_gems - case when p_gem_type='purple' then p_amount else 0 end where user_id = p_user_id;
  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, p_gem_type, -p_amount, p_reason, p_idempotency_key);
  return query select true, current_profile.blue_gems - case when p_gem_type='blue' then p_amount else 0 end,
    current_profile.green_gems - case when p_gem_type='green' then p_amount else 0 end,
    current_profile.purple_gems - case when p_gem_type='purple' then p_amount else 0 end;
end; $$;

create or replace function public.increment_game_points(p_user_id uuid, p_points integer)
returns integer language plpgsql security definer set search_path = public as $$
declare result integer;
begin
  if p_points is null or p_points <= 0 or p_points > 100000 then raise exception 'invalid_points'; end if;
  update public.user_profiles set game_points = game_points + p_points where user_id = p_user_id returning game_points into result;
  if result is null then raise exception 'profile_not_found'; end if;
  return result;
end; $$;

create or replace function public.spend_gem_and_remove_card(p_user_id uuid, p_source_key text, p_cost integer)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare profile_row public.user_profiles%rowtype;
begin
  if p_source_key is null or btrim(p_source_key) = '' or p_cost <= 0 then raise exception 'invalid_card_removal'; end if;
  select * into profile_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if profile_row.blue_gems < p_cost then raise exception 'insufficient_gems'; end if;
  if not exists (select 1 from public.user_cards where user_id = p_user_id and card_source_key = p_source_key) then raise exception 'card_not_found'; end if;
  delete from public.practice_attempts where user_id = p_user_id and card_source_key = p_source_key;
  delete from public.user_cards where user_id = p_user_id and card_source_key = p_source_key;
  update public.user_profiles set blue_gems = blue_gems - p_cost where user_id = p_user_id;
  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'blue', -p_cost, 'remove-card:' || p_source_key, 'remove-card:' || p_source_key || ':' || gen_random_uuid());
  return query select true, profile_row.blue_gems - p_cost, profile_row.green_gems, profile_row.purple_gems;
end; $$;

create or replace function public.spend_gem_and_mark_card_learned(p_user_id uuid, p_source_key text, p_cost integer)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare profile_row public.user_profiles%rowtype;
begin
  if p_source_key is null or btrim(p_source_key) = '' or p_cost <= 0 then raise exception 'invalid_card_learning'; end if;
  select * into profile_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if profile_row.purple_gems < p_cost then raise exception 'insufficient_gems'; end if;
  update public.user_cards set status = 'learned', learned_at = coalesce(learned_at, now())
   where user_id = p_user_id and card_source_key = p_source_key and status = 'active';
  if not found then raise exception 'card_not_active'; end if;
  update public.user_profiles set purple_gems = purple_gems - p_cost where user_id = p_user_id;
  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'purple', -p_cost, 'mark-learned:' || p_source_key, 'mark-learned:' || p_source_key || ':' || gen_random_uuid());
  return query select true, profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems - p_cost;
end; $$;

revoke all on function public.award_chest_gem_reward(uuid, text, text), public.award_chest_reward(uuid, text, text, integer), public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer), public.convert_gem_to_points(uuid, text, text), public.spend_gem(uuid, text, integer, text, text), public.increment_game_points(uuid, integer), public.spend_gem_and_remove_card(uuid, text, integer), public.spend_gem_and_mark_card_learned(uuid, text, integer) from public, authenticated;
grant execute on function public.award_chest_gem_reward(uuid, text, text), public.award_chest_reward(uuid, text, text, integer), public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer), public.convert_gem_to_points(uuid, text, text), public.spend_gem(uuid, text, integer, text, text), public.increment_game_points(uuid, integer), public.spend_gem_and_remove_card(uuid, text, integer), public.spend_gem_and_mark_card_learned(uuid, text, integer) to service_role;
