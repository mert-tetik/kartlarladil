-- Ensure every new auth user gets a free subscription row.
create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row
  execute function public.handle_new_user_subscription();

-- Backfill existing users who do not have a subscription row yet.
insert into public.user_subscriptions (user_id, plan, status)
select id, 'free', 'free'
from auth.users
where not exists (
  select 1 from public.user_subscriptions where user_subscriptions.user_id = auth.users.id
)
on conflict (user_id) do nothing;

-- RLS for AI usage events: users can only read and insert their own rows.
grant select, insert on public.ai_usage_events to authenticated;

create policy "Users read own AI usage"
  on public.ai_usage_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own AI usage"
  on public.ai_usage_events for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Index for fast daily/monthly AI usage counting.
create index if not exists ai_usage_events_user_type_created_idx
  on public.ai_usage_events(user_id, event_type, created_at desc);
