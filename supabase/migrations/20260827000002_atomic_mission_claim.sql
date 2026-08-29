-- Make mission rewards idempotent and atomic.
-- A claim either writes the reward, updates the profile counter, and marks the
-- mission as claimed together, or none of those changes are committed.

alter table public.chest_rewards
  drop constraint if exists chest_rewards_tier_check;

alter table public.mission_rewards
  drop constraint if exists mission_rewards_chest_tier_check;

update public.chest_rewards
set tier = case tier
  when 'bronze' then 'gold'
  when 'silver' then 'diamond'
  when 'legendary' then 'ruby'
  else tier
end
where tier in ('bronze', 'silver', 'legendary');

update public.mission_rewards
set chest_tier = case chest_tier
  when 'bronze' then 'gold'
  when 'silver' then 'diamond'
  when 'legendary' then 'ruby'
  else chest_tier
end
where chest_tier in ('bronze', 'silver', 'legendary');

alter table public.chest_rewards
  add constraint chest_rewards_tier_check
  check (tier in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby'));

alter table public.mission_rewards
  add constraint mission_rewards_chest_tier_check
  check (chest_tier in ('wood', 'iron', 'gold', 'diamond', 'emerald', 'ruby'));

alter table public.chest_rewards enable row level security;
grant select, insert on public.chest_rewards to authenticated;

drop policy if exists chest_rewards_select_own on public.chest_rewards;
create policy chest_rewards_select_own
  on public.chest_rewards
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists chest_rewards_insert_own on public.chest_rewards;
create policy chest_rewards_insert_own
  on public.chest_rewards
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

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

  -- Insert the row if this mission has not been persisted yet, then lock it.
  -- Concurrent claims for the same user and mission serialize on this row.
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

  select status
    into existing_status
    from public.user_missions
   where user_id = p_user_id
     and mission_id = p_mission_id
   for update;

  if existing_status = 'claimed' then
    select up.mission_points, up.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles up
     where up.user_id = p_user_id;

    return query select
      false,
      coalesce(profile_mission_points, 0),
      coalesce(profile_chest_points, 0);
    return;
  end if;

  -- Older non-atomic attempts could have written the audit row and profile
  -- points before failing to persist the mission status. Do not pay those
  -- missions a second time; settle the claim instead.
  select exists (
    select 1
      from public.mission_rewards mr
     where mr.user_id = p_user_id
       and mr.mission_id = p_mission_id
  )
    into has_reward_history;

  if has_reward_history then
    update public.user_missions
       set progress = greatest(progress, coalesce(p_progress, 0)),
           status = 'claimed',
           claimed_at = coalesce(claimed_at, now()),
           updated_at = now()
     where user_id = p_user_id
       and mission_id = p_mission_id;

    select up.mission_points, up.chest_points
      into profile_mission_points, profile_chest_points
      from public.user_profiles up
     where up.user_id = p_user_id;

    return query select
      true,
      coalesce(profile_mission_points, 0),
      coalesce(profile_chest_points, 0);
    return;
  end if;

  -- The status update and all reward writes are in this same transaction.
  update public.user_missions
     set progress = greatest(progress, coalesce(p_progress, 0)),
         status = 'claimed',
         claimed_at = now(),
         updated_at = now()
   where user_id = p_user_id
     and mission_id = p_mission_id;

  if p_reward_type = 'points' then
    update public.user_profiles
       set mission_points = mission_points + p_points
     where user_id = p_user_id;

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
    update public.user_profiles
       set chest_points = chest_points + p_points
     where user_id = p_user_id;

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
    from public.user_profiles up
   where up.user_id = p_user_id;

  return query select
    true,
    coalesce(profile_mission_points, 0),
    coalesce(profile_chest_points, 0);
end;
$$;

revoke all on function public.claim_mission_reward(uuid, text, text, text, integer, integer) from public;
grant execute on function public.claim_mission_reward(uuid, text, text, text, integer, integer) to service_role;
