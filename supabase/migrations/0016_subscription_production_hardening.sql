-- Harden the auth trigger helper used to create the default free subscription row.
-- Supabase recommends setting search_path explicitly for SECURITY DEFINER functions.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user_subscription() from public;
revoke execute on function public.handle_new_user_subscription() from anon;
revoke execute on function public.handle_new_user_subscription() from authenticated;
