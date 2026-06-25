import { NextResponse } from "next/server";

// Public values for the current TWA signing key. These are safe to hard-code
// because the SHA-256 fingerprint is already exposed in the APK signature.
const FALLBACK_PACKAGE_NAME = "com.LigidTools.Glidecore";
const FALLBACK_SHA256_FINGERPRINT =
  "49:1a:b6:5b:be:ba:97:be:7f:f4:79:5b:c5:e6:b0:e0:ab:4a:b1:73:1f:44:9b:f9:ee:05:41:88:21:2e:31:f5";

function normalizeFingerprint(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "")
    .trim();
}

export function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME || FALLBACK_PACKAGE_NAME;
  const rawFingerprint =
    process.env.TWA_SHA256_FINGERPRINT || FALLBACK_SHA256_FINGERPRINT;

  if (!packageName || !rawFingerprint) {
    return NextResponse.json([]);
  }

  const fingerprints = rawFingerprint
    .split(",")
    .map(normalizeFingerprint)
    .filter(Boolean);

  const assetLinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
