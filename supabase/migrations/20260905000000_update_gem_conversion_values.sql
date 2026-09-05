-- Keep gem conversion values authoritative on the database side as well as in
-- the client display constants.
create or replace function public.convert_gem_to_points(p_user_id uuid, p_gem_type text, p_idempotency_key text)
returns table (success boolean, points integer, blue_gems integer, green_gems integer, purple_gems integer, gem_points integer)
language plpgsql security definer set search_path = public as $$
declare
  cost integer;
  balance integer;
  current_profile public.user_profiles%rowtype;
begin
  if p_gem_type not in ('blue', 'green', 'purple') or p_idempotency_key is null then
    raise exception 'invalid_gem_conversion';
  end if;

  cost := case p_gem_type when 'blue' then 5 when 'green' then 20 else 40 end;

  select * into current_profile
    from public.user_profiles
   where user_id = p_user_id
   for update;
  if not found then raise exception 'profile_not_found'; end if;

  balance := case p_gem_type
    when 'blue' then current_profile.blue_gems
    when 'green' then current_profile.green_gems
    else current_profile.purple_gems
  end;
  if balance < 1 then raise exception 'insufficient_gems'; end if;

  update public.user_profiles set
    blue_gems = blue_gems - case when p_gem_type = 'blue' then 1 else 0 end,
    green_gems = green_gems - case when p_gem_type = 'green' then 1 else 0 end,
    purple_gems = purple_gems - case when p_gem_type = 'purple' then 1 else 0 end,
    gem_points = gem_points + cost
   where user_id = p_user_id;

  insert into public.gem_transactions(user_id, gem_type, amount, reason, idempotency_key)
    values (p_user_id, p_gem_type, -1, 'convert-to-points', p_idempotency_key);

  return query select true, cost,
    current_profile.blue_gems - case when p_gem_type = 'blue' then 1 else 0 end,
    current_profile.green_gems - case when p_gem_type = 'green' then 1 else 0 end,
    current_profile.purple_gems - case when p_gem_type = 'purple' then 1 else 0 end,
    current_profile.gem_points + cost;
end;
$$;
