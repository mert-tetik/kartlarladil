#!/usr/bin/env node

import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const publicDirectory = join(process.cwd(), "public");
const isDevPreparation = process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "predev";

if (isDevPreparation && existsSync(publicDirectory)) {
  for (const fileName of readdirSync(publicDirectory)) {
    if (!/^(?:sw|workbox-|fallback-).*\.js(?:\.map)?$/.test(fileName)) continue;
    unlinkSync(join(publicDirectory, fileName));
  }
}

await import("./generate-image-cache-manifest.mjs");
await import("./build-offline-card-renderer.mjs");
