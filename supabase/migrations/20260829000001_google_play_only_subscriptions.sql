-- Google Play is now the only supported subscription provider.
-- Keep the legacy Lemon Squeezy columns/functions for historical database
-- compatibility, but they must not grant access or be used for new writes.

update public.user_subscriptions
set provider = 'google_play',
    plan = case when provider = 'google_play' then plan else 'free' end,
    status = case when provider = 'google_play' then status else 'free' end,
    customer_portal_url = null,
    lemon_squeezy_customer_id = null,
    lemon_squeezy_subscription_id = null,
    lemon_squeezy_variant_id = null,
    lemon_squeezy_product_id = null,
    lemon_squeezy_updated_at = null
where provider is distinct from 'google_play';

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_provider_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_provider_check
  check (provider = 'google_play');

alter table public.user_subscriptions
  alter column provider set default 'google_play';
