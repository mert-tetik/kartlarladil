-- Add provider tracking to support both Lemon Squeezy and Google Play Billing subscriptions.

alter table public.user_subscriptions
  add column if not exists provider text not null default 'lemon_squeezy'
    check (provider in ('lemon_squeezy', 'google_play')),
  add column if not exists google_play_purchase_token text,
  add column if not exists google_play_subscription_id text,
  add column if not exists google_play_order_id text;

-- Existing rows were all created through Lemon Squeezy before this migration.
update public.user_subscriptions
set provider = 'lemon_squeezy'
where provider is null;
