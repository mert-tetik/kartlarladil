# Supabase Notes

The app currently keeps card inventory in localStorage, but Supabase Auth is wired for email/password sessions.
The database schema is prepared for profile, inventory, and practice data.

## Environment variables

Copy `.env.example` to `.env.local` when a Supabase project is available:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only.

The public URL and publishable key can be used in the browser. The service role key is only for server actions such as
permanent account deletion and must never be prefixed with `NEXT_PUBLIC_`.

## Auth routes

- `/login`: email/password login.
- `/register`: email/password registration.
- `/reset-password`: sends a password reset email.
- `/account/update-password`: authenticated password update target.
- `/account/settings`: profile settings and permanent account deletion.
- `/auth/callback`: PKCE callback that exchanges the Supabase code for a cookie-backed session.

Guest users are redirected to `/register?next=...` when they attempt user-owned write actions such as adding a card,
recording quiz progress, or resetting inventory. The `next` value is limited to internal app paths.

When no `next` is provided, login/register redirect to `/kesfet`. Registration asks for preferred language and tier;
those values seed `user_profiles.preferred_language_code` and `user_profiles.preferred_tier`.

Configure these redirect URLs in the Supabase Dashboard:

```text
http://localhost:3000/auth/callback
http://localhost:3000/account/update-password
```

Add production equivalents before deploying.

## Schema

The initial schema is in `supabase/migrations/0001_initial_schema.sql`.

Tables:

- `languages`: public language metadata.
- `cards`: public vocabulary catalog, including stable `source_key`, `examples jsonb`, and `grammar jsonb`.
- `user_profiles`: private per-user profile/preferences row, including preferred language and tier.
- `user_cards`: authenticated user inventory and progress.
- `practice_attempts`: quiz answer history.

## RLS policy

Languages and catalog cards are public read data. User profile, inventory, and attempts are private to the authenticated owner via `(select auth.uid()) = user_id`.

The migration also grants the expected table privileges to `anon` and `authenticated`. Supabase projects may still require checking the Data API exposure settings before the REST API can read newly created tables.

## Card detail payloads

`cards.source_key` is the stable import key from the app catalog, such as `en-a1-isim-apple`. Supabase keeps `cards.id` as the UUID primary key; user inventory references that UUID through `user_cards.card_id`.

`cards.term` should stay single-word-only. Phrases, generated usage contexts, and sentence patterns should be imported as examples or future phrase-specific data, not as vocabulary card terms.

`cards.examples` should be an array of five objects matching `CardExample`: context, label, target-language sentence, and Turkish translation.

`cards.grammar` should match `GrammarGuide`: summary, rules, details, and optional table objects. Russian verbs should include present/future and past-tense table rows when available.

## Future repository switch

The local implementation should be replaced behind the existing repository interfaces:

- `CardRepository`
- `InventoryRepository`

Do not call Supabase directly from route components. Keep Supabase access in `src/lib/supabase` and repository modules.
