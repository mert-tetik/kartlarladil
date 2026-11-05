create or replace function public.award_quiz_performance_points(
  p_user_id uuid,
  p_session_id uuid,
  p_selected_count integer,
  p_duration_seconds integer,
  p_correct_answer_count integer,
  p_answered_count integer,
  p_correct_card_count integer,
  p_learned_card_count integer
)
returns table (
  awarded boolean,
  accuracy_points integer,
  time_points integer,
  correct_points integer,
  learned_points integer,
  total_points integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accuracy_points integer;
  v_time_points integer;
  v_correct_points integer;
  v_learned_points integer;
  v_total_points integer;
  v_inserted boolean;
begin
  if p_user_id is null or auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized';
  end if;

  if p_session_id is null
    or p_selected_count is null
    or p_selected_count < 1
    or p_selected_count > 50
    or p_duration_seconds is null
    or p_duration_seconds < 0
    or p_duration_seconds > 43200
    or p_correct_answer_count is null
    or p_correct_answer_count < 0
    or p_answered_count is null
    or p_answered_count < 0
    or p_correct_answer_count > p_answered_count
    or p_answered_count > p_selected_count * 20
    or p_correct_card_count is null
    or p_correct_card_count < 0
    or p_correct_card_count > p_selected_count
    or p_learned_card_count is null
    or p_learned_card_count < 0
    or p_learned_card_count > p_selected_count
  then
    raise exception 'invalid_quiz_result';
  end if;

  v_accuracy_points := case
    when p_answered_count = 0 then 0
    else round(50::numeric * p_correct_answer_count / p_answered_count)::integer
  end;
  v_time_points := round(
    50::numeric * greatest(
      0::numeric,
      1::numeric - p_duration_seconds::numeric / (p_selected_count * 60)
    )
  )::integer;
  v_correct_points := least(50, p_correct_card_count * 10);
  v_learned_points := least(50, p_learned_card_count * 20);
  v_total_points := v_accuracy_points + v_time_points + v_correct_points + v_learned_points;

  if v_total_points = 0 then
    return query select false, 0, 0, 0, 0, 0;
    return;
  end if;

  insert into public.quiz_performance_rewards (
    user_id,
    session_id,
    accuracy_points,
    time_points,
    correct_points,
    learned_points,
    total_points
  )
  values (
    p_user_id,
    p_session_id,
    v_accuracy_points,
    v_time_points,
    v_correct_points,
    v_learned_points,
    v_total_points
  )
  on conflict (user_id, session_id) do nothing
  returning true into v_inserted;

  if not coalesce(v_inserted, false) then
    return query
      select
        false,
        rewards.accuracy_points,
        rewards.time_points,
        rewards.correct_points,
        rewards.learned_points,
        rewards.total_points
      from public.quiz_performance_rewards as rewards
      where rewards.user_id = p_user_id
        and rewards.session_id = p_session_id;
    return;
  end if;

  update public.user_profiles as profiles
  set quiz_result_points = coalesce(profiles.quiz_result_points, 0) + v_total_points
  where profiles.user_id = p_user_id;

  if not found then
    raise exception 'profile_missing';
  end if;

  return query select
    true,
    v_accuracy_points,
    v_time_points,
    v_correct_points,
    v_learned_points,
    v_total_points;
end;
$$;

revoke all on function public.award_quiz_performance_points(uuid, uuid, integer, integer, integer, integer, integer, integer)
  from public, anon;
grant execute on function public.award_quiz_performance_points(uuid, uuid, integer, integer, integer, integer, integer, integer)
  to authenticated;
