-- The 1–5 collectibles shown after a quiz are medals, not stars.
-- Keep the already-earned balance and reward history while renaming the live
-- database API so the product terminology stays consistent.

begin;

do $$
declare
  constraint_name text;
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'user_profiles'
       and column_name = 'quiz_result_stars'
  ) then
    select pg_constraint.conname
      into constraint_name
      from pg_constraint
     where pg_constraint.conrelid = 'public.user_profiles'::regclass
       and pg_constraint.contype = 'c'
       and pg_get_constraintdef(pg_constraint.oid) like '%quiz_result_stars%'
     limit 1;

    if constraint_name is not null then
      execute format(
        'alter table public.user_profiles rename constraint %I to user_profiles_quiz_result_medals_check',
        constraint_name
      );
    end if;

    alter table public.user_profiles
      rename column quiz_result_stars to quiz_result_medals;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.quiz_result_star_rewards') is not null then
    alter table public.quiz_result_star_rewards
      rename to quiz_result_medal_rewards;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'quiz_result_medal_rewards'
       and column_name = 'stars'
  ) then
    alter table public.quiz_result_medal_rewards
      rename column stars to medals;
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.quiz_result_star_rewards_user_created_idx') is not null then
    alter index public.quiz_result_star_rewards_user_created_idx
      rename to quiz_result_medal_rewards_user_created_idx;
  end if;
end;
$$;

drop function if exists public.claim_quiz_result_stars(uuid, uuid, integer);

create or replace function public.claim_quiz_result_medals(
  p_user_id uuid,
  p_session_id uuid,
  p_medals integer
)
returns table (awarded boolean, total_medals integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_total integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_medals is null or p_medals < 1 or p_medals > 5 then
    raise exception 'invalid_medals';
  end if;

  insert into public.quiz_result_medal_rewards (user_id, session_id, medals)
  values (p_user_id, p_session_id, p_medals)
  on conflict (session_id) do nothing;

  if not found then
    select coalesce(profile.quiz_result_medals, 0)
      into next_total
      from public.user_profiles as profile
     where profile.user_id = p_user_id;

    return query select false, coalesce(next_total, 0);
    return;
  end if;

  update public.user_profiles
     set quiz_result_medals = quiz_result_medals + p_medals
   where user_id = p_user_id
   returning quiz_result_medals into next_total;

  if next_total is null then
    raise exception 'profile_not_found';
  end if;

  return query select true, next_total;
end;
$$;

revoke all on table public.quiz_result_medal_rewards from anon, authenticated;
revoke all on function public.claim_quiz_result_medals(uuid, uuid, integer) from public;
grant execute on function public.claim_quiz_result_medals(uuid, uuid, integer) to authenticated;

commit;
