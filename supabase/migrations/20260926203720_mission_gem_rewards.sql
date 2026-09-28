-- Persist direct mission gem grants in the same audit stream as point/chest claims.
alter table public.mission_rewards
  add column if not exists gem_type text,
  add column if not exists gem_amount integer;

alter table public.mission_rewards
  drop constraint if exists mission_rewards_reward_type_check,
  drop constraint if exists mission_rewards_reward_fields_check;

alter table public.mission_rewards
  add constraint mission_rewards_reward_type_check
    check (reward_type in ('chest', 'points', 'gems')),
  add constraint mission_rewards_reward_fields_check
    check (
      (reward_type = 'points'
        and chest_tier is null and gem_type is null and gem_amount is null and points > 0)
      or
      (reward_type = 'chest'
        and chest_tier is not null and gem_type is null and gem_amount is null and points > 0)
      or
      (reward_type = 'gems'
        and chest_tier is null and gem_type is not null
        and gem_type in ('blue', 'green', 'purple')
        and gem_amount is not null and gem_amount > 0 and points > 0)
    );

-- Direct gem mission claims share the same mission lock/idempotency rules as
-- point and chest claims, while crediting the user's gem balance atomically.
create or replace function public.claim_mission_gem_reward(
  p_user_id uuid,
  p_mission_id text,
  p_gem_type text,
  p_gem_amount integer,
  p_point_equivalent integer,
  p_progress integer
)
returns table (
  claimed boolean,
  mission_points integer,
  chest_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_status text;
  has_reward_history boolean;
  profile_mission_points integer;
  profile_chest_points integer;
begin
  if p_user_id is null or p_mission_id is null or btrim(p_mission_id) = '' then
    raise exception 'invalid_mission';
  end if;
  if p_gem_type is null or p_gem_type not in ('blue', 'green', 'purple') then
    raise exception 'invalid_gem_type';
  end if;
  if p_gem_amount is null or p_gem_amount <= 0 or p_point_equivalent is null or p_point_equivalent <= 0 then
    raise exception 'invalid_gem_reward';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_mission_id, 0));

  insert into public.user_missions (user_id, mission_id, progress, status)
  values (p_user_id, p_mission_id, greatest(coalesce(p_progress, 0), 0), 'waiting')
  on conflict (user_id, mission_id) do nothing;

  select mission.status
    into existing_status
    from public.user_missions as mission
   where mission.user_id = p_user_id
     and mission.mission_id = p_mission_id
   for update;

  if existing_status = 'claimed' then
    select profile.mission_points, profile.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles as profile
     where profile.user_id = p_user_id;
    return query select false, coalesce(profile_mission_points, 0), coalesce(profile_chest_points, 0);
    return;
  end if;

  select exists (
    select 1
      from public.mission_rewards as reward
     where reward.user_id = p_user_id
       and reward.mission_id = p_mission_id
  ) into has_reward_history;

  if has_reward_history then
    update public.user_missions as mission
       set progress = greatest(mission.progress, coalesce(p_progress, 0)),
           status = 'claimed',
           claimed_at = coalesce(mission.claimed_at, now()),
           updated_at = now()
     where mission.user_id = p_user_id
       and mission.mission_id = p_mission_id;
    select profile.mission_points, profile.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles as profile
     where profile.user_id = p_user_id;
    return query select false, coalesce(profile_mission_points, 0), coalesce(profile_chest_points, 0);
    return;
  end if;

  update public.user_missions as mission
     set progress = greatest(mission.progress, coalesce(p_progress, 0)),
         status = 'claimed',
         claimed_at = now(),
         updated_at = now()
   where mission.user_id = p_user_id
     and mission.mission_id = p_mission_id;

  insert into public.gem_transactions (user_id, gem_type, amount, reason, idempotency_key)
  values (p_user_id, p_gem_type, p_gem_amount, 'mission:' || p_mission_id, 'mission:' || p_mission_id)
  on conflict (user_id, idempotency_key) do nothing;
  if not found then
    update public.user_missions as mission
       set status = 'claimed',
           claimed_at = coalesce(mission.claimed_at, now()),
           updated_at = now()
     where mission.user_id = p_user_id and mission.mission_id = p_mission_id;
    select profile.mission_points, profile.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles as profile where profile.user_id = p_user_id;
    return query select false, coalesce(profile_mission_points, 0), coalesce(profile_chest_points, 0);
    return;
  end if;

  update public.user_profiles as profile
     set blue_gems = profile.blue_gems + case when p_gem_type = 'blue' then p_gem_amount else 0 end,
         green_gems = profile.green_gems + case when p_gem_type = 'green' then p_gem_amount else 0 end,
         purple_gems = profile.purple_gems + case when p_gem_type = 'purple' then p_gem_amount else 0 end
   where profile.user_id = p_user_id;
  if not found then
    raise exception 'profile_not_found';
  end if;

  insert into public.mission_rewards (
    user_id, mission_id, reward_type, points, gem_type, gem_amount
  ) values (
    p_user_id, p_mission_id, 'gems', p_point_equivalent, p_gem_type, p_gem_amount
  );

  select profile.mission_points, profile.chest_points
    into profile_mission_points, profile_chest_points
    from public.user_profiles as profile
   where profile.user_id = p_user_id;

  return query select true, coalesce(profile_mission_points, 0), coalesce(profile_chest_points, 0);
