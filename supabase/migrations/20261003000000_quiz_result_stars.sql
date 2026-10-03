-- Quiz result stars are a collectible separate from score points.
alter table public.user_profiles
  add column if not exists quiz_result_stars integer not null default 0
  check (quiz_result_stars >= 0);

create table if not exists public.quiz_result_star_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null unique,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists quiz_result_star_rewards_user_created_idx
  on public.quiz_result_star_rewards(user_id, created_at desc);

alter table public.quiz_result_star_rewards enable row level security;
revoke all on table public.quiz_result_star_rewards from anon, authenticated;

create or replace function public.claim_quiz_result_stars(
  p_user_id uuid,
  p_session_id uuid,
  p_stars integer
)
returns table (awarded boolean, total_stars integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_total integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'invalid_stars';
  end if;

  insert into public.quiz_result_star_rewards (user_id, session_id, stars)
  values (p_user_id, p_session_id, p_stars)
  on conflict (session_id) do nothing;

  if not found then
    select coalesce(profile.quiz_result_stars, 0)
      into next_total
      from public.user_profiles as profile
     where profile.user_id = p_user_id;

    return query select false, coalesce(next_total, 0);
    return;
  end if;

  update public.user_profiles
     set quiz_result_stars = quiz_result_stars + p_stars
   where user_id = p_user_id
   returning quiz_result_stars into next_total;

  if next_total is null then
    raise exception 'profile_not_found';
  end if;

  return query select true, next_total;
end;
$$;

revoke all on function public.claim_quiz_result_stars(uuid, uuid, integer) from public;
grant execute on function public.claim_quiz_result_stars(uuid, uuid, integer) to authenticated;
