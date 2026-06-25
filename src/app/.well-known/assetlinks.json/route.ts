import { NextResponse } from "next/server";

// Public values for the current TWA signing key. These are safe to hard-code
// because the SHA-256 fingerprint is already exposed in the APK signature.
const FALLBACK_PACKAGE_NAME = "com.foxiesdeck";
const FALLBACK_SHA256_FINGERPRINT =
  "7f:11:a1:10:f6:2e:9c:3d:1d:33:e6:57:21:0b:78:e2:18:e6:3b:b5:8b:7e:08:a4:c2:e5:61:bd:bc:cb:fd:16";

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
