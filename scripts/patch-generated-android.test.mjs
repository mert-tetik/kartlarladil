import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateGoogleServicesConfig } from "./google-services-config.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const validConfig = JSON.stringify({
  project_info: { project_id: "foxiesdeck-test" },
  client: [{
    client_info: {
      mobilesdk_app_id: "1:123456789:android:abcdef123456",
      android_client_info: { package_name: "com.example.app" },
    },
    api_key: [{ current_key: "test-key" }],
  }],
});

describe("google-services.json validation", () => {
  it("accepts config for the Android application ID", () => {
    expect(validateGoogleServicesConfig(validConfig, "com.example.app")).toEqual({
      projectId: "foxiesdeck-test",
      packageName: "com.example.app",
    });
  });

  it("rejects config for a different Android package", () => {
    expect(() => validateGoogleServicesConfig(validConfig, "com.other.app")).toThrow(
      /missing a valid Android app configuration/u,
    );
  });

  it("accepts a valid app config without optional Analytics service metadata", () => {
    expect(validateGoogleServicesConfig(validConfig, "com.example.app").packageName).toBe(
      "com.example.app",
    );
  });

  it("rejects malformed config", () => {
    expect(() => validateGoogleServicesConfig("not-json", "com.example.app")).toThrow(
      /not valid JSON/u,
    );
  });
});

describe("reproducible Android Firebase bootstrap", () => {
  it("includes the Firebase-enabled Application in generated Android sources", () => {
    const patcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "patch-generated-android.mjs"),
      "utf8",
    );
    expect(patcherSource).toMatch(/ANDROID_JAVA_TEMPLATE_FILES\s*=\s*\[[\s\S]*?"Application\.java"/u);

    const applicationTemplate = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "Application.java"),
      "utf8",
    );

    expect(applicationTemplate).toContain("package __PACKAGE__;");
    expect(applicationTemplate).toContain("FirebaseApp.initializeApp(this);");
    expect(applicationTemplate).toContain("FirebaseAnalytics.getInstance(this)");
    expect(applicationTemplate).toContain("FirebaseAnalytics.Event.APP_OPEN");
    expect(applicationTemplate).toContain("ProcessLifecycleOwner.get().getLifecycle().addObserver");

    const webViewClientSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LocalMediaWebViewClient.java"),
      "utf8",
    );
    expect(webViewClientSource).toContain("NativeAnalyticsReceiver.class");
    expect(webViewClientSource).toContain("activity.sendBroadcast(analyticsIntent)");
    expect(webViewClientSource).toContain("EventReceiverActivity.class");
  });

  it("copies Firebase initialization into a clean generated Android project", () => {
    const tempRoot = path.resolve(os.tmpdir());
    const projectDir = fs.mkdtempSync(path.join(tempRoot, "foxiesdeck-firebase-patcher-"));

    try {
      fs.mkdirSync(path.join(projectDir, "app"), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, "app", "build.gradle"),
        `android {\n    namespace "com.example.app"\n    defaultConfig {\n        applicationId "com.example.app"\n        minSdkVersion 24\n        versionCode 7\n        versionName "1.2.3"\n    }\n}\n`,
      );
      fs.writeFileSync(
        path.join(projectDir, "build.gradle"),
        "buildscript { dependencies { classpath 'com.android.tools.build:gradle:8.9.1' } }\n",
      );
      fs.writeFileSync(path.join(projectDir, "app", "google-services.json"), validConfig);

      execFileSync(
        process.execPath,
        [path.join(PROJECT_ROOT, "scripts", "patch-generated-android.mjs")],
        {
          cwd: PROJECT_ROOT,
          env: { ...process.env, TWA_PROJECT_DIR: projectDir },
          stdio: "pipe",
        },
      );

      const packageJavaDir = path.join(
        projectDir,
        "app",
        "src",
        "main",
        "java",
        "com",
        "example",
        "app",
      );
      const applicationSource = fs.readFileSync(path.join(packageJavaDir, "Application.java"), "utf8");
      const nativeLoadingCatalogSource = fs.readFileSync(
        path.join(packageJavaDir, "NativeLoadingCatalog.java"),
        "utf8",
      );
      const patchedGradle = fs.readFileSync(path.join(projectDir, "app", "build.gradle"), "utf8");
      const patchedManifest = fs.readFileSync(
        path.join(projectDir, "app", "src", "main", "AndroidManifest.xml"),
        "utf8",
      );
      const fileProviderPaths = fs.readFileSync(
        path.join(projectDir, "app", "src", "main", "res", "xml", "file_paths.xml"),
        "utf8",
      );

      expect(applicationSource).toContain("package com.example.app;");
      expect(applicationSource).toContain("FirebaseApp.initializeApp(this);");
      expect(applicationSource).toContain("FirebaseAnalytics.Event.APP_OPEN");
      expect(nativeLoadingCatalogSource).toContain("random.nextInt(index + 1)");
      expect(nativeLoadingCatalogSource).toContain("Foxy is getting ready to open");
      expect(nativeLoadingCatalogSource).toContain("new String[Math.min(8, candidates.length)]");
      expect(patchedGradle).toContain("id 'com.google.gms.google-services'");
      expect(patchedGradle).toContain("implementation 'com.google.firebase:firebase-analytics'");
      expect(patchedManifest).toContain('android:name="com.example.app.Application"');
      expect(patchedManifest).toContain('android:name="com.example.app.NativeAnalyticsReceiver"');
      expect(patchedManifest).toContain('android:exported="false"');
      expect(patchedManifest).not.toContain('android:host="event"');
      expect(patchedManifest).toContain('android:name="androidx.core.content.FileProvider"');
      expect(patchedManifest).toContain('android:name="android.intent.action.TTS_SERVICE"');
      expect(fileProviderPaths).toContain('path="camera/"');

      const offlineShellSource = path.join(PROJECT_ROOT, "public", "offline-shell");
      const packagedOfflineShell = path.join(projectDir, "app", "src", "main", "assets", "foxiesdeck-offline");
      for (const requiredFile of ["index.html", "offline-shell.js", "card-renderer.js", "card-design.css", "super-water.ttf"]) {
        expect(fs.readFileSync(path.join(packagedOfflineShell, requiredFile)))
          .toEqual(fs.readFileSync(path.join(offlineShellSource, requiredFile)));
      }
    } finally {
      const resolvedProjectDir = path.resolve(projectDir);
      if (!resolvedProjectDir.startsWith(`${tempRoot}${path.sep}`)) {
        throw new Error("Refusing to remove Android test fixture outside the temporary directory.");
      }
      fs.rmSync(resolvedProjectDir, { recursive: true, force: true });
    }
  });
});

