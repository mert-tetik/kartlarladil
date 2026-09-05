create table if not exists public.progress_gem_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_key text not null check (char_length(btrim(claim_key)) between 1 and 160),
  source text not null check (source in ('game-level', 'quiz-streak', 'quiz-result')),
  gem_type text check (gem_type in ('blue', 'green', 'purple')),
  amount integer not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, claim_key),
  check ((amount = 0 and gem_type is null) or (amount > 0 and gem_type is not null))
);

create index if not exists progress_gem_rewards_user_created_idx
  on public.progress_gem_rewards(user_id, created_at desc);

alter table public.progress_gem_rewards enable row level security;
revoke all on table public.progress_gem_rewards from anon, authenticated;

create or replace function public.award_progress_gem_reward(
  p_user_id uuid,
  p_claim_key text,
  p_source text,
  p_level integer,
  p_streak integer,
  p_stars integer,
  p_card_count integer
)
returns table (
  awarded boolean,
  gem_type text,
  amount integer,
  blue_gems integer,
  green_gems integer,
  purple_gems integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_reward public.progress_gem_rewards%rowtype;
  profile_row public.user_profiles%rowtype;
  selected_type text;
  selected_amount integer := 0;
  roll numeric;
  reward_chance numeric;
  type_roll numeric;
  band integer;
  quality integer;
begin
  if p_user_id is null or p_claim_key is null or btrim(p_claim_key) = '' then
    raise exception 'invalid_gem_reward';
  end if;

  if p_source not in ('game-level', 'quiz-streak', 'quiz-result') then
    raise exception 'invalid_gem_source';
  end if;

  if p_source = 'game-level' and (p_level is null or p_level < 1 or p_level > 1000) then
    raise exception 'invalid_game_level';
  end if;

  if p_source = 'quiz-streak' and (p_streak is null or p_streak < 5 or p_streak > 10000) then
    raise exception 'invalid_quiz_streak';
  end if;

  if p_source = 'quiz-result' and (
    p_stars is null or p_stars < 1 or p_stars > 5 or
    p_card_count is null or p_card_count not in (10, 20, 30, 50)
  ) then
    raise exception 'invalid_quiz_result';
  end if;

  -- Serialize retries so a failed network response cannot roll a second reward.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_claim_key, 0));

  select * into profile_row
    from public.user_profiles
   where user_id = p_user_id
   for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select * into existing_reward
    from public.progress_gem_rewards
   where user_id = p_user_id and claim_key = p_claim_key;

  if found then
    return query select
      false,
      existing_reward.gem_type,
      existing_reward.amount,
      profile_row.blue_gems,
      profile_row.green_gems,
      profile_row.purple_gems;
    return;
  end if;

  if p_source = 'game-level' then
    band := case when p_level < 5 then 0 when p_level < 10 then 1 when p_level < 20 then 2 else 3 end;
    reward_chance := least(80, 35 + band * 10);
    if random() * 100 < reward_chance then
      type_roll := random() * 100;
      selected_type := case
        when type_roll < case band when 0 then 82 when 1 then 70 when 2 then 55 else 40 end then 'blue'
        when type_roll < case band when 0 then 99 when 1 then 95 when 2 then 90 else 80 end then 'green'
        else 'purple'
      end;
      selected_amount := case selected_type
        when 'blue' then floor(random() * (case band when 0 then 2 when 1 then 3 when 2 then 3 else 3 end))::integer + 1
        when 'green' then floor(random() * (case band when 0 then 1 when 1 then 2 when 2 then 3 else 3 end))::integer + 1
        else floor(random() * (case band when 0 then 1 when 1 then 1 when 2 then 2 else 2 end))::integer + 1
      end;
    end if;
  elsif p_source = 'quiz-streak' then
    band := least(3, greatest(0, floor(p_streak / 5)::integer - 1));
    reward_chance := least(90, 45 + floor(p_streak / 5)::integer * 5);
    if random() * 100 < reward_chance then
      type_roll := random() * 100;
      selected_type := case
        when type_roll < case band when 0 then 75 when 1 then 55 when 2 then 38 else 25 end then 'blue'
        when type_roll < case band when 0 then 97 when 1 then 90 when 2 then 80 else 70 end then 'green'
        else 'purple'
      end;
      selected_amount := case selected_type
        when 'blue' then floor(random() * (case band when 0 then 2 when 1 then 3 when 2 then 3 else 3 end))::integer + 1
        when 'green' then floor(random() * (case band when 0 then 1 when 1 then 2 when 2 then 3 else 3 end))::integer + 1
        else floor(random() * (case band when 0 then 1 when 1 then 1 when 2 then 2 else 2 end))::integer + 1
      end;
    end if;
  else
    quality := p_stars + p_card_count / 10;
    reward_chance := least(90, 20 + p_stars * 8 + (p_card_count / 10) * 5);
    if random() * 100 < reward_chance then
      type_roll := random() * 100;
      selected_type := case
        when type_roll < greatest(45, 88 - quality * 4) then 'blue'
        when type_roll < greatest(45, 88 - quality * 4) + least(35, 10 + quality * 2) then 'green'
        else 'purple'
      end;
      selected_amount := case selected_type
        when 'blue' then floor(random() * least(4, 1 + quality / 3))::integer + 1
        when 'green' then floor(random() * least(3, 1 + quality / 4))::integer + 1
        else floor(random() * least(3, 1 + quality / 5))::integer + 1
      end;
    end if;
  end if;

  insert into public.progress_gem_rewards (user_id, claim_key, source, gem_type, amount)
  values (p_user_id, p_claim_key, p_source, selected_type, selected_amount);

  if selected_amount > 0 then
    update public.user_profiles
       set blue_gems = blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
           green_gems = green_gems + case when selected_type = 'green' then selected_amount else 0 end,
           purple_gems = purple_gems + case when selected_type = 'purple' then selected_amount else 0 end
     where user_id = p_user_id;

    insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, selected_type, selected_amount, p_source, p_claim_key);
  end if;

  return query select
    selected_amount > 0,
    selected_type,
    selected_amount,
    profile_row.blue_gems + case when selected_type = 'blue' then selected_amount else 0 end,
    profile_row.green_gems + case when selected_type = 'green' then selected_amount else 0 end,
    profile_row.purple_gems + case when selected_type = 'purple' then selected_amount else 0 end;
end;
$$;

revoke all on function public.award_progress_gem_reward(uuid, text, text, integer, integer, integer, integer) from public, authenticated;
grant execute on function public.award_progress_gem_reward(uuid, text, text, integer, integer, integer, integer) to service_role;
