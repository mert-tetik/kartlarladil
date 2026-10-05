# Android app / hybrid TWA build

FoxiesDeck keeps the website as the remotely served application UI, while the
Android release uses a native WebView shell. Local UI media is packaged in a
Play Asset Delivery install-time asset pack and transparently served through
the WebView request interceptor.

## What is included

- Next.js remains the source of truth for UI and server features.
- `public/` media and `.next/static/media/` media are indexed and copied into
  the `ui_media` install-time asset pack.
- The native WebView intercepts same-origin image, font, audio and video
  requests and serves matching files from the installed asset pack.
- Asset resolution is local-first: an indexed and readable AAB asset is
  returned directly by the native interceptor, without a web request. If the
  old AAB does not contain a newly deployed media path, or its local copy is
  unreadable, the interceptor returns control to WebView and the exact same
  URL is loaded from the website as a remote fallback. The native logcat tag
  `FoxiesDeckMedia` reports both local serving and fallback decisions.
- External links and OAuth provider pages open in the system browser; the
  native billing bridge is not exposed to arbitrary external documents.
- The existing Ask/AI Practice microphone flow can request Android audio
  permission, but only for the trusted FoxiesDeck origin.
- Video byte ranges are supported, so seeking and browser media buffering work
  without downloading the media from the website.
- The remote website is still loaded for HTML, API calls, authentication and
  future website updates.
- Google Play Billing 8.0.0 is exposed through the native bridge for the
  Android app; server-side purchase verification remains in the web app.
- Android WebView does not expose the browser Web Speech Synthesis API, so
  card and chat pronunciation uses the native Android Text-to-Speech bridge in
  the app; normal browsers keep using `speechSynthesis`.

## Firebase Analytics

- The Android shell includes Firebase Analytics. Native review/event callbacks
  are sent by `EventReceiverActivity`.
- The matching Android `google-services.json` belongs at
  `com.foxiesdeck/app/google-services.json`. The generated Android project is
  ignored by Git, so keep this file backed up locally. `pwa:init` preserves and
  validates its Android app ID and required Firebase identifiers. The optional
  `services.analytics_service` metadata is not used to infer whether Analytics
  is enabled; confirm that separately in Firebase Console.
- Analytics must also be enabled for the Firebase project in Firebase Console;
  successful Gradle configuration alone cannot prove event delivery. Verify a
  Play-installed test build in Firebase Analytics DebugView before treating
  runtime collection as confirmed.
- Advertising-ID collection is disabled and the merged manifest removes the
  Advertising ID permissions. The app does not use ads; do not declare that it
  uses the Advertising ID in Play Console unless that changes.

## Build the website

```bash
npm run build
```

The production web build must be available at `https://www.foxiesdeck.com`.

## Initialize or refresh the Android project

```bash
npm run pwa:init
```

The generated Android project is kept locally in `com.foxiesdeck/`. The
repository-owned patcher then applies API 36, Billing 8, the hybrid WebView,
and the `ui_media` asset pack configuration.

The current release defaults are `com.LigidTools.Glidecore`, version name
`4.3.28`, and version code `142`. They can be overridden for a release with:

```bash
TWA_PACKAGE_ID=com.LigidTools.Glidecore
TWA_VERSION_CODE=141
TWA_VERSION_NAME=4.3.28
```

Keep the signing keystore and its passwords safe. Losing the original signing
identity prevents future Google Play updates.

## Build the APK / AAB

```bash
npm run pwa:build
```

The command performs all of the following:

1. Builds a fresh Next.js production output.
2. Reapplies the Android/Play compatibility patch.
3. Scans current web media and regenerates the asset index.
4. Builds the signed AAB and a signed universal APK that includes the
  install-time media pack for direct installation.
5. Verifies that the manifest and Gradle version metadata match.
6. Validates the AAB with bundletool, verifies the universal APK signature, and
   checks that every indexed media asset is present in the AAB asset pack.

The build needs `bundletool-all-1.18.3.jar`. Set `BUNDLETOOL_JAR` to its path,
or place that file in the system temporary directory.

Outputs:

- `com.foxiesdeck/app-release-signed.apk` — universal direct-install APK with
  the bundled media included.
- `com.foxiesdeck/app-release-base-signed.apk` — base WebView shell only; it
  does not contain the install-time asset pack and is not the public download.
- `com.foxiesdeck/app-release-bundle.aab` — Google Play upload.

The website's `/get-the-app` route sends users to the Google Play listing. The
universal APK remains a local direct-install/test artifact and is not copied
into the website's static output.

## Domain verification

`src/app/.well-known/assetlinks.json/route.ts` serves the Digital Asset Links
file. It must remain reachable without redirects at:

```text
https://www.foxiesdeck.com/.well-known/assetlinks.json
```

The current package is `com.LigidTools.Glidecore`. The Play app-signing
certificate fingerprint and the local upload-key fingerprint must both be
present in the production response.

## Release checklist

- Run `npm run build` and `npm run typecheck`.
- Deploy the resulting Next.js build to `https://www.foxiesdeck.com` and
  verify the live HTML before building the Android artifact. The Android shell
  loads this remote HTML at startup.
- Run `npm run pwa:build`.
- Validate the AAB with bundletool and install it on an Android 16 device or
  emulator.
- After the remote page has loaded, disable network access and confirm that at
  least one image and one video still come from the local asset pack. A cold
  launch still needs network access for the remote HTML and API layer.
- Upload the AAB to Play Internal Testing before production.
- From the Play-installed build, test Google OAuth, subscription purchase and
  restore, speech, deep links and a website-only update.

## Notes

- Media added or replaced in the website is included in the next AAB build.
- A public media path whose filename stays the same is intentionally served
  from the installed package until the next AAB update; publish a new AAB when
  replacing such a file. Next.js imported media normally gets a new hashed URL
  automatically.
- A changed filename is treated as a new asset; old files are not served
  unless they still exist in the current media index.
- Install-time asset packs are downloaded by Google Play during installation,
  so the first install still needs network access and sufficient free storage.
  When an install-time download is larger than 200 MB, Google Play may require
  Wi-Fi or an explicit user confirmation before continuing over mobile data;
  this is a Play delivery rule, not a WebView media-cache failure.
- The native Text-to-Speech engine still requires the requested language voice
  data to be installed on the device; after that, pronunciation does not use
  the website or a media download.
- This is also valid for a non-game app: Google Play documents Play Asset
  Delivery for apps over 200 MB, with install-time packs available at launch.
  The current pack is approximately 234 MB including the packaged UI media.
- The Android package identity must not be changed for an update release.
