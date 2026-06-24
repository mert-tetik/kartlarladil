import { NextResponse } from "next/server";

export function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME;
  const fingerprint = process.env.TWA_SHA256_FINGERPRINT;

  const assetLinks =
    packageName && fingerprint
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: packageName,
              sha256_cert_fingerprints: [fingerprint],
            },
          },
        ]
      : [];

  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
