import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getMetaAndroidConfig, META_ANDROID_SDK_VERSION } from "./meta-android-config.mjs";

describe("Android Meta App Events configuration", () => {
  it("keeps the SDK pinned and disabled when credentials are absent", () => {
    expect(META_ANDROID_SDK_VERSION).toBe("19.0.1");
    expect(getMetaAndroidConfig({ environment: {}, envFilePath: path.join(os.tmpdir(), "missing-meta-env.local") })).toEqual({
      enabled: false,
      appId: "",
      clientToken: "",
    });
  });

  it("reads both credentials from the local env file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "foxiesdeck-meta-config-"));
    const envFilePath = path.join(tempDir, ".env.local");
    fs.writeFileSync(
      envFilePath,
      "META_APP_ID=123456789\nMETA_CLIENT_TOKEN=local-client-token\n",
      "utf8",
    );

    try {
      expect(getMetaAndroidConfig({ environment: {}, envFilePath })).toEqual({
        enabled: true,
        appId: "123456789",
        clientToken: "local-client-token",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("requires the app ID and client token as a pair", () => {
    expect(() => getMetaAndroidConfig({
      environment: { META_APP_ID: "123456789" },
      envFilePath: path.join(os.tmpdir(), "missing-meta-env.local"),
    })).toThrow(/must be configured together/u);
  });

  it("rejects a non-numeric Meta app ID", () => {
    expect(() => getMetaAndroidConfig({
      environment: { META_APP_ID: "not-an-app-id", META_CLIENT_TOKEN: "client-token" },
      envFilePath: path.join(os.tmpdir(), "missing-meta-env.local"),
    })).toThrow(/must contain only digits/u);
  });

  it("gives process environment values precedence over the local env file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "foxiesdeck-meta-config-"));
    const envFilePath = path.join(tempDir, ".env.local");
    fs.writeFileSync(
      envFilePath,
      "META_APP_ID=file-id\nMETA_CLIENT_TOKEN=file-token\n",
      "utf8",
    );

    try {
      expect(getMetaAndroidConfig({
        environment: { META_APP_ID: "987654321", META_CLIENT_TOKEN: "env-token" },
        envFilePath,
      })).toEqual({
        enabled: true,
        appId: "987654321",
        clientToken: "env-token",
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
