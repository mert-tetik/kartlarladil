# Android app / hybrid TWA build

FoxiesDeck keeps the website as the remotely served application UI, while the
Android release uses a native WebView shell. Local UI media is packaged in a
Play Asset Delivery install-time asset pack and transparently served through
the WebView request interceptor.

## Separate website and AAB logos

The website branding, favicon, web/PWA metadata, and website-generated social
visuals use `public/AppLogdfo.png`.

The Android/AAB launcher icon is intentionally separate and must use only
`public/AppLogo2.png`. `AppLogdfo.png` must never be used for the AAB launcher,
maskable icon, or Android fallback densities. `scripts/init-twa.mjs` overrides
the icon read from the website manifest, and `scripts/generate-launcher-icons.mjs`
is the single Android resource-generation path; it always reads
`public/AppLogo2.png`.

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
- The offline route is a bundled static shell at `public/offline-shell/` and
  is copied into the install-time asset pack by `pwa:prepare`. Keep its
  JavaScript and IndexedDB/localStorage fallback self-contained: the language
  picker, saved-card status filters, notes and draft cleanup must work after a
  cold offline launch without a network request. When changing this shell,
  verify the real-card path on a mobile WebView; do not rely only on the
  visual-test fixture, which intentionally bypasses storage reads.
- Google Play Billing 8.0.0 is exposed through the native bridge for the
  Android app; server-side purchase verification remains in the web app.
- Android WebView does not expose the browser Web Speech Synthesis API, so
  card and chat pronunciation uses the native Android Text-to-Speech bridge in
  the app; normal browsers keep using `speechSynthesis`.

## Native launch transition

The Android launch surface is intentionally independent of WebView. The
system/native launch surface first shows `public/splash.png`, then the native
`NativeLoadingIndicatorView` takes over with the same orange background and
three-dot loading animation used by the app. The overlay stays above WebView
until `onPageCommitVisible`, preventing a black or blank handoff while the web
document starts.

`AppImageCacheGate` still warms the TWA image cache, but does not render a
second WebView loading overlay in the Android app. The source template and
`scripts/patch-generated-android.mjs` must remain the authority for this flow;
do not edit only the ignored `com.foxiesdeck/` generated project.

## Black system bars

The Android status bar and navigation bar must remain black throughout the
application, including while the orange native splash and three-dot loader are
visible. The orange launch surface belongs only to the inset app-content area.
This is important for target API 36, where Android enforces edge-to-edge and
legacy bar-color calls alone may be ignored. `LauncherActivity` therefore keeps
the root background black, applies vertical system-bar insets before laying out
the orange overlay/WebView, disables light system-bar icons and navigation-bar
contrast enforcement, and the generated theme also declares both bar colors as
black. Preserve these settings in every future AAB build; do not copy only the
generated `com.foxiesdeck/` project.

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

All Android AAB builds must use `minSdkVersion 24` or higher. This is required
by Google Play automatic protection; a bundle with minimum SDK 21 must not be
uploaded. The build patcher enforces `minSdk 24` on every generated project.

The current release defaults are `com.LigidTools.Glidecore`, version name
`4.3.49`, and version code `163`. They can be overridden for a release with:

```bash
TWA_PACKAGE_ID=com.LigidTools.Glidecore
TWA_VERSION_CODE=163
TWA_VERSION_NAME=4.3.49
```

All signed Android/AAB builds must use exactly
`C:\Users\CASPER\user.keystore` with alias `yeiexl`. Never use the generated
`com.foxiesdeck/android.keystore` or create a replacement key: losing the
original signing identity prevents future Google Play updates. The password is
kept only in the local ignored credential file/environment and must never be
committed or printed.

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

The release manifest must report `minSdkVersion 24` or higher before upload.

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
- On the installed build, verify that both system bars stay black during the
  native splash, the three-dot loader, and the loaded app; the orange surface
  must not extend behind either bar.
- After the remote page has loaded, disable network access and confirm that at
  least one image and one video still come from the local asset pack. A cold
  launch still needs network access for the remote HTML and API layer.
- From the offline route on a mobile WebView, confirm that the card-language
  picker and both saved-card status filters respond with cached card data, and
  that closing the notes-conversion menu removes non-pending local notes and
  generated drafts while pending deck additions can still finish in the
  background.
- Verify the no-network flow on the installed AAB, not only in a desktop
  browser: the offline shell, its JavaScript and all 14 language flags are
  packaged locally. Updating the website alone cannot update these local
  assets; install a newly generated AAB to test shell changes. Do not build an
  AAB until the release is explicitly requested.
- Upload the AAB to Play Internal Testing before production.
- From the Play-installed build, test Google OAuth, subscription purchase and
  restore, speech, deep links and a website-only update.

## Notes

- Media added or replaced in the website is included in the next AAB build.
- The standalone offline UI is copied from `public/offline-shell/` into the
  generated Android project, while its language flags are included in the UI
  media asset pack. Changes to either source require a new AAB; an ordinary web
  deployment cannot replace assets served by the installed app while offline.
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
