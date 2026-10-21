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

const CROP_SCALE = 1.15;

async function createCroppedIcon(source, size) {
  const contentSize = Math.max(1, Math.round(size * CROP_SCALE));
  const cropOffset = Math.max(0, Math.floor((contentSize - size) / 2));
  return sharp(source)
    .flatten({ background: BRAND_ORANGE })
    .resize(contentSize, contentSize, { fit: "fill" })
    .extract({ left: cropOffset, top: cropOffset, width: size, height: size })
    .png()
    .toBuffer();
}

export async function generateLauncherIcons(projectDir = path.join(ROOT, "com.foxiesdeck")) {
  // AppLogo2.png is the only approved FoxiesDeck app logo. Never replace it
  // with a downloaded, generated, or legacy logo when preparing an AAB.
  await fs.access(APP_LOGO_PATH);

  const baseDir = path.join(projectDir, "app", "src", "main", "res");
  for (const [dir, size] of Object.entries(LEGACY_SIZES)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    const legacyIcon = await sharp(APP_LOGO_PATH)
      .flatten({ background: BRAND_ORANGE })
      .resize(size, size, { fit: "fill" })
      .png()
      .toBuffer();
    // Maskable icons intentionally overflow the visible frame. There is no
    // safe-zone shrink and no added orange outline.
    await fs.writeFile(path.join(baseDir, dir, "ic_launcher.png"), legacyIcon);
    await fs.writeFile(
      path.join(baseDir, dir, "ic_maskable.png"),
      await createCroppedIcon(APP_LOGO_PATH, size),
    );
    console.log(`Generated AppLogo2 legacy launcher resources in ${dir} (${size}x${size})`);
  }

  for (const [dir, size] of Object.entries(ADAPTIVE_SIZES)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    await fs.writeFile(
      path.join(baseDir, dir, "ic_launcher_foreground.png"),
      await createCroppedIcon(APP_LOGO_PATH, size),
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
