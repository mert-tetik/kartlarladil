create extension if not exists pgcrypto;

alter table public.user_profiles
  add column if not exists quiz_result_points integer not null default 0
  check (quiz_result_points >= 0);

create table if not exists public.quiz_result_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique,
  stars integer not null check (stars between 1 and 5),
  points integer not null check (points between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists quiz_result_rewards_user_created_idx
  on public.quiz_result_rewards(user_id, created_at desc);

alter table public.quiz_result_rewards enable row level security;
revoke all on table public.quiz_result_rewards from anon, authenticated;

create or replace function public.award_quiz_result_points(
  p_user_id uuid,
  p_session_id uuid,
  p_stars integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_stars < 1 or p_stars > 5 then
    raise exception 'invalid_stars';
  end if;

  insert into public.quiz_result_rewards (user_id, session_id, stars, points)
  values (p_user_id, p_session_id, p_stars, p_stars)
  on conflict (session_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set quiz_result_points = quiz_result_points + p_stars
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.award_quiz_result_points(uuid, uuid, integer) from public;
grant execute on function public.award_quiz_result_points(uuid, uuid, integer) to authenticated;
