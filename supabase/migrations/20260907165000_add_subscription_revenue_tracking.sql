-- This follow-up migration is intentionally separate because the developer
-- console schema may already have been applied before revenue tracking was
-- added. It is safe to run on a fresh database too.

begin;

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

-- PostgreSQL does not allow CREATE OR REPLACE to change a function's OUT
-- parameter row type. This is an internal, service-role-only RPC, so the
-- short drop/recreate is safe and atomically exposes the expanded result.
drop function if exists public.developer_admin_dashboard_stats();

create function public.developer_admin_dashboard_stats()
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

commit;
