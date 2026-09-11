-- Bonus quiz answers award their points and gem loot in one idempotent
-- transaction.  The client calls this through the service-role-backed server
-- action after authenticating the current user.

alter table public.progress_gem_rewards
  drop constraint if exists progress_gem_rewards_source_check;
alter table public.progress_gem_rewards
  add constraint progress_gem_rewards_source_check
  check (source in ('game-level', 'quiz-streak', 'quiz-result', 'quiz-bonus'));

alter table public.progress_gem_reward_items
  drop constraint if exists progress_gem_reward_items_source_check;
alter table public.progress_gem_reward_items
  add constraint progress_gem_reward_items_source_check
  check (source in ('game-level', 'quiz-streak', 'quiz-result', 'quiz-bonus'));

drop function if exists public.award_quiz_bonus_rewards(uuid, uuid, text, integer);
create function public.award_quiz_bonus_rewards(
  p_user_id uuid,
  p_session_id uuid,
  p_bonus_id text,
  p_points integer
)
returns table (
  awarded boolean,
  points integer,
  rewards jsonb,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_points integer;
  claim_key text;
  existing_points integer;
  existing_rewards jsonb;
  rewards_json jsonb;
  profile_row public.user_profiles%rowtype;
  inserted_count integer;
  blue_drop boolean;
  green_drop boolean;
  purple_drop boolean;
  fallback_roll numeric;
  blue_chance numeric;
  green_chance numeric;
  purple_chance numeric;
  blue_max integer;
  green_max integer;
  purple_max integer;
  blue_amount integer := 0;
  green_amount integer := 0;
  purple_amount integer := 0;
  selected_type text;
  selected_amount integer;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'invalid_bonus';
  end if;

  if p_bonus_id is null
     or p_bonus_id !~ ('^' || p_session_id::text || '-(matching|sentence-order|category-sort|imposter)-(0|[1-9]|[1-4][0-9])$') then
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

  claim_key := 'quiz-bonus:' || p_bonus_id;

  -- Serialize retries from the same user/session/bonus before inspecting or
  -- mutating either the points or gem ledgers.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || claim_key, 0));

  select profile.* into profile_row
    from public.user_profiles as profile
   where profile.user_id = p_user_id
   for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select reward.points into existing_points
    from public.quiz_bonus_rewards as reward
   where reward.user_id = p_user_id
     and reward.session_id = p_session_id
     and reward.bonus_id = p_bonus_id;

  if found then
    select coalesce(
      jsonb_agg(
        jsonb_build_object('type', item.gem_type, 'amount', item.amount)
        order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
      ), '[]'::jsonb
    ) into existing_rewards
      from public.progress_gem_reward_items as item
     where item.user_id = p_user_id and item.claim_key = claim_key;

    if existing_rewards = '[]'::jsonb then
      select case when parent.gem_type is null then '[]'::jsonb
                  else jsonb_build_array(jsonb_build_object('type', parent.gem_type, 'amount', parent.amount)) end
        into existing_rewards
        from public.progress_gem_rewards as parent
       where parent.user_id = p_user_id and parent.claim_key = claim_key;
    end if;

    return query select false, existing_points, coalesce(existing_rewards, '[]'::jsonb),
      coalesce(profile_row.blue_gems, 0),
      coalesce(profile_row.green_gems, 0),
      coalesce(profile_row.purple_gems, 0);
    return;
  end if;

  -- Independent chances.  These are the bonus-question bands from the app
  -- policy; a higher-value question never reduces a gem's chance.
  blue_chance := case expected_points when 20 then 35 when 25 then 40 when 30 then 45 else 52 end;
  green_chance := case expected_points when 20 then 10 when 25 then 13 when 30 then 17 else 22 end;
  purple_chance := case expected_points when 20 then 5 when 25 then 7 when 30 then 9 else 12 end;
  blue_max := case expected_points when 20 then 2 when 25 then 2 when 30 then 3 else 4 end;
  green_max := case expected_points when 20 then 1 when 25 then 2 when 30 then 3 else 3 end;
  purple_max := case when expected_points >= 30 then 2 else 1 end;

  blue_drop := random() * 100 < blue_chance;
  green_drop := random() * 100 < green_chance;
  purple_drop := random() * 100 < purple_chance;

  -- A correct bonus answer always has a tangible reward.
  if not blue_drop and not green_drop and not purple_drop then
    fallback_roll := random() * 100;
    if fallback_roll < 45 then blue_drop := true;
    elsif fallback_roll < 75 then green_drop := true;
    else purple_drop := true;
    end if;
  end if;

  if blue_drop then blue_amount := floor(random() * blue_max)::integer + 1; end if;
  if green_drop then green_amount := floor(random() * green_max)::integer + 1; end if;
  if purple_drop then purple_amount := floor(random() * purple_max)::integer + 1; end if;

  selected_type := case when blue_drop then 'blue' when green_drop then 'green' else 'purple' end;
  selected_amount := case selected_type when 'blue' then blue_amount when 'green' then green_amount else purple_amount end;

  insert into public.quiz_bonus_rewards (user_id, session_id, bonus_id, points)
  values (p_user_id, p_session_id, p_bonus_id, expected_points)
  on conflict (user_id, session_id, bonus_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'bonus_reward_race';
  end if;

  insert into public.progress_gem_rewards(user_id, claim_key, source, gem_type, amount)
  values (p_user_id, claim_key, 'quiz-bonus', selected_type, selected_amount);

  if blue_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, claim_key, 'quiz-bonus', 'blue', blue_amount);
  end if;
  if green_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, claim_key, 'quiz-bonus', 'green', green_amount);
  end if;
  if purple_drop then
    insert into public.progress_gem_reward_items(user_id, claim_key, source, gem_type, amount)
    values (p_user_id, claim_key, 'quiz-bonus', 'purple', purple_amount);
  end if;

  update public.user_profiles as profile
     set quiz_result_points = coalesce(profile.quiz_result_points, 0) + expected_points,
         blue_gems = coalesce(profile.blue_gems, 0) + blue_amount,
         green_gems = coalesce(profile.green_gems, 0) + green_amount,
         purple_gems = coalesce(profile.purple_gems, 0) + purple_amount
   where profile.user_id = p_user_id;

  if blue_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'blue', blue_amount, 'quiz-bonus', claim_key || ':gem:blue');
  end if;
  if green_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'green', green_amount, 'quiz-bonus', claim_key || ':gem:green');
  end if;
  if purple_amount > 0 then
    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'purple', purple_amount, 'quiz-bonus', claim_key || ':gem:purple');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('type', item.gem_type, 'amount', item.amount)
      order by case item.gem_type when 'blue' then 1 when 'green' then 2 else 3 end
    ), '[]'::jsonb
  ) into rewards_json
    from public.progress_gem_reward_items as item
   where item.user_id = p_user_id and item.claim_key = claim_key;

  select profile.* into profile_row
    from public.user_profiles as profile
   where profile.user_id = p_user_id;

  return query select true, expected_points, rewards_json,
    coalesce(profile_row.blue_gems, 0),
    coalesce(profile_row.green_gems, 0),
    coalesce(profile_row.purple_gems, 0);
end;
$$;

revoke all on function public.award_quiz_bonus_rewards(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.award_quiz_bonus_rewards(uuid, uuid, text, integer) to service_role;
