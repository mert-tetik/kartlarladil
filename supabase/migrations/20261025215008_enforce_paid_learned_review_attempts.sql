begin;

-- Learned-card review is a paid feature. The Server Action checks this before
-- writing, but authenticated clients can also reach practice_attempts through
-- the Supabase Data API, so enforce the same entitlement at the database edge.
do $$
begin
  if to_regclass('public.practice_attempts') is null then
    raise exception 'subscription_security_check_failed: practice_attempts_missing';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.practice_attempts'::regclass
      and attname = 'mode'
      and not attisdropped
  ) then
    raise exception 'subscription_security_check_failed: practice_attempts_mode_missing';
  end if;

  if to_regprocedure('public.get_active_paid_subscription_plan(uuid)') is null then
    raise exception 'subscription_security_check_failed: active_plan_helper_missing';
  end if;
end;
$$;

create or replace function public.enforce_paid_learned_review_attempts()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.mode = 'learned'
    and public.get_active_paid_subscription_plan(new.user_id) is null then
    raise exception 'learned_review_subscription_required'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_paid_learned_review_attempts() from public, anon, authenticated;

drop trigger if exists enforce_paid_learned_review_attempts on public.practice_attempts;
create trigger enforce_paid_learned_review_attempts
  before insert on public.practice_attempts
  for each row
  execute function public.enforce_paid_learned_review_attempts();

-- Fail closed if the trigger was not installed with the intended privilege
-- boundary and entitlement check.
do $$
declare
  trigger_is_valid boolean;
begin
  select exists (
    select 1
    from pg_trigger as trigger_info
    join pg_proc as function_info on function_info.oid = trigger_info.tgfoid
    where trigger_info.tgrelid = 'public.practice_attempts'::regclass
      and trigger_info.tgname = 'enforce_paid_learned_review_attempts'
      and not trigger_info.tgisinternal
      and position('before insert on public.practice_attempts' in lower(pg_get_triggerdef(trigger_info.oid))) > 0
      and function_info.prosecdef
      and has_function_privilege('authenticated', function_info.oid, 'EXECUTE') = false
      and has_function_privilege('anon', function_info.oid, 'EXECUTE') = false
      and position(
        'public.get_active_paid_subscription_plan(new.user_id)'
        in lower(pg_get_functiondef(function_info.oid))
      ) > 0
      and position('new.mode = ''learned''' in lower(pg_get_functiondef(function_info.oid))) > 0
  ) into trigger_is_valid;

  if trigger_is_valid is distinct from true then
    raise exception 'subscription_security_check_failed: learned_review_trigger_incorrect';
  end if;
end;
$$;

commit;
