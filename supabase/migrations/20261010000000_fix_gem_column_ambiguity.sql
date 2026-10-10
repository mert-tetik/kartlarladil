-- Qualify user_profiles columns in gem mutations. The output columns of
-- RETURNS TABLE have the same names as the profile columns, so an unqualified
-- reference such as `blue_gems = blue_gems - p_cost` is ambiguous in PL/pgSQL.

create or replace function public.spend_gem(p_user_id uuid, p_gem_type text, p_amount integer, p_reason text, p_idempotency_key text)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare current_profile public.user_profiles%rowtype; balance integer;
begin
  if p_gem_type not in ('blue','green','purple') or p_amount <= 0 or p_idempotency_key is null then raise exception 'invalid_gem_spend'; end if;
  select * into current_profile from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  balance := case p_gem_type when 'blue' then current_profile.blue_gems when 'green' then current_profile.green_gems else current_profile.purple_gems end;
  if balance < p_amount then raise exception 'insufficient_gems'; end if;
  update public.user_profiles as up
     set blue_gems = up.blue_gems - case when p_gem_type = 'blue' then p_amount else 0 end,
         green_gems = up.green_gems - case when p_gem_type = 'green' then p_amount else 0 end,
         purple_gems = up.purple_gems - case when p_gem_type = 'purple' then p_amount else 0 end
   where up.user_id = p_user_id;
  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, p_gem_type, -p_amount, p_reason, p_idempotency_key);
  return query select true, current_profile.blue_gems - case when p_gem_type = 'blue' then p_amount else 0 end,
    current_profile.green_gems - case when p_gem_type = 'green' then p_amount else 0 end,
    current_profile.purple_gems - case when p_gem_type = 'purple' then p_amount else 0 end;
end; $$;

create or replace function public.spend_gem_and_remove_card(p_user_id uuid, p_source_key text, p_cost integer)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare profile_row public.user_profiles%rowtype;
begin
  if p_source_key is null or btrim(p_source_key) = '' or p_cost <= 0 then raise exception 'invalid_card_removal'; end if;
  select * into profile_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if profile_row.blue_gems < p_cost then raise exception 'insufficient_gems'; end if;

  delete from public.user_cards
   where user_id = p_user_id and card_source_key = p_source_key and status = 'active';
  if not found then raise exception 'card_removal_only_active'; end if;

  delete from public.practice_attempts
   where user_id = p_user_id and card_source_key = p_source_key;

  update public.user_profiles as up
     set blue_gems = up.blue_gems - p_cost
   where up.user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'blue', -p_cost, 'remove-card:' || p_source_key, 'remove-card:' || p_source_key || ':' || gen_random_uuid());
  return query select true, profile_row.blue_gems - p_cost, profile_row.green_gems, profile_row.purple_gems;
end; $$;

create or replace function public.spend_gem_and_mark_card_learned(p_user_id uuid, p_source_key text, p_cost integer)
returns table (success boolean, blue_gems integer, green_gems integer, purple_gems integer)
language plpgsql security definer set search_path = public as $$
declare profile_row public.user_profiles%rowtype;
begin
  if p_source_key is null or btrim(p_source_key) = '' or p_cost <= 0 then raise exception 'invalid_card_learning'; end if;
  select * into profile_row from public.user_profiles where user_id = p_user_id for update;
  if not found then raise exception 'profile_not_found'; end if;
  if profile_row.purple_gems < p_cost then raise exception 'insufficient_gems'; end if;

  update public.user_cards as uc
     set status = 'learned', learned_at = coalesce(uc.learned_at, now())
   where uc.user_id = p_user_id and uc.card_source_key = p_source_key and uc.status = 'active';
  if not found then raise exception 'card_not_active'; end if;

  update public.user_profiles as up
     set purple_gems = up.purple_gems - p_cost
   where up.user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, 'purple', -p_cost, 'mark-learned:' || p_source_key, 'mark-learned:' || p_source_key || ':' || gen_random_uuid());
  return query select true, profile_row.blue_gems, profile_row.green_gems, profile_row.purple_gems - p_cost;
end; $$;
