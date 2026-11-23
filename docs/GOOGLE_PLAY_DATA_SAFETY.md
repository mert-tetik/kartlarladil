# Google Play Data Safety Guide

This guide describes the data flows used by the FoxiesDeck Trusted Web Activity (TWA) and helps keep the Google Play Console Data safety declaration aligned with the application.

## Account creation and deletion

FoxiesDeck supports both account creation and account deletion:

- Account creation is available through email/password and Google OAuth.
- Account deletion is available from `/account/settings` after the user confirms the action.
- Deletion removes the Supabase auth user and user-owned application records, subject to provider and legal retention requirements.

In Play Console, declare:

```text
Account creation → Yes
Account deletion → Yes
```

## Data collected or linked to a user

| Data type | Purpose | Collection/source | User control |
|-----------|---------|------------------|--------------|
| Email address and account identifiers | Authentication, recovery, account management | Registration or Google OAuth | Account settings and account deletion |
| Profile information | Display name, profile image, preferences, optional leaderboard identity | User profile and onboarding | Edit profile or disable leaderboard visibility |
| App interactions and learning progress | Cards, custom cards, quiz answers/results, points, gems, streaks, medals, rank and game progress | Generated while using the app | Account deletion removes application records |
| AI-provided content | AI chat, Ask, text/image translation, OCR, custom cards and answer validation | User-submitted text, images and answers | User chooses whether to use the feature; image input is processed temporarily |
| Push notification data | Deliver inactivity notifications and record delivery/open status | Browser/WebView push permission and subscription | Enable/disable notifications in account settings |
| Leaderboard data | Show opted-in display name, profile image and points/streak/medal standings | User profile and progress | Leaderboard visibility is opt-in |
| Purchase history and subscription identifiers | Verify and restore Google Play entitlements | Google Play Billing and server verification | Account deletion removes app-side records; Google Play policies also apply |
| Device/app interaction data | Firebase/Google Analytics and Meta App Events for analytics, ad measurement, performance and product improvement | TWA analytics bridge and native analytics flow | Governed by native analytics settings and platform controls; Meta/Advertising ID collection is enabled only in Meta-configured Android builds |
| App info and performance — diagnostics | Automatically collected, account-linked summaries of startup/loading-stage duration, page-transition duration, sampled average frame rate and slow-frame counts | Android native launcher plus the authenticated `/api/analytics/performance` endpoint; persisted in `user_performance_summaries` | Automatic for authenticated Android app use; account deletion removes these summaries |
| Device information for diagnostics | Manufacturer/model, Android release/API level, app version, and Android System WebView package/version; no IMEI, Android ID, Advertising ID, or other hardware identifier is sent by this feature | Android native bridge; metadata is grouped by an environment hash and attached to the authenticated account | Automatic for authenticated Android app use; account deletion removes the related records |

## Analytics

The TWA/native application uses Firebase/Google Analytics and, when the Android Meta credentials are configured, Meta App Events. The web application sends selected app-open, screen-view, authentication, onboarding, interaction, progress, learning, subscription and product-use events through the `foxiesdeck://event` analytics bridge. The bridge continues to send the authenticated application user identifier only to the existing Firebase path; the Meta path explicitly drops it and does not receive email addresses.

Performance diagnostics are a separate, automatically collected, account-linked feature and are not sent through the Firebase/Meta event bridge. No separate in-app permission screen is shown for this collection. The server derives the account from the authenticated session; the client cannot select a different account. The server stores only per-environment high-water summaries for startup/navigation/loading phases and a duration-weighted FPS average, not a row per app launch. The environment grouping uses the listed software/device-version fields; the feature does not collect card/chat content, URLs or query strings, email, location, or a unique device identifier. Account deletion cascades the related performance summaries.

For Google Play's Data safety form, declare the collected diagnostics under **App info and performance → Diagnostics**. Device model and OS/app version are provided as environment context for the automatic diagnostic purpose. Recheck the exact current Play Console categories and the production build before release.

This is separate from web analytics cookies: FoxiesDeck does not use analytics or advertising cookies in the web UI.

## Sensitive data

FoxiesDeck does not intentionally collect precise location, contacts, health information, or financial card details. User-provided images are sent to OpenAI only for the requested OCR/translation operation and are not kept as a permanent image archive by FoxiesDeck.

## Third-party services

- Supabase: authentication, sessions and application database.
- OpenAI: AI chat, OCR, translation, custom-card generation and answer validation.
- Google: OAuth, Google Play Billing and Firebase/Google Analytics.
- Meta: Meta App Events for mobile advertising measurement and campaign optimization when configured.
- Vercel: application hosting and technical infrastructure.

## Security and deletion

- All traffic is served over HTTPS.
- Service-role keys and API keys remain server-side.
- Account deletion is linked from `/account/settings`.
- Provider-specific retention rules and legally required records may survive application-side deletion.

Before publishing, verify that the Play Console declaration matches the production build and that `/privacy` is live on the production domain.
