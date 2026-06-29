-- Add display_name to user_subscriptions for easier admin readability.

alter table public.user_subscriptions
  add column if not exists display_name text;

-- Backfill existing rows from user_profiles.
update public.user_subscriptions
set display_name = user_profiles.display_name
from public.user_profiles
where user_subscriptions.user_id = user_profiles.user_id
  and user_profiles.display_name is not null;

-- Update the new-user trigger to include display_name when available.
create or replace function public.handle_new_user_subscription()
returns trigger as $$
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
$$ language plpgsql security definer;

-- Sync display_name when user_profiles is updated.
create or replace function public.sync_subscription_display_name()
returns trigger as $$
begin
  update public.user_subscriptions
  set display_name = new.display_name
  where user_id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_profile_updated_subscription on public.user_profiles;
create trigger on_user_profile_updated_subscription
  after update of display_name on public.user_profiles
  for each row
  execute function public.sync_subscription_display_name();
