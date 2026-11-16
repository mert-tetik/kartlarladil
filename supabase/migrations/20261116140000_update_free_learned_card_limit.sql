-- Keep the database enforcement boundary aligned with PLAN_LIMITS.free.
-- Historical migrations intentionally remain unchanged; this migration updates
-- the currently installed trigger function without rewriting migration history.
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

    if learned_count >= 50 then
      raise exception 'free_learned_card_limit';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_user_card_subscription_limits() from public, anon, authenticated;
