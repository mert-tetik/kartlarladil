# Profile bootstrap monitoring

## Retrospective investigation: 17 November 2026 (Europe/Istanbul)

The production Auth and profile data currently show 10 accounts created that day without a `user_profiles` row. All 10 used Google; 8 had a recorded sign-in. Their currently stored Google name candidates satisfy the database's 2–80 character constraint. Those 10 accounts have no `user_cards` or `practice_attempts` rows.

The Auth logs contain Google login events for the cohort, but the historical application logs do not record profile-bootstrap attempts or their outcomes. The Auth audit table has no entries for that date. Postgres did log `user_profiles_display_name_check` violations during the same day, but the database logs do not expose bind values or a user identifier that can link those violations to these 10 accounts. Therefore that constraint error is not proven to be the cause of the 10 missing rows.

The code path that can leave the gap is the native Google handoff: the app exchanges the OAuth code in its existing WebView; when the post-login destination is still `/`, navigation updates browser history without requesting the server route again. The initial native root render intentionally skips server-side profile bootstrap, and the client's profile sync previously only selected an existing row. This is a concrete missing-bootstrap path consistent with the Google-only cohort, though it cannot prove each historical account followed that exact navigation path.

## Safeguards and evidence going forward

- Every server-side bootstrap attempt emits a structured `profile_bootstrap` event with a source, a one-way user fingerprint, a safe error code/category, and display-name source/length only. Email, display name, SQL detail, and provider tokens are never logged.
- Native/client session restoration calls `/api/auth/profile-bootstrap` when the profile query succeeds but returns no row. Database read errors are kept distinct from a genuinely missing row.
- New display names are checked using Unicode character counts before insertion, matching the database's 2–80 character constraint.
- `/api/internal/profile-bootstrap-health` scans Auth users against profile rows daily. It gives a new account a 15-minute creation grace period; older missing rows are logged as errors with opaque fingerprints and produce HTTP 503 so they are visible as failed health runs.
- Vercel Cron is configured for 03:30 UTC daily. Cron routes run on production deployments and use `CRON_SECRET` as a Bearer token. Confirm `CRON_SECRET` is configured in the Vercel production environment, then use Vercel Observability/log alerts on `profile_health_scan_found_missing_profiles` and `profile_health_scan_failed` for notification.

Useful structured events: `profile_missing_attempting_create`, `profile_created`, `profile_create_failed`, `profile_read_failed`, `profile_create_race_recovered`, and `profile_health_scan_found_missing_profiles`.
