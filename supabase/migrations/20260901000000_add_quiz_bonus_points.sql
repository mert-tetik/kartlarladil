create extension if not exists pgcrypto;

create table if not exists public.quiz_bonus_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  bonus_id text not null check (char_length(bonus_id) between 1 and 160),
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (user_id, session_id, bonus_id)
);

create index if not exists quiz_bonus_rewards_user_created_idx
  on public.quiz_bonus_rewards(user_id, created_at desc);

alter table public.quiz_bonus_rewards enable row level security;
revoke all on table public.quiz_bonus_rewards from anon, authenticated;

create or replace function public.award_quiz_bonus_points(
  p_user_id uuid,
  p_session_id uuid,
  p_bonus_id text,
  p_points integer
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

  if p_points <= 0 or p_points > 25 then
    raise exception 'invalid_points';
  end if;

  if p_bonus_id !~ ('^' || p_session_id::text || '-(matching|sentence-order|category-sort|imposter)-(0|[1-9]|[1-4][0-9])$') then
    raise exception 'invalid_bonus';
  end if;

  insert into public.quiz_bonus_rewards (user_id, session_id, bonus_id, points)
  values (p_user_id, p_session_id, p_bonus_id, p_points)
  on conflict (user_id, session_id, bonus_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set quiz_result_points = quiz_result_points + p_points
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.award_quiz_bonus_points(uuid, uuid, text, integer) from public;
grant execute on function public.award_quiz_bonus_points(uuid, uuid, text, integer) to authenticated;
