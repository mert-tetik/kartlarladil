-- Fix mission reward claims failing with PostgreSQL 42702.
--
-- The return columns of claim_mission_reward (mission_points and
-- chest_points) are PL/pgSQL variables.  The old function used unqualified
-- column names on the right side of UPDATE assignments, so PostgreSQL could
-- not tell the output variable from public.user_profiles' column.  Mission
-- claims therefore failed before the reward was written.

create or replace function public.claim_mission_reward(
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
  chest_points integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_status text;
  has_reward_history boolean;
  profile_mission_points integer;
  profile_chest_points integer;
begin
  if p_mission_id is null or btrim(p_mission_id) = '' then
    raise exception 'invalid_mission';
  end if;

  if p_reward_type not in ('points', 'chest') then
    raise exception 'invalid_reward_type';
  end if;

  if p_points is null or p_points <= 0 then
    raise exception 'invalid_reward_points';
  end if;

  if p_reward_type = 'chest'
    and p_chest_tier not in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby') then
    raise exception 'invalid_chest_tier';
  end if;

  insert into public.user_missions (
    user_id,
    mission_id,
    progress,
    status
  )
  values (
    p_user_id,
    p_mission_id,
    greatest(coalesce(p_progress, 0), 0),
    'waiting'
  )
  on conflict (user_id, mission_id) do nothing;

  select um.status
    into existing_status
    from public.user_missions as um
   where um.user_id = p_user_id
     and um.mission_id = p_mission_id
   for update;

  if existing_status = 'claimed' then
    select up.mission_points, up.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles as up
     where up.user_id = p_user_id;

    return query select
      false,
      coalesce(profile_mission_points, 0),
      coalesce(profile_chest_points, 0);
    return;
  end if;

  select exists (
    select 1
      from public.mission_rewards as mr
     where mr.user_id = p_user_id
       and mr.mission_id = p_mission_id
  )
    into has_reward_history;

  if has_reward_history then
    update public.user_missions as um
       set progress = greatest(um.progress, coalesce(p_progress, 0)),
           status = 'claimed',
           claimed_at = coalesce(um.claimed_at, now()),
           updated_at = now()
     where um.user_id = p_user_id
       and um.mission_id = p_mission_id;

    select up.mission_points, up.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles as up
     where up.user_id = p_user_id;

    return query select
      true,
      coalesce(profile_mission_points, 0),
      coalesce(profile_chest_points, 0);
    return;
  end if;

  update public.user_missions as um
     set progress = greatest(um.progress, coalesce(p_progress, 0)),
         status = 'claimed',
         claimed_at = now(),
         updated_at = now()
   where um.user_id = p_user_id
     and um.mission_id = p_mission_id;

  if p_reward_type = 'points' then
    update public.user_profiles as up
       set mission_points = up.mission_points + p_points
     where up.user_id = p_user_id;

    if not found then
      raise exception 'profile_not_found';
    end if;

    insert into public.mission_rewards (
      user_id,
      mission_id,
      reward_type,
      points
    )
    values (
      p_user_id,
      p_mission_id,
      'points',
      p_points
    );
  else
    update public.user_profiles as up
       set chest_points = up.chest_points + p_points
     where up.user_id = p_user_id;

    if not found then
      raise exception 'profile_not_found';
    end if;

    insert into public.chest_rewards (
      user_id,
      tier,
      points
    )
    values (
      p_user_id,
      p_chest_tier,
      p_points
    );

    insert into public.mission_rewards (
      user_id,
      mission_id,
      reward_type,
      chest_tier,
      points
    )
    values (
      p_user_id,
      p_mission_id,
      'chest',
      p_chest_tier,
      p_points
    );
  end if;

  select up.mission_points, up.chest_points
    into profile_mission_points, profile_chest_points
    from public.user_profiles as up
   where up.user_id = p_user_id;

  return query select
    true,
    coalesce(profile_mission_points, 0),
    coalesce(profile_chest_points, 0);
end;
$$;

-- Mission chest claims call this function after the core mission transaction.
-- Its return columns also overlap with profile column names, so qualify every
-- profile column used by an UPDATE to prevent the same 42702 failure there.
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

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));

  roll := random() * 100;

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
    select cgr.*
      into existing_reward
      from public.chest_gem_rewards as cgr
     where cgr.user_id = p_user_id
       and cgr.claim_key = p_claim_key;

    select up.*
      into profile_row
      from public.user_profiles as up
     where up.user_id = p_user_id
     for update;

    return query select false, existing_reward.gem_type, existing_reward.amount,
      profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems;
    return;
  end if;

  selected_amount := case
    when selected_type = 'blue' then floor(random() * (case p_tier when 'wood' then 3 when 'iron' then 3 when 'gold' then 4 when 'diamond' then 4 when 'emerald' then 5 else 6 end - case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 3 when 'diamond' then 5 when 'emerald' then 8 else 10 end + 1))::integer + case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 3 when 'diamond' then 5 when 'emerald' then 8 else 10 end
    when selected_type = 'green' then floor(random() * (case p_tier when 'wood' then 1 when 'iron' then 2 when 'gold' then 2 when 'diamond' then 3 when 'emerald' then 4 else 5 end))::integer + 1
    else floor(random() * (case p_tier when 'wood' then 1 when 'iron' then 1 when 'gold' then 1 when 'diamond' then 2 when 'emerald' then 2 else 3 end))::integer + 1
  end;

  update public.chest_gem_rewards as cgr
     set amount = selected_amount
   where cgr.user_id = p_user_id
     and cgr.claim_key = p_claim_key;

  select up.*
    into profile_row
    from public.user_profiles as up
   where up.user_id = p_user_id
   for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  update public.user_profiles as up
     set blue_gems = up.blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
         green_gems = up.green_gems + case when selected_type = 'green' then selected_amount else 0 end,
         purple_gems = up.purple_gems + case when selected_type = 'purple' then selected_amount else 0 end
   where up.user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
  values (p_user_id, selected_type, selected_amount, 'chest:' || p_tier, p_claim_key);

  return query select true, selected_type, selected_amount,
    profile_row.blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
    profile_row.green_gems + case when selected_type = 'green' then selected_amount else 0 end,
    profile_row.purple_gems + case when selected_type = 'purple' then selected_amount else 0 end;
end;
$$;

revoke all on function public.claim_mission_reward(uuid, text, text, text, integer, integer) from public, authenticated;
grant execute on function public.claim_mission_reward(uuid, text, text, text, integer, integer) to service_role;

revoke all on function public.award_chest_gem_reward(uuid, text, text) from public, authenticated;
grant execute on function public.award_chest_gem_reward(uuid, text, text) to service_role;
