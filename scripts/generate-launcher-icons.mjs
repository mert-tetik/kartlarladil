import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_LOGO_PATH = path.join(ROOT, "public", "AppLogo2.png");
const BRAND_ORANGE = { r: 254, g: 101, b: 7, alpha: 1 };
const LEGACY_SIZES = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};
const ADAPTIVE_SIZES = {
  "drawable-mdpi": 108,
  "drawable-hdpi": 162,
  "drawable-xhdpi": 216,
  "drawable-xxhdpi": 324,
  "drawable-xxxhdpi": 432,
};

const BACKGROUND_DISTANCE = 78;
const SAFE_ZONE_RATIO = 0.6;

function isBackgroundPixel(data, offset) {
  const distance = Math.hypot(
    data[offset] - BRAND_ORANGE.r,
    data[offset + 1] - BRAND_ORANGE.g,
    data[offset + 2] - BRAND_ORANGE.b,
  );
  return distance <= BACKGROUND_DISTANCE;
}

function findBackgroundMask(data, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function enqueue(x, y) {
    const index = y * width + x;
    if (visited[index]) return;
    const offset = index * 4;
    if (!isBackgroundPixel(data, offset)) return;
    visited[index] = 1;
    queue[tail++] = index;
  }

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  return visited;
}

async function readMascotCutout() {
  const { data, info } = await sharp(APP_LOGO_PATH)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = findBackgroundMask(data, info.width, info.height);
  const output = Buffer.from(data);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < background.length; index++) {
    const offset = index * 4;
    if (background[index]) {
      output[offset + 3] = 0;
      continue;
    }
    const x = index % info.width;
    const y = Math.floor(index / info.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("Could not isolate the AppLogo2 mascot from its background.");
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

async function createSafeZoneIcon(mascot, size, { transparent = false } = {}) {
  const contentSize = Math.max(1, Math.round(size * SAFE_ZONE_RATIO));
  const content = await sharp(mascot)
    .resize(contentSize, contentSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const background = transparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : BRAND_ORANGE;

  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([
      {
        input: content,
        left: Math.round((size - contentSize) / 2),
        top: Math.round((size - contentSize) / 2),
      },
    ])
    .png()
    .toBuffer();
}

export async function generateLauncherIcons(projectDir = path.join(ROOT, "com.foxiesdeck")) {
  // AppLogo2.png is the only approved FoxiesDeck app logo. Never replace it
  // with a downloaded, generated, or legacy logo when preparing an AAB.
  await fs.access(APP_LOGO_PATH);
  const mascot = await readMascotCutout();

  const baseDir = path.join(projectDir, "app", "src", "main", "res");
  for (const [dir, size] of Object.entries(LEGACY_SIZES)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    await sharp(APP_LOGO_PATH)
      .flatten({ background: BRAND_ORANGE })
      .resize(size, size, { fit: "fill" })
      .png()
      .toFile(path.join(baseDir, dir, "ic_launcher.png"));
    await fs.writeFile(
      path.join(baseDir, dir, "ic_maskable.png"),
      await createSafeZoneIcon(mascot, size),
    );
    console.log(`Generated AppLogo2 legacy launcher resources in ${dir} (${size}x${size})`);
  }

  for (const [dir, size] of Object.entries(ADAPTIVE_SIZES)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    await fs.writeFile(
      path.join(baseDir, dir, "ic_launcher_foreground.png"),
      await createSafeZoneIcon(mascot, size, { transparent: true }),
    );
    console.log(`Generated AppLogo2 adaptive foreground in ${dir} (${size}x${size})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateLauncherIcons().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
