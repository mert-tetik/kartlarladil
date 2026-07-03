create extension if not exists pg_cron;
create extension if not exists pg_net;

alter table public.user_profiles
  add column if not exists push_marketing_enabled boolean not null default false;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null check (jsonb_typeof(subscription) = 'object'),
  app_surface text not null check (app_surface in ('twa_android')),
  permission_state text not null check (permission_state in ('default', 'granted', 'denied')),
  is_active boolean not null default true,
  last_active_at timestamptz,
  last_sent_at timestamptz,
  cooldown_until timestamptz,
  last_inactivity_stage smallint not null default 0 check (last_inactivity_stage between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  campaign_type text not null check (campaign_type in ('inactivity')),
  stage smallint not null check (stage between 1 and 3),
  locale text not null check (locale in ('tr', 'en', 'de', 'ru', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ar', 'ja', 'ko', 'zh-CN')),
  title text not null,
  body text not null,
  target_url text not null,
  status text not null check (status in ('sent', 'failed', 'opened')),
  error_message text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

create index if not exists push_subscriptions_due_idx
  on public.push_subscriptions(is_active, app_surface, permission_state, cooldown_until, last_inactivity_stage, last_active_at);

create index if not exists notification_logs_user_id_sent_at_idx
  on public.notification_logs(user_id, sent_at desc);

create index if not exists notification_logs_subscription_id_idx
  on public.notification_logs(push_subscription_id);

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_push_subscription_updated_at on public.push_subscriptions;
create trigger set_push_subscription_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_push_subscription_updated_at();

grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select on table public.notification_logs to authenticated;

alter table public.push_subscriptions enable row level security;
alter table public.notification_logs enable row level security;

drop policy if exists "Users can read their own push subscriptions" on public.push_subscriptions;
create policy "Users can read their own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
create policy "Users can insert their own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
create policy "Users can update their own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can delete their own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own notification logs" on public.notification_logs;
create policy "Users can read their own notification logs"
  on public.notification_logs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
