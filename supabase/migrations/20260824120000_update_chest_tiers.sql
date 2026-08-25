-- Replace the retired chest tiers with the current six-tier reward ladder.
-- Preserve existing reward history by mapping the removed names forward.

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
