# Trusted Web Activity (TWA) / Android APK

This project is configured as a Progressive Web App (PWA). You can wrap it in a Trusted Web Activity and publish it on Google Play or distribute the APK directly.

## What is already configured

- `@ducanh2912/next-pwa` generates a service worker at build time.
- `src/app/manifest.ts` exposes a web app manifest.
- `public/icon-192.png`, `public/icon.png` and `public/icon-maskable.png` cover launcher icon requirements.
- `src/app/.well-known/assetlinks.json/route.ts` serves the Digital Asset Links file for domain verification.

## Build the site

Production build uses webpack because next-pwa relies on webpack:

```bash
npm run build
```

The generated service worker files (`sw.js`, `workbox-*.js`) are created in `public/` during the build and ignored by Git.

## Generate / refresh icons

If you change `public/icon.png`, regenerate the PWA icon variants:

```bash
npm run pwa:icons
```

## Install Bubblewrap (one time)

Bubblewrap CLI is already installed globally via `npm install -g @bubblewrap/cli`.

On first run it may ask to install the JDK and Android SDK. Since this machine already has JDK 17, you can let it detect it or install its own copy interactively.

## Initialize the Android project

Run the init command and answer the interactive prompts:

```bash
npm run pwa:init
```

This creates a new directory with the Bubblewrap project (`twa-manifest.json`, signing keys, etc.).

## Build the APK / AAB

```bash
npm run pwa:build
```

Outputs:

- `app-release-signed.apk` — installable APK for testing
- `app-release-bundle.aab` — upload bundle for Google Play

## Domain verification (hide the browser address bar)

After `bubblewrap init`, Bubblewrap prints a **Digital Asset Links** JSON snippet.

1. Copy the `sha256_cert_fingerprints` value and package name.
2. Set them in your environment:

```bash
TWA_PACKAGE_NAME=com.yourpackage.name
TWA_SHA256_FINGERPRINT=AA:BB:CC:...
```

3. Redeploy the site so that `/.well-known/assetlinks.json` returns the correct content.
4. Rebuild the APK/AAB and reinstall.

## Chrome enforcement

The launcher activity is customized to force Chrome as the TWA provider:

- `LauncherActivity.createTwaLauncher()` is overridden to pass `com.android.chrome` as the provider package. This prevents Samsung devices from opening the app in Samsung Internet even when Chrome is installed.
- If Chrome is not installed, the app shows a toast and redirects the user to the Google Play Store to install Chrome instead of launching.
- `AndroidManifest.xml` declares a `<queries>` block limited to `com.android.chrome` and keeps `DelegationService` always enabled/exported.

When a `clientAppUnavailable` error is returned by Google Play Billing inside the TWA, the pricing UI shows a localized message asking the user to set Google Chrome as the default browser and try again.

## Notes

- The site must be served over HTTPS.
- `assetlinks.json` must be accessible without redirects and with `Content-Type: application/json`.
- Keep the Bubblewrap signing keystore safe; losing it prevents future updates on Google Play.
