create extension if not exists pgcrypto;

-- Fast cached total of AI Practice points earned by a user.
alter table public.user_profiles
  add column if not exists ai_practice_points integer not null default 0
  check (ai_practice_points >= 0);

-- Audit/log of every AI Practice message evaluation.
create table if not exists public.ai_practice_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points integer not null check (points in (0, 5, 10)),
  message_text text not null,
  assistant_text text not null,
  character_id text not null,
  language text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_practice_scores_user_created_idx
  on public.ai_practice_scores(user_id, created_at desc);

-- Atomic increment used by the scoring service.
create or replace function increment_ai_practice_points(p_user_id uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_profiles
  set ai_practice_points = ai_practice_points + p_points
  where user_id = p_user_id;
$$;

grant select, insert on public.ai_practice_scores to authenticated;
grant execute on function increment_ai_practice_points(uuid, integer) to authenticated;
