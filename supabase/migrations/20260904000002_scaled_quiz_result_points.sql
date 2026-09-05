alter table public.quiz_result_rewards
  drop constraint if exists quiz_result_rewards_points_check;

alter table public.quiz_result_rewards
  add constraint quiz_result_rewards_points_check check (points between 1 and 50);

drop function if exists public.award_quiz_result_points(uuid, uuid, integer);

create or replace function public.award_quiz_result_points(
  p_user_id uuid,
  p_session_id uuid,
  p_stars integer,
  p_card_count integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  result_points integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'invalid_stars';
  end if;

  if p_card_count is null or p_card_count not in (10, 20, 30, 50) then
    raise exception 'invalid_card_count';
  end if;

  result_points := p_stars * 2 * (p_card_count / 10);

  insert into public.quiz_result_rewards (user_id, session_id, stars, points)
  values (p_user_id, p_session_id, p_stars, result_points)
  on conflict (session_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set quiz_result_points = quiz_result_points + result_points
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.award_quiz_result_points(uuid, uuid, integer, integer) from public;
grant execute on function public.award_quiz_result_points(uuid, uuid, integer, integer) to authenticated;