describe("Android WebView file input support", () => {
  it("forwards web file inputs to the native picker and returns the selected URIs", () => {
    const launcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LauncherActivity.java"),
      "utf8",
    );

    expect(launcherSource).toContain("onShowFileChooser");
    expect(launcherSource).toContain("fileChooserParams.createIntent()");
    expect(launcherSource).toContain("createCameraCaptureIntent()");
    expect(launcherSource).toContain("FileProvider.getUriForFile");
    expect(launcherSource).toContain("FileChooserParams.parseResult(resultCode, data)");
    expect(launcherSource).toContain("pendingFileChooserCallback.onReceiveValue(null)");

    const patcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "patch-generated-android.mjs"),
      "utf8",
    );
    expect(patcherSource).toContain('android:name="androidx.core.content.FileProvider"');
    expect(patcherSource).toContain('path="camera/"');
  });
});

describe("Native loading visual test mode", () => {
  it("keeps the loading screen visible and advances its cartoon progress states", () => {
    const launcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LauncherActivity.java"),
      "utf8",
    );

    expect(launcherSource).toContain('NATIVE_LOADING_TEST_PARAMETER = "native-loading-test"');
    expect(launcherSource).toContain("beginNativeLoadingVisualTest");
    expect(launcherSource).toContain("NATIVE_LOADING_TEST_STEP_DELAY_MS = 1200L");
    expect(launcherSource).toContain("Foxies are stretching their tails...");
    expect(launcherSource).toContain("Cards are ready to play!");
    expect(launcherSource).toContain("int[] progress = {8, 24, 48, 60, 68, 76, 88, 100}");
  });

  it("passes eight cards into the native renderer and staggers their two groups", () => {
    const launcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LauncherActivity.java"),
      "utf8",
    );
    const indicatorSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "NativeLoadingIndicatorView.java"),
      "utf8",
    );
    const patcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "patch-generated-android.mjs"),
      "utf8",
    );

    expect(launcherSource).toContain('new String[]{"bacteria", "card", "efficiency", "courtesy", "abandon", "ability", "able", "about"}');
    expect(launcherSource).toContain("int count = Math.min(8, cards.length());");
    expect(indicatorSource).toContain("new PathInterpolator(0.68f, 0f, 0.32f, 1f)");
    expect(indicatorSource).toContain("CARD_HOLD_DURATION_MS = 420L");
    expect(indicatorSource).toContain("CARD_MOTION_DURATION_MS = 400L");
    expect(indicatorSource).toContain("CARD_STAGGER_DURATION_MS = 130L");
    expect(indicatorSource).toContain("float enterElapsedMs = elapsedMs");
    expect(indicatorSource).not.toContain(
      "drawLoadingCardAt(canvas, cardBounds, sourceIndex, -travelDistance * easedProgress);\n                drawLoadingCardAt",
    );
    expect(patcherSource).toContain(".slice(0, 8)");
    expect(patcherSource).toContain("String[] translations = new String[8];");
  });
});

describe("Native WebView bootstrap suppression", () => {
  it("only hides the explicit web bootstrap overlay, not fixed app screens using the splash logo", () => {
    const launcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LauncherActivity.java"),
      "utf8",
    );

    expect(launcherSource).toContain("document.querySelectorAll('[data-mobile-gateway-bootstrap]')");
    expect(launcherSource).toContain("node.style.setProperty('display','none','important')");
    expect(launcherSource).not.toContain("document.querySelectorAll('img')");
    expect(launcherSource).not.toContain("source.indexOf('splash.png')");
    expect(launcherSource).not.toContain("getComputedStyle(node).position==='fixed'");
  });
});

describe("Native launch readiness watchdog", () => {
  it("releases the native loader when web readiness signals never arrive", () => {
    const launcherSource = fs.readFileSync(
      path.join(PROJECT_ROOT, "scripts", "android-template", "LauncherActivity.java"),
      "utf8",
    );

    expect(launcherSource).toContain("NATIVE_LAUNCH_READINESS_TIMEOUT_MS = 6500L");
    expect(launcherSource).toContain("nativeLaunchReadinessHandler.postDelayed(");
    expect(launcherSource).toContain("releaseNativeLaunchOverlayAfterTimeout");
    expect(launcherSource).toContain("nativeLoadingEssentialDataReady = true;");
    expect(launcherSource).toContain("nativeLaunchReadinessHandler.removeCallbacks(nativeLaunchReadinessTimeout)");
  });
});
