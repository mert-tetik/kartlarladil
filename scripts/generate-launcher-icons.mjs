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

async function createLauncherIcon(source, size) {
  return sharp(source)
    .flatten({ background: BRAND_ORANGE })
    .resize(size, size, { fit: "fill" })
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
    const launcherIcon = await createLauncherIcon(APP_LOGO_PATH, size);
    await fs.writeFile(path.join(baseDir, dir, "ic_launcher.png"), launcherIcon);
    await fs.writeFile(
      path.join(baseDir, dir, "ic_maskable.png"),
      launcherIcon,
    );
    console.log(`Generated matching AppLogo2 launcher/maskable resources in ${dir} (${size}x${size})`);
  }

  for (const [dir, size] of Object.entries(ADAPTIVE_SIZES)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    await fs.writeFile(
      path.join(baseDir, dir, "ic_launcher_foreground.png"),
      await createLauncherIcon(APP_LOGO_PATH, size),
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
