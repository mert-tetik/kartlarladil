import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const projectRoot = process.cwd();
const publicDirectory = join(projectRoot, "public");
const outputPath = join(publicDirectory, "image-cache-manifest.json");
const imageExtension = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const CRITICAL_IMAGE_URLS = new Set([
  "/logo.png",
  "/mission-icon.png",
  "/score-icon.png",
  "/splash.png",
]);

async function collectImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectImages(entryPath);
      }

      return imageExtension.test(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

const imagePaths = (await collectImages(publicDirectory)).sort();
const assets = await Promise.all(
  imagePaths.map(async (imagePath) => {
    const contents = await readFile(imagePath);
    const revision = createHash("sha256").update(contents).digest("hex");
    const relativePath = relative(publicDirectory, imagePath).split(sep).join("/");

    return { url: `/${relativePath}`, revision };
  }),
);
const version = createHash("sha256").update(JSON.stringify(assets)).digest("hex");
const criticalAssets = assets.filter(
  (asset) => CRITICAL_IMAGE_URLS.has(asset.url) || asset.url.startsWith("/flags/"),
);

await writeFile(
  outputPath,
  `${JSON.stringify({ version, assets, criticalAssets }, null, 2)}\n`,
  "utf8",
);
