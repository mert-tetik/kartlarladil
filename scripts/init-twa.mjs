#!/usr/bin/env node
/**
 * Non-interactive TWA project generator for FoxiesDeck.
 *
 * Uses @bubblewrap/core directly to avoid the interactive prompts in
 * `bubblewrap init`. If the production manifest URL is not reachable, it
 * starts a local Next.js server temporarily so icons/manifest can be fetched,
 * while the generated project still points to the production host.
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Config,
  ConsoleLog,
  JdkHelper,
  KeyTool,
  TwaGenerator,
  TwaManifest,
} from "@bubblewrap/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TARGET_HOST = process.env.TWA_HOST || "foxiesdeck.vercel.app";
const TARGET_START_URL = process.env.TWA_START_URL || "/";
const PACKAGE_ID = process.env.TWA_PACKAGE_ID || "com.foxiesdeck";
const PROJECT_DIR = path.resolve(
  process.env.TWA_PROJECT_DIR || path.join(ROOT, "com.foxiesdeck")
);
const MANIFEST_URL =
  process.env.TWA_MANIFEST_URL || `https://${TARGET_HOST}/manifest.webmanifest`;
const LOCAL_PORT = Number(process.env.TWA_LOCAL_PORT || "3000");

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(
      url,
      { method: options.method || "GET", timeout: options.timeout || 10000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchText(new URL(res.headers.location, url).toString(), options));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`Timeout fetching ${url}`)));
    req.end();
  });
}

async function isUrlReachable(url) {
  try {
    await fetchText(url, { method: "HEAD", timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

function startNextServer() {
  console.log(`Starting local Next.js server on port ${LOCAL_PORT}...`);
  // Run Next.js directly through node so the spawned process is the actual
  // server. This makes it possible to terminate it cleanly on Windows.
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const proc = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(LOCAL_PORT)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    }
  );

  proc.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

  const stop = () =>
    new Promise((resolve) => {
      if (proc.killed || proc.exitCode !== null) return resolve();
      proc.on("close", resolve);
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed && proc.exitCode === null) {
          if (process.platform === "win32") {
            try {
              spawn("taskkill", ["/F", "/T", "/PID", String(proc.pid)], {
                stdio: "ignore",
                shell: false,
              });
            } catch {
              // ignore
            }
          } else {
            proc.kill("SIGKILL");
          }
        }
      }, 5000);
    });

  return { proc, stop };
}

async function waitForLocalManifest() {
  const localUrl = `http://127.0.0.1:${LOCAL_PORT}/manifest.webmanifest`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await isUrlReachable(localUrl)) return localUrl;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Local Next.js server did not become ready in time.");
}

async function getManifestUrl() {
  if (await isUrlReachable(MANIFEST_URL)) {
    console.log(`Using production manifest: ${MANIFEST_URL}`);
    return { url: MANIFEST_URL, stop: null };
  }

  console.warn(
    `Production manifest is not reachable: ${MANIFEST_URL}\n` +
      "Falling back to a local Next.js server so the TWA project can still be generated.\n" +
      "The generated Android project will still point to the production host."
  );
  const server = startNextServer();
  try {
    const url = await waitForLocalManifest();
    console.log(`Using local manifest: ${url}`);
    return { url, stop: server.stop };
  } catch (err) {
    await server.stop();
    throw err;
  }
}

function generatePassword(length = 24) {
  // Keep the password shell-safe so it can be passed to apksigner/jarsigner.
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[crypto.randomInt(chars.length)];
  }
  return out;
}

async function loadConfig() {
  const configPath = path.join(os.homedir(), ".bubblewrap", "config.json");
  let config = await Config.loadConfig(configPath);
  if (!config) {
    config = new Config(
      process.env.JDK_PATH || "",
      process.env.ANDROID_SDK_PATH || ""
    );
  }
  if (!config.jdkPath) {
    throw new Error(
      "JDK path not configured. Run `bubblewrap init` interactively once or set JDK_PATH."
    );
  }
  if (!config.androidSdkPath) {
    throw new Error(
      "Android SDK path not configured. Run `bubblewrap init` interactively once or set ANDROID_SDK_PATH."
    );
  }
  return config;
}

async function main() {
  console.log(`TWA project will be created in: ${PROJECT_DIR}`);
  await fs.mkdir(PROJECT_DIR, { recursive: true });

  const config = await loadConfig();
  const { url: manifestUrl, stop: stopServer } = await getManifestUrl();

  try {
    console.log("Fetching manifest and building TWA manifest...");
    const twaManifest = await TwaManifest.fromWebManifest(manifestUrl);

    // Override the host/package so the APK points to production even if we
    // fetched the manifest from a local dev server.
    twaManifest.host = TARGET_HOST;
    twaManifest.startUrl = TARGET_START_URL;
    twaManifest.packageId = PACKAGE_ID;
    twaManifest.signingKey = {
      path: path.join(PROJECT_DIR, "android.keystore"),
      alias: "android",
    };

    // Enable Google Play Billing for the TWA Digital Goods API.
    twaManifest.features = {
      ...twaManifest.features,
      playBilling: { enabled: true },
    };

    const manifestFile = path.join(PROJECT_DIR, "twa-manifest.json");
    await twaManifest.saveToFile(manifestFile);

    console.log("Generating Android project...");
    const log = new ConsoleLog("init");
    const generator = new TwaGenerator();
    await generator.createTwaProject(
      PROJECT_DIR,
      twaManifest,
      log,
      (current, total) => {
        const pct = total ? Math.round((current / total) * 100) : 0;
        if (pct % 10 === 0) console.log(`  Progress: ${pct}%`);
      }
    );

    const manifestContents = await fs.readFile(manifestFile);
    const checksum = crypto
      .createHash("sha1")
      .update(manifestContents)
      .digest("hex");
    await fs.writeFile(
      path.join(PROJECT_DIR, "manifest-checksum.txt"),
      checksum
    );

    const jdkHelper = new JdkHelper(process, config);
    const keyTool = new KeyTool(jdkHelper, log);

    if (await fileExists(twaManifest.signingKey.path)) {
      console.log(`Signing key already exists: ${twaManifest.signingKey.path}`);
    } else {
      const password = generatePassword();
      console.log("Creating Android signing key...");
      await keyTool.createSigningKey({
        path: twaManifest.signingKey.path,
        alias: twaManifest.signingKey.alias,
        password,
        keypassword: password,
        fullName: "FoxiesDeck",
        organizationalUnit: "Mobile",
        organization: "FoxiesDeck",
        country: "US",
      });
      await fs.writeFile(
        path.join(PROJECT_DIR, ".keystore-passwords"),
        JSON.stringify(
          { keystorePassword: password, keyPassword: password },
          null,
          2
        )
      );

      const info = await keyTool.keyInfo({
        path: twaManifest.signingKey.path,
        alias: twaManifest.signingKey.alias,
        password,
        keypassword: password,
      });
      const fingerprint =
        info.fingerprints.get("SHA256") || [...info.fingerprints.values()][0];
      console.log("\n=== SHA-256 certificate fingerprint ===");
      console.log(fingerprint);
      console.log("=== Save this for assetlinks.json ===\n");
      await fs.writeFile(
        path.join(PROJECT_DIR, ".sha256-fingerprint.txt"),
        fingerprint
      );
    }

    console.log(`\nTWA project initialized successfully in ${PROJECT_DIR}`);
    console.log("Next step: npm run pwa:build");
  } finally {
    if (stopServer) await stopServer();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
