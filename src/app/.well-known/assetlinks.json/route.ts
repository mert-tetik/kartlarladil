import { NextResponse } from "next/server";

// This route must be rendered at request time so Vercel env vars are picked up
// and the file is not statically cached with stale fallback values.
export const dynamic = "force-dynamic";

// Public values for the current TWA signing key. These are safe to hard-code
// because the SHA-256 fingerprint is already exposed in the APK signature.
const FALLBACK_PACKAGE_NAME = "com.LigidTools.Glidecore";
const FALLBACK_SHA256_FINGERPRINT =
  "49:1a:b6:5b:be:ba:97:be:7f:f4:79:5b:c5:e6:b0:e0:ab:4a:b1:73:1f:44:9b:f9:ee:05:41:88:21:2e:31:f5";

// Legacy entry for the old package name, so any leftover installs keep working.
const LEGACY_PACKAGE_NAME = "com.foxiesdeck";
const LEGACY_SHA256_FINGERPRINT =
  "7f:11:a1:10:f6:2e:9c:3d:1d:33:e6:57:21:0b:78:e2:18:e6:3b:b5:8b:7e:08:a4:c2:e5:61:bd:bc:cb:fd:16";

function normalizeFingerprint(value: string): string {
  return value.toLowerCase().replace(/[^a-f0-9]/g, "").trim();
}

function buildStatement(
  packageName: string | null | undefined,
  rawFingerprint: string | null | undefined
) {
  if (!packageName || !rawFingerprint) return null;

  const fingerprints = rawFingerprint
    .split(",")
    .map(normalizeFingerprint)
    .filter(Boolean);

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
  const currentRawFingerprint =
    process.env.TWA_SHA256_FINGERPRINT || FALLBACK_SHA256_FINGERPRINT;

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
