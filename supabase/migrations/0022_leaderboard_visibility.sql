alter table public.user_profiles
  add column if not exists leaderboard_visible boolean not null default false;
