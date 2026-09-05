-- Multi-gem reward policy.
--
-- The original gem tables stored one gem type per logical reward.  Keep those
-- rows as the idempotency/legacy parent rows, and store the complete result in
-- child rows so existing balances and retries remain intact.

-- Keep this migration safe for projects where the earlier progress-reward
-- migration was not pasted into SQL Editor yet.  The table is idempotent and
-- matches the original schema when that migration has already run.
create table if not exists public.progress_gem_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_key text not null check (char_length(btrim(claim_key)) between 1 and 160),
  source text not null check (source in ('game-level', 'quiz-streak', 'quiz-result')),
  gem_type text check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_key),
  check ((amount = 0 and gem_type is null) or (amount > 0 and gem_type is not null))
);
create index if not exists progress_gem_rewards_user_created_idx
  on public.progress_gem_rewards(user_id, created_at desc);
alter table public.progress_gem_rewards enable row level security;
revoke all on table public.progress_gem_rewards from anon, authenticated;

create table if not exists public.chest_gem_reward_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  claim_key text not null,
  tier text not null check (tier in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby')),
  gem_type text not null check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_key, gem_type),
  foreign key (user_id, claim_key)
    references public.chest_gem_rewards(user_id, claim_key)
    on delete cascade
);

create index if not exists chest_gem_reward_items_user_created_idx
  on public.chest_gem_reward_items(user_id, created_at desc);

alter table public.chest_gem_reward_items enable row level security;
revoke all on table public.chest_gem_reward_items from anon, authenticated;
grant select on table public.chest_gem_reward_items to authenticated;
drop policy if exists chest_gem_reward_items_select_own on public.chest_gem_reward_items;
create policy chest_gem_reward_items_select_own on public.chest_gem_reward_items
  for select to authenticated using ((select auth.uid()) = user_id);

-- Existing rewards have already been credited to profiles.  This only copies
-- their audit shape; it never changes balances or creates a second transaction.
insert into public.chest_gem_reward_items (user_id, claim_key, tier, gem_type, amount, created_at)
select user_id, claim_key, tier, gem_type, amount, created_at
  from public.chest_gem_rewards
on conflict (user_id, claim_key, gem_type) do nothing;

create table if not exists public.progress_gem_reward_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  claim_key text not null,
  source text not null check (source in ('game-level', 'quiz-streak', 'quiz-result')),
  gem_type text not null check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_key, gem_type),
  foreign key (user_id, claim_key)
    references public.progress_gem_rewards(user_id, claim_key)
    on delete cascade
);

create index if not exists progress_gem_reward_items_user_created_idx
  on public.progress_gem_reward_items(user_id, created_at desc);

alter table public.progress_gem_reward_items enable row level security;
revoke all on table public.progress_gem_reward_items from anon, authenticated;
grant select on table public.progress_gem_reward_items to authenticated;
drop policy if exists progress_gem_reward_items_select_own on public.progress_gem_reward_items;
create policy progress_gem_reward_items_select_own on public.progress_gem_reward_items
  for select to authenticated using ((select auth.uid()) = user_id);

insert into public.progress_gem_reward_items (user_id, claim_key, source, gem_type, amount, created_at)
select user_id, claim_key, source, gem_type, amount, created_at
  from public.progress_gem_rewards
 where gem_type is not null and amount > 0
on conflict (user_id, claim_key, gem_type) do nothing;

