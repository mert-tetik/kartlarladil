# Subscription Production Runbook

This runbook documents the current Google Play subscription and entitlement model. Historical Lemon Squeezy instructions are obsolete: the application grants paid entitlements only for verified `google_play` purchases or time-bounded `admin` grants.

## Entitlement rules

- A paid plan is effective only for `basic` or `pro`, an allowed provider, an allowed status, and a valid future `ends_at`. A missing, malformed, or expired end time fails closed to Free.
- Google Play purchase tokens are checked server-side with `purchases.subscriptionsv2.get`. Client purchase data alone never grants access.
- Subscription rows and quota writes are server-only. Do not grant browser roles access to `user_subscriptions`, `ai_usage_events`, or image-translation reservations.
- UI entitlements are for display only. Protected Server Actions, API routes, and database triggers must enforce the same limits independently.
- Current Free limits include 20 active cards, 100 learned cards, 10 daily / 200 monthly chat, Ask, and translation uses, 15 daily AI quiz validations, and 2 total image-text translations. Basic raises AI limits to 30 daily / 900 monthly and removes card-count limits; image-text translation remains capped at 2. Pro has unlimited AI and image-text translations. Verify these against `src/features/subscriptions/subscription-limits.ts` before changing this checklist.

## Deployment gate

Before enabling paid plans or deploying subscription changes:

1. Run the targeted subscription, card-limit, theme, game, and AI quota tests; run typecheck, lint, and the production build.
2. Apply `supabase/migrations/20261024233100_subscription_entitlement_expiry_and_image_quota_reservations.sql` through the approved production migration process. Do not hand-edit production grants or entitlement rows.
3. Confirm the migration's fail-fast checks pass. Verify anon cannot execute public `SECURITY DEFINER` reward functions, authenticated users cannot write protected `user_profiles` columns, and browser roles cannot access subscription or quota tables/functions.
4. Verify `enforce_user_card_subscription_limits` uses the expiry-aware plan helper, checks transitions into both `active` and `learned`, and shares the per-user advisory lock with `add_user_cards_with_active_limit`.
5. Verify `image_text_translation_reservations` exists, has RLS enabled, and is accessible only to `service_role` through the Data API.
6. Review Supabase Security Advisor findings. Treat expected service-only tables with RLS and no client policies as private by design; investigate all public function execution or unexpected client write grants.

### Production migration-history warning

The production project had no `supabase_migrations.schema_migrations` table before this migration. Supabase now records version `20261024233100`, but the older migration files in this repository are not represented in production history. Do not run `supabase db push` until the existing production schema and every historical migration have been reconciled; otherwise the CLI may try to replay old migrations against already-existing objects. Check `supabase migration list` before any future schema deployment.

## Production configuration

Set these server-side secrets in the production environment; never expose them through `NEXT_PUBLIC_` variables:

- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON`
- `GOOGLE_PLAY_RTDN_AUDIENCE`
- `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL`
- `NEXT_PUBLIC_SITE_URL` with the canonical production origin

The Google Play service account must be authorized for the Play Console app and Android Publisher API. Configure a Pub/Sub push subscription for the Play Console RTDN topic targeting `https://www.foxiesdeck.com/api/google-play/rtdn`, with an authenticated OIDC token whose service-account email and audience exactly match the server secrets.

## Smoke tests after every deploy

- Free users can open pricing and see Free limits; Basic/Pro users get limits from the verified database entitlement.
- A fake, malformed, expired, or missing `ends_at` never grants paid access, even if the row says `active`.
- A verified purchase and purchase restore grant access only after Google verification; cancellation retains access only through the verified expiry.
- Free users cannot exceed 20 active or 100 learned cards through single adds, batch adds, direct status updates, or concurrent requests. Paid users are not blocked by those caps.
- Free AI chat/Ask/translation, quiz-validation, and image-translation quotas are enforced server-side under concurrent requests. Failed image translation releases its reservation; successful completion consumes it once.
- Free users cannot persist paid themes, access paid game levels, or delete an account with an effective paid subscription. Client/local-storage changes must not bypass the server checks.
- Send a test RTDN message. Verify `/api/google-play/rtdn` authenticates the OIDC token, records the message, deduplicates retries, and refreshes the entitlement from Google.
- A time-bounded admin grant produces access only until its stored future expiry.

## Reconcile a subscription incident

1. Confirm the signed-in Supabase user and locate their `user_subscriptions` row without exposing purchase tokens in logs or chat.
2. Verify the purchase token and SKU against Google Play using the server-side verification flow. Confirm the package, plan, billing period, status, and expiry.
3. Use the authenticated purchase-restore flow or the verified RTDN sync to persist Google's returned state. Never set `plan` or `status` to paid manually based only on a stale database row or client claim.
4. For rows with missing or expired `ends_at`, keep access Free until Google confirms a valid future expiry. Then rerun the entitlement and restriction smoke tests.
5. Record the incident, verified outcome, and operator without copying raw purchase tokens into logs.

## Monitoring and incident response

- Alert on `/api/google-play/rtdn` 401/5xx responses and processing errors in `google_play_rtdn_events`.
- After sending a known test notification, confirm it appears exactly once and is marked processed. An empty event table alone does not prove Pub/Sub is healthy.
- Periodically inspect paid-looking rows with missing/past `ends_at`, and confirm they fail closed until Google re-verification.
- On entitlement discrepancies, preserve relevant error metadata, stop manual plan edits, verify the Google source of truth, apply the smallest verified reconciliation, then rerun the smoke tests.
