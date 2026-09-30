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
      expect(patchedGradle).toContain("id 'com.google.gms.google-services'");
      expect(patchedGradle).toContain("implementation 'com.google.firebase:firebase-analytics'");
      expect(patchedManifest).toContain('android:name="com.example.app.Application"');
      expect(patchedManifest).toContain('android:name="androidx.core.content.FileProvider"');
      expect(fileProviderPaths).toContain('path="camera/"');
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