-- Independent rolls are intentionally monotonic by chest tier.  Each type is
-- rolled separately; if all three rolls miss, the fallback roll guarantees a
-- non-empty chest reward.  Amount ranges are blue / green / purple.
drop function if exists public.award_chest_gem_rewards(uuid, text, text);
create function public.award_chest_gem_rewards(
  p_user_id uuid,
  p_claim_key text,
  p_tier text
)
returns table (
  awarded boolean,
  rewards jsonb,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_parent boolean;
  existing_rewards jsonb;
  profile_row public.user_profiles%rowtype;
  selected_type text;
  selected_amount integer;
  blue_amount integer := 0;
  green_amount integer := 0;
  purple_amount integer := 0;
  blue_drop boolean;
  green_drop boolean;
  purple_drop boolean;
  fallback_roll numeric;
  rewards_json jsonb;
begin
  if p_user_id is null or p_claim_key is null or char_length(btrim(p_claim_key)) not between 1 and 160 then
    raise exception 'invalid_gem_claim';
  end if;
  if p_tier not in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby') then
    raise exception 'invalid_chest_tier';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));

  select exists (
    select 1 from public.chest_gem_rewards as parent
     where parent.user_id = p_user_id and parent.claim_key = p_claim_key
  ) into existing_parent;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', item.gem_type, 'amount', item.amount)
      order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
    ), '[]'::jsonb
  ) into existing_rewards
    from public.chest_gem_reward_items as item
   where item.user_id = p_user_id and item.claim_key = p_claim_key;

  -- A pre-migration row is a valid historical single reward.  The backfill
  -- normally makes this branch unnecessary, but it keeps the function safe if
  -- a deployment was interrupted between DDL and backfill.
  if existing_parent then
    if existing_rewards = '[]'::jsonb then
      select jsonb_build_array(jsonb_build_object('type', parent.gem_type, 'amount', parent.amount))
        into existing_rewards
        from public.chest_gem_rewards as parent
       where parent.user_id = p_user_id and parent.claim_key = p_claim_key;
    end if;
    select * into profile_row
      from public.user_profiles as profile
     where profile.user_id = p_user_id
     for update;
    if not found then raise exception 'profile_not_found'; end if;
    return query select false, coalesce(existing_rewards, '[]'::jsonb),
      profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems;
    return;
  end if;

  -- Chest probabilities: blue / green / purple.  No probability decreases as
  -- the chest tier improves.
  blue_drop := random() * 100 < case p_tier
    when 'wood' then 75 when 'iron' then 80 when 'gold' then 84
    when 'diamond' then 88 when 'emerald' then 92 else 96 end;
  green_drop := random() * 100 < case p_tier
    when 'wood' then 20 when 'iron' then 30 when 'gold' then 40
    when 'diamond' then 50 when 'emerald' then 60 else 72 end;
  purple_drop := random() * 100 < case p_tier
    when 'wood' then 5 when 'iron' then 10 when 'gold' then 18
    when 'diamond' then 28 when 'emerald' then 40 else 55 end;

  if not blue_drop and not green_drop and not purple_drop then
    fallback_roll := random() * 100;
    if fallback_roll < 40 then blue_drop := true;
    elsif fallback_roll < 75 then green_drop := true;
    else purple_drop := true;
    end if;
  end if;

  if blue_drop then
    blue_amount := floor(random() * (
      case p_tier when 'wood' then 3 when 'iron' then 3 when 'gold' then 4
      when 'diamond' then 4 when 'emerald' then 5 else 6 end
    ))::integer + case p_tier
      when 'wood' then 1 when 'iron' then 2 when 'gold' then 3
      when 'diamond' then 5 when 'emerald' then 8 else 10 end;
  end if;
  if green_drop then
    green_amount := floor(random() * (
      case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 3
      when 'diamond' then 3 when 'emerald' then 4 else 5 end
    ))::integer + 1;
  end if;
  if purple_drop then
    purple_amount := floor(random() * (
      case p_tier when 'wood' then 1 when 'iron' then 1 when 'gold' then 1
      when 'diamond' then 2 when 'emerald' then 2 else 3 end
    ))::integer + 1;
  end if;

  selected_type := case when blue_drop then 'blue' when green_drop then 'green' else 'purple' end;
  selected_amount := case selected_type when 'blue' then blue_amount when 'green' then green_amount else purple_amount end;

  -- The legacy parent remains the logical claim/idempotency row.  Its values
  -- represent the first item for old readers; the child rows are authoritative.
  insert into public.chest_gem_rewards (user_id, claim_key, tier, gem_type, amount)
  values (p_user_id, p_claim_key, p_tier, selected_type, selected_amount);

  if blue_drop then
    insert into public.chest_gem_reward_items(user_id, claim_key, tier, gem_type, amount)
    values (p_user_id, p_claim_key, p_tier, 'blue', blue_amount);
  end if;
  if green_drop then
    insert into public.chest_gem_reward_items(user_id, claim_key, tier, gem_type, amount)
    values (p_user_id, p_claim_key, p_tier, 'green', green_amount);
  end if;
  if purple_drop then
    insert into public.chest_gem_reward_items(user_id, claim_key, tier, gem_type, amount)
    values (p_user_id, p_claim_key, p_tier, 'purple', purple_amount);
  end if;

  select * into profile_row
    from public.user_profiles as profile
   where profile.user_id = p_user_id
   for update;
  if not found then raise exception 'profile_not_found'; end if;

  update public.user_profiles as profile
     set blue_gems = profile.blue_gems + blue_amount,
         green_gems = profile.green_gems + green_amount,
         purple_gems = profile.purple_gems + purple_amount
   where profile.user_id = p_user_id;

  if blue_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'blue', blue_amount, 'chest:' || p_tier, p_claim_key || ':gem:blue');
  end if;
  if green_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'green', green_amount, 'chest:' || p_tier, p_claim_key || ':gem:green');
  end if;
  if purple_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'purple', purple_amount, 'chest:' || p_tier, p_claim_key || ':gem:purple');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', item.gem_type, 'amount', item.amount)
      order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
    ), '[]'::jsonb
  ) into rewards_json
    from public.chest_gem_reward_items as item
   where item.user_id = p_user_id and item.claim_key = p_claim_key;

  return query select true, rewards_json,
    profile_row.blue_gems + blue_amount,
    profile_row.green_gems + green_amount,
    profile_row.purple_gems + purple_amount;
