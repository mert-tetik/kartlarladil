-- Private developer-console data. Browser clients receive no grants or RLS
-- policies for these tables; every read and mutation is mediated by a server
-- action that first verifies a Supabase-authenticated administrator.

create table if not exists public.developer_budget_items (
  id uuid primary key default gen_random_uuid(),
  service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
  monthly_cost_try numeric(12, 2) not null check (monthly_cost_try >= 0),
  service_url text not null check (service_url ~* '^https?://[^[:space:]]+$'),
  notes text not null default '' check (char_length(notes) <= 2000),
  billing_day smallint check (billing_day between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_budget_items_active_idx
  on public.developer_budget_items (is_active, service_name);

create table if not exists public.developer_admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_email text not null,
  action text not null check (char_length(action) between 1 and 120),
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists developer_admin_audit_logs_created_idx
  on public.developer_admin_audit_logs (created_at desc);
create index if not exists developer_admin_audit_logs_target_idx
  on public.developer_admin_audit_logs (target_user_id, created_at desc);

alter table public.developer_budget_items enable row level security;
alter table public.developer_admin_audit_logs enable row level security;

revoke all on table public.developer_budget_items from anon, authenticated;
revoke all on table public.developer_admin_audit_logs from anon, authenticated;
grant all on table public.developer_budget_items to service_role;
grant all on table public.developer_admin_audit_logs to service_role;

-- Manual administrator grants are a first-class entitlement source. They are
-- deliberately separate from store purchases and carry a finite expiry.
alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_provider_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_provider_check
  check (provider in ('google_play', 'admin'));

-- Revenue uses only Google Play's server-verified recurring price. The TRY
-- amount is a conversion snapshot; source amount and currency remain stored
-- with it for auditability.
alter table public.user_subscriptions
  add column if not exists billing_cycle text
    check (billing_cycle in ('monthly', 'yearly')),
  add column if not exists recurring_price_amount numeric(18, 6)
    check (recurring_price_amount >= 0),
  add column if not exists recurring_price_currency text
    check (recurring_price_currency ~ '^[A-Z]{3}$'),
  add column if not exists recurring_monthly_try numeric(18, 2)
    check (recurring_monthly_try >= 0),
  add column if not exists revenue_price_updated_at timestamptz,
  add column if not exists auto_renew_enabled boolean not null default false;

create index if not exists user_subscriptions_revenue_stats_idx
  on public.user_subscriptions (provider, status, auto_renew_enabled, plan)
  where plan in ('basic', 'pro');

-- This RPC is intentionally callable only by service_role. It keeps the
-- dashboard aggregate server-side, avoiding a full card-table download.
create or replace function public.developer_admin_dashboard_stats()
returns table (
  total_users bigint,
  basic_subscribers bigint,
  pro_subscribers bigint,
  active_cards bigint,
  learned_cards bigint,
  total_cards bigint,
  monthly_recurring_revenue_try numeric,
  revenue_priced_subscribers bigint,
  revenue_unpriced_subscribers bigint
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.user_profiles),
    (select count(*) from public.user_subscriptions
      where plan = 'basic'
        and status in ('active', 'on_trial', 'past_due', 'cancelled')
        and (ends_at is null or ends_at > now())),
    (select count(*) from public.user_subscriptions
      where plan = 'pro'
        and status in ('active', 'on_trial', 'past_due', 'cancelled')
        and (ends_at is null or ends_at > now())),
    (select count(*) from public.user_cards where status = 'active'),
    (select count(*) from public.user_cards where status = 'learned'),
    (select count(*) from public.user_cards),
    (select coalesce(sum(recurring_monthly_try), 0)
      from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and auto_renew_enabled = true
        and recurring_monthly_try is not null),
    (select count(*) from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and auto_renew_enabled = true
        and recurring_monthly_try is not null),
    (select count(*) from public.user_subscriptions
      where plan in ('basic', 'pro')
        and provider = 'google_play'
        and status = 'active'
        and auto_renew_enabled = true
        and recurring_monthly_try is null);
$$;

revoke all on function public.developer_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.developer_admin_dashboard_stats() to service_role;
