#!/usr/bin/env node
/**
 * Lightweight subscription integration health check.
 *
 * Run with:
 *   node --env-file=.env.local scripts/verify-subscriptions.mjs
 */

const EXPECTED_GOOGLE_PLAY_PACKAGE = "com.LigidTools.Glidecore";

const required = {
  Supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  LemonSqueezy: [
    "LEMONSQUEEZY_API_KEY",
    "LEMONSQUEEZY_STORE_ID",
    "LEMONSQUEEZY_BASIC_VARIANT_ID",
    "LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID",
    "LEMONSQUEEZY_PRO_VARIANT_ID",
    "LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID",
    "LEMONSQUEEZY_WEBHOOK_SECRET",
  ],
  GooglePlay: ["GOOGLE_PLAY_PACKAGE_NAME", "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON"],
};

let exitCode = 0;

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function ok(message) {
  console.log(`  ✓ ${message}`);
}

function fail(message) {
  console.error(`  ✗ ${message}`);
  exitCode = 1;
}

section("Supabase");
for (const key of required.Supabase) {
  if (process.env[key]) {
    ok(`${key} is set`);
  } else {
    fail(`${key} is missing`);
  }
}

section("Lemon Squeezy");
for (const key of required.LemonSqueezy) {
  if (process.env[key]) {
    ok(`${key} is set`);
  } else {
    fail(`${key} is missing`);
  }
}

section("Google Play Billing");
for (const key of required.GooglePlay) {
  if (process.env[key]) {
    ok(`${key} is set`);
  } else {
    fail(`${key} is missing`);
  }
}

const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
if (packageName && packageName !== EXPECTED_GOOGLE_PLAY_PACKAGE) {
  fail(`GOOGLE_PLAY_PACKAGE_NAME is "${packageName}" but expected "${EXPECTED_GOOGLE_PLAY_PACKAGE}"`);
}

const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON;
if (serviceAccountJson) {
  try {
    const parsed = JSON.parse(serviceAccountJson);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      fail("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON is missing client_email, private_key, or project_id");
    } else {
      ok(`Service account client_email: ${parsed.client_email}`);
    }
  } catch {
    fail("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON is not valid JSON");
  }
}

section("Summary");
if (exitCode === 0) {
  console.log("All required subscription environment variables are present.");
} else {
  console.error("Some required subscription environment variables are missing or invalid.");
}

process.exit(exitCode);