end;
$$;

drop function if exists public.award_chest_rewards(uuid, text, text, integer);
create function public.award_chest_rewards(
  p_user_id uuid,
  p_claim_key text,
  p_tier text,
  p_points integer
)
returns table (
  awarded boolean,
  points integer,
  rewards jsonb,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  already_exists boolean;
  gem_result record;
begin
  if p_user_id is null or p_claim_key is null or char_length(btrim(p_claim_key)) not between 1 and 160 then raise exception 'invalid_gem_claim'; end if;
  if p_tier not in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby') then raise exception 'invalid_chest_tier'; end if;
  if p_points is null or p_points <= 0 then raise exception 'invalid_points'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));
  select exists (
    select 1 from public.chest_gem_rewards as reward
     where reward.user_id = p_user_id and reward.claim_key = p_claim_key
  ) into already_exists;

  select * into gem_result
    from public.award_chest_gem_rewards(p_user_id, p_claim_key, p_tier);

  if not already_exists then
    update public.user_profiles as profile
       set chest_points = profile.chest_points + p_points
     where profile.user_id = p_user_id;
    if not found then raise exception 'profile_not_found'; end if;
    insert into public.chest_rewards(user_id, tier, points)
    values (p_user_id, p_tier, p_points);
  end if;

  return query select gem_result.awarded, p_points, gem_result.rewards,
    gem_result.blue_gems, gem_result.green_gems, gem_result.purple_gems;
end;
$$;

drop function if exists public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer);
create function public.claim_mission_reward_with_gem_rewards(
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
  gem_rewards jsonb,
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
  gem_result record;
  gem_rewards_result jsonb := '[]'::jsonb;
  blue_gems_result integer;
  green_gems_result integer;
  purple_gems_result integer;
begin
  if p_user_id is null or p_mission_id is null or char_length(btrim(p_mission_id)) = 0 then raise exception 'invalid_user'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_mission_id, 0));

  select * into claim_result
    from public.claim_mission_reward(
      p_user_id, p_mission_id, p_reward_type, p_chest_tier, p_points, p_progress
    );

  if claim_result.claimed and p_reward_type = 'chest' then
    select * into gem_result
      from public.award_chest_gem_rewards(p_user_id, 'mission:' || p_mission_id, p_chest_tier);
    gem_rewards_result := coalesce(gem_result.rewards, '[]'::jsonb);
    blue_gems_result := gem_result.blue_gems;
    green_gems_result := gem_result.green_gems;
    purple_gems_result := gem_result.purple_gems;
  else
    select profile.blue_gems, profile.green_gems, profile.purple_gems
      into blue_gems_result, green_gems_result, purple_gems_result
      from public.user_profiles as profile
     where profile.user_id = p_user_id;
  end if;

  return query select claim_result.claimed,
    claim_result.mission_points,
    claim_result.chest_points,
    gem_rewards_result,
    blue_gems_result,
    green_gems_result,
    purple_gems_result;
end;
$$;

