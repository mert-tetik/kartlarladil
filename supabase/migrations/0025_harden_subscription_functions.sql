-- Harden subscription trigger functions by setting an explicit search_path.
-- This mitigates search_path injection attacks for security definer functions.

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_display_name text;
begin
  select display_name into new_display_name
  from public.user_profiles
  where user_id = new.id;

  insert into public.user_subscriptions (user_id, plan, status, display_name)
  values (new.id, 'free', 'free', new_display_name)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_subscription_display_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_subscriptions
  set display_name = new.display_name
  where user_id = new.user_id;
  return new;
end;
$$;