end;
$$;

drop function if exists public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer);
create or replace function public.claim_mission_reward_with_gem_rewards(
  p_user_id uuid,
  p_mission_id text,
  p_reward_type text,
  p_chest_tier text,
  p_points integer,
  p_progress integer,
  p_gem_type text,
  p_gem_amount integer
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
  if p_user_id is null or p_mission_id is null or char_length(btrim(p_mission_id)) = 0 then
    raise exception 'invalid_user';
  end if;
  if p_reward_type is null or p_reward_type not in ('points', 'chest', 'gems') then
    raise exception 'invalid_reward_type';
  end if;
  if p_reward_type = 'gems' then
    if p_chest_tier is not null or p_gem_type is null or p_gem_type not in ('blue', 'green', 'purple') or p_gem_amount is null or p_gem_amount <= 0 or p_points is null or p_points <= 0 then
      raise exception 'invalid_gem_reward';
    end if;
  elsif p_gem_type is not null or p_gem_amount is not null then
    raise exception 'unexpected_gem_reward';
  end if;
  if p_reward_type = 'points' and (p_chest_tier is not null or p_points is null or p_points <= 0) then
    raise exception 'invalid_points_reward';
  end if;
  if p_reward_type = 'chest' and (p_chest_tier is null or p_points is null or p_points <= 0) then
    raise exception 'invalid_chest_reward';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_mission_id, 0));

  if p_reward_type = 'gems' then
    select * into claim_result
      from public.claim_mission_gem_reward(
        p_user_id, p_mission_id, p_gem_type, p_gem_amount, p_points, p_progress
      );
    if claim_result.claimed then
      gem_rewards_result := jsonb_build_array(jsonb_build_object('type', p_gem_type, 'amount', p_gem_amount));
    end if;
  else
    select * into claim_result
      from public.claim_mission_reward(
        p_user_id, p_mission_id, p_reward_type, p_chest_tier, p_points, p_progress
      );
  end if;

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

-- Preserve the old RPC signature for point/chest clients while new server code
-- sends the explicit gem arguments to the eight-argument function.
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
language sql
security definer
set search_path = public
as $$
  select * from public.claim_mission_reward_with_gem_rewards(
    p_user_id, p_mission_id, p_reward_type, p_chest_tier, p_points, p_progress, null, null
  );
$$;

revoke all on function public.claim_mission_gem_reward(uuid, text, text, integer, integer, integer)
  from public, authenticated;
grant execute on function public.claim_mission_gem_reward(uuid, text, text, integer, integer, integer)
  to service_role;

revoke all on function public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer, text, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer)
  from public, authenticated;
grant execute on function public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer, text, integer),
  public.claim_mission_reward_with_gem_rewards(uuid, text, text, text, integer, integer)
  to service_role;
