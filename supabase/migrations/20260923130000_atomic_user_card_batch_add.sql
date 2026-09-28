-- Add active user cards atomically so Free-plan limits cannot be exceeded by
-- concurrent requests from multiple tabs, devices, or server instances.
create or replace function public.add_user_cards_with_active_limit(
  p_user_id uuid,
  p_source_keys text[],
  p_active_card_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  normalized_source_keys text[];
  new_source_keys text[];
  allowed_source_keys text[];
  remaining_source_keys text[];
  active_card_count integer;
  available_slots integer;
begin
  if p_user_id is null then
    raise exception 'user_id_required';
  end if;

  if p_active_card_limit is not null and p_active_card_limit < 0 then
    raise exception 'invalid_active_card_limit';
  end if;

  -- A transaction-level lock serializes all active-card additions for one user
  -- while allowing unrelated users to proceed independently.
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
    return jsonb_build_object(
      'added_card_ids', '[]'::jsonb,
      'remaining_card_ids', '[]'::jsonb
    );
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
    return jsonb_build_object(
      'added_card_ids', '[]'::jsonb,
      'remaining_card_ids', '[]'::jsonb
    );
  end if;

  select count(*)
  into active_card_count
  from public.user_cards
  where user_id = p_user_id
    and status = 'active';

  available_slots := case
    when p_active_card_limit is null then array_length(new_source_keys, 1)
    else greatest(p_active_card_limit - active_card_count, 0)
  end;

  select
    coalesce(array_agg(ordered.source_key order by ordered.position) filter (where ordered.row_number <= available_slots), '{}'::text[]),
    coalesce(array_agg(ordered.source_key order by ordered.position) filter (where ordered.row_number > available_slots), '{}'::text[])
  into allowed_source_keys, remaining_source_keys
  from (
    select requested.source_key,
      requested.position,
      row_number() over (order by requested.position) as row_number
    from unnest(new_source_keys) with ordinality as requested(source_key, position)
  ) as ordered;

  insert into public.user_cards (user_id, card_source_key)
  select p_user_id, allowed.source_key
  from unnest(allowed_source_keys) as allowed(source_key)
  on conflict (user_id, card_source_key) do nothing;

  return jsonb_build_object(
    'added_card_ids', to_jsonb(allowed_source_keys),
    'remaining_card_ids', to_jsonb(remaining_source_keys)
  );
end;
$function$;

-- This function is called only by trusted server-side actions with the
-- service-role client. It must not be exposed as a client-callable RPC.
revoke all on function public.add_user_cards_with_active_limit(uuid, text[], integer)
  from public, anon, authenticated;
grant execute on function public.add_user_cards_with_active_limit(uuid, text[], integer)
  to service_role;
