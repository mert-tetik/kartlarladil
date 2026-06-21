alter table public.user_profiles
  drop constraint if exists user_profiles_preferred_tier_check;

alter table public.user_profiles
  add constraint user_profiles_preferred_tier_check
  check (preferred_tier in ('A1', 'A2', 'B1', 'B2', 'C1', 'all'));
