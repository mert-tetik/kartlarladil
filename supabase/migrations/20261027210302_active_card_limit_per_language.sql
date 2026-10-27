alter table public.user_cards
  add column if not exists language_code text;

update public.user_cards as user_card
set language_code = coalesce(
  (
    select custom_card.language
    from public.custom_cards as custom_card
    where custom_card.user_id = user_card.user_id
      and custom_card.source_key = user_card.card_source_key
    limit 1
  ),
  case
    when split_part(user_card.card_source_key, ':', 1) = 'social-studio'
      then split_part(user_card.card_source_key, ':', 2)
    else split_part(user_card.card_source_key, ':', 1)
  end
)
where user_card.language_code is null;

do $$
begin
  if exists (
    select 1
    from public.user_cards
    where language_code is null
      or language_code not in (
        'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'ru', 'ar', 'ja', 'ko', 'zh-CN'
      )
  ) then
    raise exception 'active_card_language_backfill_failed';
  end if;
end;
$$;

alter table public.user_cards
  alter column language_code set not null;

alter table public.user_cards
  drop constraint if exists user_cards_language_code_check;

alter table public.user_cards
  add constraint user_cards_language_code_check
  check (language_code in (
    'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'ru', 'ar', 'ja', 'ko', 'zh-CN'
  ));

create index if not exists user_cards_user_language_status_idx
  on public.user_cards (user_id, language_code, status);

create or replace function public.resolve_user_card_language(p_user_id uuid, p_source_key text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  resolved_language text;
  source_language text;
begin
  select custom_card.language
  into resolved_language
  from public.custom_cards as custom_card
  where custom_card.user_id = p_user_id
    and custom_card.source_key = p_source_key
  limit 1;

  if resolved_language is null then
    source_language := case
      when split_part(p_source_key, ':', 1) = 'social-studio'
        then split_part(p_source_key, ':', 2)
      else split_part(p_source_key, ':', 1)
    end;
    resolved_language := source_language;
  end if;

  if resolved_language in (
    'en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'ru', 'ar', 'ja', 'ko', 'zh-CN'
  ) then
    return resolved_language;
  end if;

  return null;
end;
$$;

revoke all on function public.resolve_user_card_language(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function public.enforce_user_card_subscription_limits()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  active_count integer;
  learned_count integer;
begin
  new.language_code := public.resolve_user_card_language(new.user_id, new.card_source_key);
  if new.language_code is null then
    raise exception 'invalid_user_card_language';
  end if;

  -- Serialize all card status changes for one account against batch additions.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if public.get_active_paid_subscription_plan(new.user_id) is not null then
    return new;
  end if;

  if new.status = 'active'
    and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    select count(*) into active_count
    from public.user_cards
    where user_id = new.user_id
      and language_code = new.language_code
      and status = 'active';

    if active_count >= 20 then
      raise exception 'free_active_card_limit';
    end if;
  end if;

  if new.status = 'learned' and (tg_op = 'INSERT' or old.status is distinct from 'learned') then
    select count(*) into learned_count
    from public.user_cards
    where user_id = new.user_id and status = 'learned';

    if learned_count >= 100 then
      raise exception 'free_learned_card_limit';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_user_card_subscription_limits on public.user_cards;
create trigger enforce_user_card_subscription_limits
  before insert or update of status, card_source_key, language_code on public.user_cards
  for each row
  execute function public.enforce_user_card_subscription_limits();

revoke all on function public.enforce_user_card_subscription_limits() from public, anon, authenticated;

create or replace function public.add_user_cards_with_active_limit(
  p_user_id uuid,
  p_source_keys text[],
  p_active_card_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  normalized_source_keys text[];
  new_source_keys text[];
  allowed_source_keys text[];
  remaining_source_keys text[];
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  if p_active_card_limit is not null and p_active_card_limit < 0 then
    raise exception 'invalid_active_card_limit';
  end if;

  -- Match the trigger lock so concurrent adds/status changes cannot exceed a language quota.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(array_agg(first_seen.source_key order by first_seen.first_position), '{}'::text[])
  into normalized_source_keys
  from (
    select btrim(requested.source_key) as source_key, min(requested.position) as first_position
    from unnest(coalesce(p_source_keys, '{}'::text[])) with ordinality as requested(source_key, position)
    where requested.source_key is not null
      and btrim(requested.source_key) <> ''
    group by btrim(requested.source_key)
  ) as first_seen;

  if coalesce(array_length(normalized_source_keys, 1), 0) = 0 then
    return jsonb_build_object('added_card_ids', '[]'::jsonb, 'remaining_card_ids', '[]'::jsonb);
  end if;

  select coalesce(array_agg(requested.source_key order by requested.position), '{}'::text[])
  into new_source_keys
  from (
    select requested.source_key, requested.position
    from unnest(normalized_source_keys) with ordinality as requested(source_key, position)
    where not exists (
      select 1
      from public.user_cards as existing
      where existing.user_id = p_user_id
        and existing.card_source_key = requested.source_key
    )
  ) as requested;

  if coalesce(array_length(new_source_keys, 1), 0) = 0 then
    return jsonb_build_object('added_card_ids', '[]'::jsonb, 'remaining_card_ids', '[]'::jsonb);
  end if;

  if exists (
    select 1
    from unnest(new_source_keys) as requested(source_key)
    where public.resolve_user_card_language(p_user_id, requested.source_key) is null
  ) then
    raise exception 'invalid_user_card_language';
  end if;

  with candidates as materialized (
    select requested.source_key,
      requested.position,
      public.resolve_user_card_language(p_user_id, requested.source_key) as language_code
    from unnest(new_source_keys) with ordinality as requested(source_key, position)
  ),
  language_counts as (
    select language_code, count(*) as candidate_count
    from candidates
    group by language_code
  ),
  active_counts as (
    select language_code, count(*) as active_count
    from public.user_cards
    where user_id = p_user_id and status = 'active'
    group by language_code
  ),
  ranked as (
    select candidates.source_key,
      candidates.position,
      row_number() over (partition by candidates.language_code order by candidates.position) as language_position,
      case
        when p_active_card_limit is null then language_counts.candidate_count
        else greatest(p_active_card_limit - coalesce(active_counts.active_count, 0), 0)
      end as available_slots
    from candidates
    join language_counts using (language_code)
    left join active_counts using (language_code)
  )
  select
    coalesce(array_agg(source_key order by position) filter (where language_position <= available_slots), '{}'::text[]),
    coalesce(array_agg(source_key order by position) filter (where language_position > available_slots), '{}'::text[])
  into allowed_source_keys, remaining_source_keys
  from ranked;

  insert into public.user_cards (user_id, card_source_key, language_code)
  select p_user_id,
    allowed.source_key,
    public.resolve_user_card_language(p_user_id, allowed.source_key)
  from unnest(allowed_source_keys) as allowed(source_key)
  on conflict (user_id, card_source_key) do nothing;

  return jsonb_build_object(
    'added_card_ids', to_jsonb(allowed_source_keys),
    'remaining_card_ids', to_jsonb(remaining_source_keys)
  );
end;
$function$;

revoke all on function public.add_user_cards_with_active_limit(uuid, text[], integer)
  from public, anon, authenticated;
grant execute on function public.add_user_cards_with_active_limit(uuid, text[], integer)
  to service_role;
