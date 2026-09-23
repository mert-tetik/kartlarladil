#!/usr/bin/env node
/**
 * Copies the web application's local media into the install-time Play Asset
 * Pack used by the Android WebView shell. The generated Android project is
 * intentionally ignored by git; this script is the reproducible source of
 * its media contents.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const MEDIA_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4v",
  ".mp3",
  ".mp4",
  ".ogg",
  ".png",
  ".svg",
  ".ttf",
  ".wav",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
]);

const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".m4v", "video/x-m4v"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".ogg", "audio/ogg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".wav", "audio/wav"],
  [".webm", "video/webm"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

async function collectMediaFiles(directory, urlPrefix, assetPrefix = "") {
  const result = [];

  async function visit(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(sourcePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const extension = path.extname(entry.name).toLowerCase();
      if (!MEDIA_EXTENSIONS.has(extension)) continue;

      const relativeSourcePath = path
        .relative(directory, sourcePath)
        .split(path.sep)
        .join("/");
      const relativeAssetPath = `${assetPrefix}${relativeSourcePath}`;
      const urlPath = `${urlPrefix}${relativeSourcePath}`;
      const stat = await fs.stat(sourcePath);

      result.push({
        sourcePath,
        url: urlPath.startsWith("/") ? urlPath : `/${urlPath}`,
        relativePath: relativeAssetPath,
        mimeType: MIME_TYPES.get(extension) || "application/octet-stream",
        size: stat.size,
      });
    }
  }

  await visit(directory);
  return result;
}

async function readBuildId() {
  try {
    return (await fs.readFile(path.join(ROOT, ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return "unknown";
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function prepareHybridMedia(projectDir = process.env.TWA_PROJECT_DIR || path.join(ROOT, "com.foxiesdeck")) {
  const publicDir = path.join(ROOT, "public");
  const nextMediaDir = path.join(ROOT, ".next", "static", "media");
  if (!(await exists(nextMediaDir))) {
    throw new Error(
      "Missing .next/static/media. Run `npm run build` before `npm run pwa:build` so imported media can be packaged."
    );
  }

  const mediaByUrl = new Map();
  for (const asset of await collectMediaFiles(publicDir, "/")) {
    mediaByUrl.set(asset.url, asset);
  }
  for (const asset of await collectMediaFiles(nextMediaDir, "/_next/static/media/", "_next/static/media/")) {
    mediaByUrl.set(asset.url, asset);
  }

  const assets = [...mediaByUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
  if (assets.length === 0) {
    throw new Error("No local media files were found to package into the Android asset pack.");
  }

  const packAssetsDir = path.join(projectDir, "ui-media", "src", "main", "assets");
  const debugAssetsDir = path.join(projectDir, "app", "src", "debug", "assets", "ui-media");
  const indexPath = path.join(projectDir, "app", "src", "main", "assets", "ui-media-index.json");

  await fs.rm(packAssetsDir, { recursive: true, force: true });
  await fs.rm(debugAssetsDir, { recursive: true, force: true });
  await fs.mkdir(packAssetsDir, { recursive: true });
  await fs.mkdir(debugAssetsDir, { recursive: true });
  await fs.mkdir(path.dirname(indexPath), { recursive: true });

  for (const asset of assets) {
    const packTarget = path.join(packAssetsDir, asset.relativePath);
    const debugTarget = path.join(debugAssetsDir, asset.relativePath);
    await fs.mkdir(path.dirname(packTarget), { recursive: true });
    await fs.mkdir(path.dirname(debugTarget), { recursive: true });
    await fs.copyFile(asset.sourcePath, packTarget);
    await fs.copyFile(asset.sourcePath, debugTarget);
  }

  const index = {
    schemaVersion: 1,
    buildId: await readBuildId(),
    assets: assets.map(({ url, relativePath, mimeType, size }) => ({
      url,
      relativePath,
      mimeType,
      size,
    })),
  };
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  const totalBytes = assets.reduce((total, asset) => total + asset.size, 0);
  const result = {
    projectDir,
    assetCount: assets.length,
    totalBytes,
    assetPack: "ui_media",
    indexPath,
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareHybridMedia().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
