create or replace function public.spend_gem_and_remove_card(p_user_id uuid, p_source_key text, p_cost integer)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare profile_row public.user_profiles%rowtype;
begin
  if p_source_key is null or btrim(p_source_key) = '' or p_cost <= 0 then
    raise exception 'invalid_card_removal';
  end if;

  select * into profile_row
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then raise exception 'profile_not_found'; end if;
  if profile_row.blue_gems < p_cost then raise exception 'insufficient_gems'; end if;

  delete from public.user_cards
  where user_id = p_user_id
    and card_source_key = p_source_key
    and status = 'active';

  if not found then raise exception 'card_removal_only_active'; end if;

  delete from public.practice_attempts
  where user_id = p_user_id
    and card_source_key = p_source_key;

  update public.user_profiles
  set blue_gems = blue_gems - p_cost
  where user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (
      p_user_id,
      'blue',
      -p_cost,
      'remove-card:' || p_source_key,
      'remove-card:' || p_source_key || ':' || gen_random_uuid()
    );

  return query
  select true, profile_row.blue_gems - p_cost, profile_row.green_gems, profile_row.purple_gems;
end; $$;
