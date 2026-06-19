create extension if not exists pgcrypto;

-- Mutable counter for points earned from opening quiz reward chests.
alter table public.user_profiles
  add column if not exists chest_points integer not null default 0
  check (chest_points >= 0);

-- Audit/log of every chest opening.
create table if not exists public.chest_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('wood', 'iron', 'bronze', 'silver', 'gold', 'diamond', 'legendary')),
  points integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists chest_rewards_user_created_idx
  on public.chest_rewards(user_id, created_at desc);

-- Atomic increment used by the chest award server action.
create or replace function increment_chest_points(p_user_id uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
  set chest_points = chest_points + p_points
  where user_id = p_user_id;
$$;

grant select, insert on public.chest_rewards to authenticated;
grant execute on function increment_chest_points(uuid, integer) to authenticated;