-- Progress rewards use the same independent-roll/fallback model.  The policy
-- values are blue chance / green chance / purple chance; amounts are sampled
-- from the ranges shown in the source tables used to design this migration.
drop function if exists public.award_progress_gem_rewards(uuid, text, text, integer, integer, integer, integer);
create function public.award_progress_gem_rewards(
  p_user_id uuid,
  p_claim_key text,
  p_source text,
  p_level integer,
  p_streak integer,
  p_stars integer,
  p_card_count integer
)
returns table (
  awarded boolean,
  rewards jsonb,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_parent boolean;
  existing_rewards jsonb;
  rewards_json jsonb;
  profile_row public.user_profiles%rowtype;
  blue_drop boolean;
  green_drop boolean;
  purple_drop boolean;
  fallback_roll numeric;
  blue_chance numeric;
  green_chance numeric;
  purple_chance numeric;
  blue_min integer := 1;
  blue_max integer := 1;
  green_min integer := 1;
  green_max integer := 1;
  purple_min integer := 1;
  purple_max integer := 1;
  blue_amount integer := 0;
  green_amount integer := 0;
  purple_amount integer := 0;
  band integer;
  quality integer;
  selected_type text;
  selected_amount integer;
begin
  if p_user_id is null or p_claim_key is null or char_length(btrim(p_claim_key)) not between 1 and 160 then
    raise exception 'invalid_gem_reward';
  end if;
  if p_source not in ('game-level', 'quiz-streak', 'quiz-result') then raise exception 'invalid_gem_source'; end if;
  if p_source = 'game-level' and (p_level is null or p_level not between 1 and 1000) then raise exception 'invalid_game_level'; end if;
  if p_source = 'quiz-streak' and (p_streak is null or p_streak not between 5 and 10000) then raise exception 'invalid_quiz_streak'; end if;
  if p_source = 'quiz-result' and (
    p_stars is null or p_stars not between 1 and 5 or
    p_card_count is null or p_card_count not in (10, 20, 30, 50)
  ) then raise exception 'invalid_quiz_result'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));

  select exists (
    select 1 from public.progress_gem_rewards as parent
     where parent.user_id = p_user_id and parent.claim_key = p_claim_key
  ) into existing_parent;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', item.gem_type, 'amount', item.amount)
      order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
    ), '[]'::jsonb
  ) into existing_rewards
    from public.progress_gem_reward_items as item
   where item.user_id = p_user_id and item.claim_key = p_claim_key;

  if existing_parent then
    if existing_rewards = '[]'::jsonb then
      select case when parent.gem_type is null then '[]'::jsonb
                  else jsonb_build_array(jsonb_build_object('type', parent.gem_type, 'amount', parent.amount)) end
        into existing_rewards
        from public.progress_gem_rewards as parent
       where parent.user_id = p_user_id and parent.claim_key = p_claim_key;
    end if;
    select * into profile_row from public.user_profiles as profile where profile.user_id = p_user_id for update;
    if not found then raise exception 'profile_not_found'; end if;
    return query select false, coalesce(existing_rewards, '[]'::jsonb), profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems;
    return;
  end if;

  if p_source = 'game-level' then
    band := case when p_level < 5 then 0 when p_level < 10 then 1 when p_level < 20 then 2 else 3 end;
    blue_chance := case band when 0 then 25 when 1 then 34 when 2 then 43 else 51 end;
    green_chance := case band when 0 then 8 when 1 then 12 when 2 then 17 else 23 end;
    purple_chance := case band when 0 then 3 when 1 then 4 when 2 then 6 else 9 end;
    blue_min := 1; blue_max := case band when 0 then 2 else 3 end;
    green_min := 1; green_max := case band when 0 then 1 when 1 then 2 else 3 end;
    purple_min := 1; purple_max := case when band < 2 then 1 else 2 end;
  elsif p_source = 'quiz-streak' then
    band := case when p_streak < 10 then 0 when p_streak < 15 then 1 when p_streak < 20 then 2
                 when p_streak < 25 then 3 when p_streak < 30 then 4 when p_streak < 35 then 5
                 when p_streak < 40 then 6 when p_streak < 45 then 7 else 8 end;
    blue_chance := case band when 0 then 38 when 1 then 43 when 2 then 48 when 3 then 52 when 4 then 56 when 5 then 60 when 6 then 64 when 7 then 68 else 72 end;
    green_chance := case band when 0 then 8 when 1 then 14 when 2 then 20 when 3 then 24 when 4 then 28 when 5 then 32 when 6 then 36 when 7 then 40 else 44 end;
    purple_chance := case band when 0 then 2 when 1 then 4 when 2 then 7 when 3 then 10 when 4 then 13 when 5 then 16 when 6 then 19 when 7 then 22 else 25 end;
    blue_min := case when band < 3 then 1 else case when band < 8 then 2 else 3 end end;
    blue_max := case when band = 0 then 2 when band < 5 then 3 when band < 8 then 5 else 6 end;
    green_min := case when band < 3 then 1 else case when band < 8 then 2 else 3 end end;
    green_max := case when band = 0 then 1 when band < 2 then 2 when band < 5 then 3 when band < 8 then 4 else 5 end;
    purple_min := case when band = 8 then 2 else 1 end;
    purple_max := case when band < 2 then 1 when band < 5 then 2 when band < 8 then 3 else 4 end;
  else
    quality := p_stars + p_card_count / 10;
    blue_chance := case quality when 2 then 25 when 3 then 30 when 4 then 35 when 5 then 40 when 6 then 45 when 7 then 52 when 8 then 60 when 9 then 68 else 76 end;
    green_chance := case quality when 2 then 6 when 3 then 8 when 4 then 10 when 5 then 13 when 6 then 17 when 7 then 22 when 8 then 28 when 9 then 35 else 43 end;
    purple_chance := case quality when 2 then 2 when 3 then 3 when 4 then 5 when 5 then 7 when 6 then 9 when 7 then 12 when 8 then 16 when 9 then 22 else 28 end;
    blue_max := case when quality <= 3 then 2 when quality <= 6 then 3 when quality <= 9 then 4 else 5 end;
    green_max := case when quality <= 3 then 1 when quality <= 5 then 2 when quality <= 7 then 3 when quality = 8 then 4 else 5 end;
    purple_max := case when quality <= 5 then 1 when quality <= 7 then 2 when quality <= 9 then 3 else 4 end;
  end if;

  blue_drop := random() * 100 < blue_chance;
  green_drop := random() * 100 < green_chance;
  purple_drop := random() * 100 < purple_chance;
  if not blue_drop and not green_drop and not purple_drop then
    fallback_roll := random() * 100;
    if fallback_roll < 40 then blue_drop := true;
    elsif fallback_roll < 75 then green_drop := true;
    else purple_drop := true;
    end if;
  end if;

  if blue_drop then blue_amount := floor(random() * (blue_max - blue_min + 1))::integer + blue_min; end if;
  if green_drop then green_amount := floor(random() * (green_max - green_min + 1))::integer + green_min; end if;
  if purple_drop then purple_amount := floor(random() * (purple_max - purple_min + 1))::integer + purple_min; end if;
  selected_type := case when blue_drop then 'blue' when green_drop then 'green' else 'purple' end;
  selected_amount := case selected_type when 'blue' then blue_amount when 'green' then green_amount else purple_amount end;

  insert into public.progress_gem_rewards(user_id, claim_key, source, gem_type, amount)
  values (p_user_id, p_claim_key, p_source, selected_type, selected_amount);
  if blue_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, p_claim_key, p_source, 'blue', blue_amount);
  end if;
  if green_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, p_claim_key, p_source, 'green', green_amount);
  end if;
  if purple_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, p_claim_key, p_source, 'purple', purple_amount);
  end if;

  select * into profile_row from public.user_profiles as profile where profile.user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  update public.user_profiles as profile
     set blue_gems = profile.blue_gems + blue_amount,
         green_gems = profile.green_gems + green_amount,
         purple_gems = profile.purple_gems + purple_amount
   where profile.user_id = p_user_id;
  if blue_amount > 0 then insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key) values (p_user_id, 'blue', blue_amount, p_source, p_claim_key || ':gem:blue'); end if;
  if green_amount > 0 then insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key) values (p_user_id, 'green', green_amount, p_source, p_claim_key || ':gem:green'); end if;
  if purple_amount > 0 then insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key) values (p_user_id, 'purple', purple_amount, p_source, p_claim_key || ':gem:purple'); end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', item.gem_type, 'amount', item.amount)
      order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
    ), '[]'::jsonb
  ) into rewards_json
    from public.progress_gem_reward_items as item
   where item.user_id = p_user_id and item.claim_key = p_claim_key;
  return query select true, rewards_json,
    profile_row.blue_gems + blue_amount,
    profile_row.green_gems + green_amount,
    profile_row.purple_gems + purple_amount;
end;
$$;

revoke all on function public.award_chest_gem_rewards(uuid, text, text),
  public.award_chest_rewards(uuid, text, text, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer),
  public.award_progress_gem_rewards(uuid, text, text, integer, integer, integer, integer)
  from public, authenticated;
grant execute on function public.award_chest_gem_rewards(uuid, text, text),
  public.award_chest_rewards(uuid, text, text, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer),
  public.award_progress_gem_rewards(uuid, text, text, integer, integer, integer, integer)
  to service_role;
