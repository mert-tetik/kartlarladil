create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  status text not null default 'free'
    check (status in ('free', 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired')),
  lemon_squeezy_customer_id text,
  lemon_squeezy_subscription_id text unique,
  lemon_squeezy_variant_id text,
  lemon_squeezy_product_id text,
  customer_portal_url text,
  renews_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('chat', 'translate')),
  plan text not null check (plan in ('free', 'basic', 'pro')),
  created_at timestamptz not null default now()
);

create index if not exists user_subscriptions_plan_idx on public.user_subscriptions(plan);
create index if not exists user_subscriptions_subscription_idx
  on public.user_subscriptions(lemon_squeezy_subscription_id);
create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events(user_id, created_at desc);

grant select on public.user_subscriptions to authenticated;
grant all on public.user_subscriptions, public.ai_usage_events to service_role;

alter table public.user_subscriptions enable row level security;
alter table public.ai_usage_events enable row level security;

create policy "Users read own subscription"
  on public.user_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);
