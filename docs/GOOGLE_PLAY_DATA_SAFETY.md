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
| Device/app interaction data | Firebase/Google Analytics, performance and product improvement | TWA analytics bridge and native analytics flow | Governed by the native analytics settings and platform controls |

## Analytics

The TWA/native application uses Firebase/Google Analytics. The web application sends selected app-open, screen-view, interaction, progress, error/performance and product-use events through the `foxiesdeck://event` analytics bridge. The bridge may also send the authenticated application user identifier to the native analytics layer.

This is separate from web analytics cookies: FoxiesDeck does not use analytics or advertising cookies in the web UI.

## Sensitive data

FoxiesDeck does not intentionally collect precise location, contacts, health information, or financial card details. User-provided images are sent to OpenAI only for the requested OCR/translation operation and are not kept as a permanent image archive by FoxiesDeck.

## Third-party services

- Supabase: authentication, sessions and application database.
- OpenAI: AI chat, OCR, translation, custom-card generation and answer validation.
- Google: OAuth, Google Play Billing and Firebase/Google Analytics.
- Vercel: application hosting and technical infrastructure.

## Security and deletion

- All traffic is served over HTTPS.
- Service-role keys and API keys remain server-side.
- Account deletion is linked from `/account/settings`.
- Provider-specific retention rules and legally required records may survive application-side deletion.

Before publishing, verify that the Play Console declaration matches the production build and that `/privacy` is live on the production domain.
