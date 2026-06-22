# Subscription Production Runbook

This runbook covers the production checks and recovery actions for FoxiesDeck subscriptions.

## Live Configuration Checklist

Before enabling paid plans in production, verify and record evidence for:

- Lemon Squeezy live store ID matches `LEMONSQUEEZY_STORE_ID`.
- Lemon Squeezy live variant IDs match:
  - `LEMONSQUEEZY_BASIC_VARIANT_ID`
  - `LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID`
  - `LEMONSQUEEZY_PRO_VARIANT_ID`
  - `LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID`
- Lemon Squeezy webhook URL points to `/api/lemon-squeezy/webhook` on the production domain.
- Lemon Squeezy webhook secret matches `LEMONSQUEEZY_WEBHOOK_SECRET`.
- Webhook events include:
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_expired`
  - `subscription_payment_success`
  - `subscription_payment_failed`
  - `subscription_payment_recovered`
- `NEXT_PUBLIC_SITE_URL` points to the production domain.
- Supabase RLS is enabled on `user_subscriptions`, `ai_usage_events`, and `webhook_events`.
- Supabase Security Advisor has no unresolved high severity finding for subscription objects.

## Smoke Test

Run these checks after every subscription deploy:

- Free user can open `/pricing`.
- Free user can create a Basic checkout.
- Free user can create a Pro checkout.
- Successful checkout returns to `/pricing?checkout=success`.
- `subscription_created` or `subscription_updated` webhook creates/updates `user_subscriptions`.
- Paid user sees paid entitlements after refresh.
- Paid user can open a fresh customer portal URL from account settings.
- Paid user cannot delete their account until the effective plan is free.
- Duplicate webhook delivery does not mutate state twice.
- Unknown Lemon variant logs a webhook error and does not downgrade the user to `free`.

## Webhook Replay

When a subscription looks wrong:

1. Find the Lemon Squeezy event in the dashboard.
2. Confirm the event has either `meta.custom_data.user_id`, a known subscription ID, or a known customer ID.
3. Replay the event from Lemon Squeezy.
4. Check `webhook_events` for `processed_at` and `error_message`.
5. Check `user_subscriptions` for the expected `plan`, `status`, `lemon_squeezy_subscription_id`, and `lemon_squeezy_variant_id`.

If replay still fails, do not manually change plan data until the Lemon event payload and variant mapping are verified.

## Manual Reconciliation

Use this only for support incidents:

1. Retrieve the subscription from Lemon Squeezy.
2. Verify the `variant_id` maps to exactly one FoxiesDeck plan.
3. Verify the Lemon customer belongs to the same Supabase user.
4. Update `user_subscriptions` through a controlled SQL script or admin tool.
5. Add a note to the incident log with the Lemon subscription ID, user ID, reason, and operator.

## Monitoring

Alert on:

- Any `/api/lemon-squeezy/webhook` 5xx.
- Any `webhook_events.error_message is not null`.
- Any unknown Lemon variant error.
- Any paid `user_subscriptions` row with missing `lemon_squeezy_subscription_id`.
- Any paid user reporting an unavailable customer portal.

## Secret Rotation

For webhook secret rotation:

1. Create the new secret in Lemon Squeezy.
2. Update `LEMONSQUEEZY_WEBHOOK_SECRET` in production.
3. Redeploy.
4. Send or replay one harmless subscription event.
5. Confirm signature verification succeeds.

For API key rotation:

1. Create a new Lemon Squeezy API key.
2. Update `LEMONSQUEEZY_API_KEY` in production.
3. Redeploy.
4. Verify checkout creation and customer portal retrieval.
5. Revoke the old key.

## Incident Response

For billing incidents:

- Freeze related deploys until the source is understood.
- Preserve the Lemon event payload and `webhook_events` row.
- Prefer replay/reconciliation over direct plan edits.
- After repair, run the smoke test and record the final user state.
