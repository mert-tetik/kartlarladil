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
declare
  expected_points integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_bonus_id !~ ('^' || p_session_id::text || '-(matching|sentence-order|category-sort|imposter)-(0|[1-9]|[1-4][0-9])$') then
    raise exception 'invalid_bonus';
  end if;

  if p_bonus_id ~ ('^' || p_session_id::text || '-matching-') then
    expected_points := 25;
  elsif p_bonus_id ~ ('^' || p_session_id::text || '-sentence-order-') then
    expected_points := 30;
  elsif p_bonus_id ~ ('^' || p_session_id::text || '-category-sort-') then
    expected_points := 35;
  elsif p_bonus_id ~ ('^' || p_session_id::text || '-imposter-') then
    expected_points := 20;
  else
    raise exception 'invalid_bonus';
  end if;

  if p_points is distinct from expected_points then
    raise exception 'invalid_points';
  end if;

  insert into public.quiz_bonus_rewards (user_id, session_id, bonus_id, points)
  values (p_user_id, p_session_id, p_bonus_id, expected_points)
  on conflict (user_id, session_id, bonus_id) do nothing;

  if not found then
    return false;
  end if;

  update public.user_profiles
  set quiz_result_points = quiz_result_points + expected_points
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.award_quiz_bonus_points(uuid, uuid, text, integer) from public;
grant execute on function public.award_quiz_bonus_points(uuid, uuid, text, integer) to authenticated;
