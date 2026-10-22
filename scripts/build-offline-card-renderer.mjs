#!/usr/bin/env node
import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "public", "offline-shell");

await mkdir(outputDirectory, { recursive: true });
await build({
  absWorkingDir: root,
  bundle: true,
  entryPoints: ["src/features/cards/components/offline-card-renderer-entry.tsx"],
  format: "iife",
  globalName: "FoxiesDeckOfflineCardBundle",
  jsx: "automatic",
  minify: true,
  outfile: path.join(outputDirectory, "card-renderer.js"),
  platform: "browser",
  target: ["chrome100"],
  tsconfig: "tsconfig.json",
});

console.log("Bundled the shared vocabulary-card renderer for the offline shell.");
