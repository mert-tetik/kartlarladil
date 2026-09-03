-- Prevent legacy mission reward history from being treated as a fresh
-- gem-eligible claim. The original atomic claim function intentionally
-- returns claimed=true while repairing an old inconsistent mission row;
-- the gem wrapper must distinguish that repair from a new claim.
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
  had_reward_history boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_mission_id, 0));

  -- Read this before the legacy claim function runs. That function repairs
  -- old rows with mission_rewards history and returns claimed=true for
  -- compatibility, but no new reward should be produced in that case.
  select exists (
    select 1
      from public.mission_rewards mr
     where mr.user_id = p_user_id
       and mr.mission_id = p_mission_id
  )
    into had_reward_history;

  select * into claim_result
    from public.claim_mission_reward(
      p_user_id,
      p_mission_id,
      p_reward_type,
      p_chest_tier,
      p_points,
      p_progress
    );

  if claim_result.claimed and not had_reward_history and p_reward_type = 'chest' then
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
    (claim_result.claimed and not had_reward_history),
    claim_result.mission_points,
    claim_result.chest_points,
    gem_type_result,
    gem_amount_result,
    blue_gems_result,
    green_gems_result,
    purple_gems_result;
end;
$$;

revoke all on function public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer)
  from public, authenticated;
grant execute on function public.claim_mission_reward_with_gems(uuid, text, text, text, integer, integer)
  to service_role;
