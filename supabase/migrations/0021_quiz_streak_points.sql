create extension if not exists pgcrypto;

alter table public.user_profiles
  add column if not exists streak_points integer not null default 0
  check (streak_points >= 0);

create table if not exists public.quiz_streak_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique,
  streak integer not null check (streak > 0 and mod(streak, 5) = 0),
  points integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create index if not exists quiz_streak_rewards_user_created_idx
  on public.quiz_streak_rewards(user_id, created_at desc);

create or replace function award_quiz_streak_points(
  p_user_id uuid,
  p_session_id uuid,
  p_streak integer,
  p_points integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quiz_streak_rewards (user_id, session_id, streak, points)
  values (p_user_id, p_session_id, p_streak, p_points)
  on conflict (session_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set streak_points = streak_points + p_points
  where user_id = p_user_id;

  return true;
end;
$$;

grant select, insert on public.quiz_streak_rewards to authenticated;
grant execute on function award_quiz_streak_points(uuid, uuid, integer, integer) to authenticated;
