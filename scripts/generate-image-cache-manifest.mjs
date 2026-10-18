import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const projectRoot = process.cwd();
const publicDirectory = join(projectRoot, "public");
const outputPath = join(publicDirectory, "image-cache-manifest.json");
const imageExtension = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)$/i;
const CRITICAL_IMAGE_URLS = new Set([
  "/AppLogdfo.png",
  "/mascots/mascot1.webp",
  "/mascots/mascot5.webp",
  "/mission-icon.png",
  "/score-icon.png",
  "/splash.png",
  "/ai-characters/campus-friend.webp",
  "/ai-characters/friendly-worker.webp",
  "/ai-characters/gentle-companion.webp",
  "/ai-characters/gothic-calm.webp",
  "/ai-characters/skater-coach.webp",
  "/ai-characters/sleepy-student.webp",
  "/ai-characters/soft-artist.webp",
  "/ai-characters/study-buddy.webp",
  "/ai-characters/warm-grandmother.webp",
  "/ai-characters/wise-elder.webp",
  "/quiz/quiz-word-repetition-teacher.png",
  "/quiz/quiz-word-repetition-teacher-1.png",
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
  (asset) =>
    CRITICAL_IMAGE_URLS.has(asset.url) ||
    asset.url.startsWith("/quiz/count-options/") ||
    asset.url.startsWith("/quiz/count-selection-frames/") ||
    asset.url.startsWith("/flags/") ||
    asset.url.startsWith("/mobile-nav-icons/"),
);

await writeFile(
  outputPath,
  `${JSON.stringify({ version, assets, criticalAssets }, null, 2)}\n`,
  "utf8",
);
