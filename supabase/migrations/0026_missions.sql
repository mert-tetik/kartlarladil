create extension if not exists pgcrypto;

-- Mutable counter for points earned from claiming mission rewards.
alter table public.user_profiles
  add column if not exists mission_points integer not null default 0
  check (mission_points >= 0);

-- Per-user mission progress and claim state.
create table if not exists public.user_missions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null,
  progress integer not null default 0 check (progress >= 0),
  status text not null check (status in ('locked', 'waiting', 'claimed')),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create index if not exists user_missions_user_status_idx
  on public.user_missions(user_id, status);

-- Audit/log of every mission reward claim.
create table if not exists public.mission_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id text not null,
  reward_type text not null check (reward_type in ('chest', 'points')),
  chest_tier text check (chest_tier in ('wood', 'iron', 'bronze', 'silver', 'gold', 'diamond', 'legendary')),
  points integer not null check (points >= 0),
  created_at timestamptz not null default now()
);

create index if not exists mission_rewards_user_created_idx
  on public.mission_rewards(user_id, created_at desc);

-- Atomic increment used by the mission claim server action.
create or replace function increment_mission_points(p_user_id uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
  set mission_points = mission_points + p_points
  where user_id = p_user_id;
$$;

-- RLS for user_missions
alter table public.user_missions enable row level security;

create policy if not exists user_missions_select_own
  on public.user_missions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy if not exists user_missions_insert_own
  on public.user_missions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy if not exists user_missions_update_own
  on public.user_missions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS for mission_rewards (read-only audit for the owner)
alter table public.mission_rewards enable row level security;

create policy if not exists mission_rewards_select_own
  on public.mission_rewards
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy if not exists mission_rewards_insert_own
  on public.mission_rewards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_missions to authenticated;
grant select, insert on public.mission_rewards to authenticated;
grant execute on function increment_mission_points(uuid, integer) to authenticated;
