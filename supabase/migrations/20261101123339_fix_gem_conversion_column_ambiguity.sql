-- The RETURNS TABLE output variables share names with user_profiles columns.
-- Qualify the old column values so PL/pgSQL does not treat them as ambiguous.
create or replace function public.convert_gem_to_points(
  p_user_id uuid,
  p_gem_type text,
  p_idempotency_key text
)
returns table (
  success boolean,
  points integer,
  blue_gems integer,
  green_gems integer,
  purple_gems integer,
  gem_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  conversion_points integer;
  current_balance integer;
  existing_gem_type text;
  current_profile public.user_profiles%rowtype;
begin
  if p_user_id is null
     or p_gem_type not in ('blue', 'green', 'purple')
     or p_idempotency_key is null
     or btrim(p_idempotency_key) = '' then
    raise exception 'invalid_gem_conversion';
  end if;

  conversion_points := case p_gem_type
    when 'blue' then 5
    when 'green' then 20
    else 40
  end;

  select *
    into current_profile
    from public.user_profiles
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select gem_type
    into existing_gem_type
    from public.gem_transactions
   where user_id = p_user_id
     and idempotency_key = p_idempotency_key;

  if found then
    if existing_gem_type <> p_gem_type then
      raise exception 'idempotency_key_conflict';
    end if;

    return query
      select true,
             conversion_points,
             current_profile.blue_gems,
             current_profile.green_gems,
             current_profile.purple_gems,
             current_profile.gem_points;
    return;
  end if;

  current_balance := case p_gem_type
    when 'blue' then current_profile.blue_gems
    when 'green' then current_profile.green_gems
    else current_profile.purple_gems
  end;

  if current_balance < 1 then
    raise exception 'insufficient_gems';
  end if;

  update public.user_profiles as up
     set blue_gems = up.blue_gems - case when p_gem_type = 'blue' then 1 else 0 end,
         green_gems = up.green_gems - case when p_gem_type = 'green' then 1 else 0 end,
         purple_gems = up.purple_gems - case when p_gem_type = 'purple' then 1 else 0 end,
         gem_points = up.gem_points + conversion_points
   where up.user_id = p_user_id;

  insert into public.gem_transactions (
    user_id,
    gem_type,
    amount,
    reason,
    idempotency_key
  ) values (
    p_user_id,
    p_gem_type,
    -1,
    'convert-to-points',
    p_idempotency_key
  );

  select *
    into current_profile
    from public.user_profiles
   where user_id = p_user_id;

  return query
    select true,
           conversion_points,
           current_profile.blue_gems,
           current_profile.green_gems,
           current_profile.purple_gems,
           current_profile.gem_points;
end;
$$;

revoke all on function public.convert_gem_to_points(uuid, text, text) from public, authenticated;
grant execute on function public.convert_gem_to_points(uuid, text, text) to service_role;
