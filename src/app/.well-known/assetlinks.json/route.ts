import { NextResponse } from "next/server";

// This route must be rendered at request time so Vercel env vars are picked up
// and the file is not statically cached with stale fallback values.
export const dynamic = "force-dynamic";

// Public values for the current TWA signing key. These are safe to hard-code
// because the SHA-256 fingerprint is already exposed in the APK signature.
const FALLBACK_PACKAGE_NAME = "com.LigidTools.Glidecore";
// This must match the Play Console "App signing key certificate" SHA-256.
const FALLBACK_SHA256_FINGERPRINT =
  "D4:73:E8:A7:A8:C7:7B:21:75:EB:5E:63:F4:D4:FB:2C:89:AD:85:82:02:5A:BA:1A:FE:11:71:E7:DB:EE:48:42";

// Upload key fingerprint from C:\Users\CASPER\user.keystore. Used for sideload
// / internal app sharing builds; Play Store builds use the app signing key.
const UPLOAD_SHA256_FINGERPRINT =
  "49:1A:B6:5B:BE:BA:97:BE:7F:F4:79:5B:C5:E6:B0:E0:AB:4A:B1:73:1F:44:9B:F9:EE:05:41:88:21:2E:31:F5";

// Legacy entry for the old package name, so any leftover installs keep working.
const LEGACY_PACKAGE_NAME = "com.foxiesdeck";
const LEGACY_SHA256_FINGERPRINT =
  "7f:11:a1:10:f6:2e:9c:3d:1d:33:e6:57:21:0b:78:e2:18:e6:3b:b5:8b:7e:08:a4:c2:e5:61:bd:bc:cb:fd:16";

function normalizeFingerprint(value: string): string {
  const hex = value.toLowerCase().replace(/[^a-f0-9]/g, "").trim();
  // Android's Digital Asset Links parser expects uppercase hex bytes separated
  // by colons, matching the format shown in Play Console.
  return hex
    .match(/.{1,2}/g)
    ?.map((byte) => byte.toUpperCase())
    .join(":") ?? "";
}

function buildStatement(
  packageName: string | null | undefined,
  rawFingerprint: string | null | undefined
) {
  if (!packageName || !rawFingerprint) return null;

  const fingerprints = Array.from(
    new Set(
      rawFingerprint
        .split(",")
        .map(normalizeFingerprint)
        .filter(Boolean)
    )
  );

  if (fingerprints.length === 0) return null;

  return {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints,
    },
  };
}

export function GET() {
  const currentPackageName =
    process.env.TWA_PACKAGE_NAME || FALLBACK_PACKAGE_NAME;
  const currentRawFingerprint = [
    process.env.TWA_SHA256_FINGERPRINT || FALLBACK_SHA256_FINGERPRINT,
    UPLOAD_SHA256_FINGERPRINT,
  ].join(",");

  const statements = [
    buildStatement(currentPackageName, currentRawFingerprint),
    buildStatement(LEGACY_PACKAGE_NAME, LEGACY_SHA256_FINGERPRINT),
  ].filter(Boolean);

  return NextResponse.json(statements, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
