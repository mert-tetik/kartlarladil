import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_LOGO_PATH = path.join(ROOT, "public", "AppLogo2.png");
const sizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192,
};

export async function generateLauncherIcons(projectDir = path.join(ROOT, "com.foxiesdeck")) {
  // AppLogo2.png is the only approved FoxiesDeck app logo. Never replace it
  // with a downloaded, generated, or legacy logo when preparing an AAB.
  await fs.access(APP_LOGO_PATH);

  const baseDir = path.join(projectDir, "app", "src", "main", "res");
  for (const [dir, size] of Object.entries(sizes)) {
    await fs.mkdir(path.join(baseDir, dir), { recursive: true });
    const resized = sharp(APP_LOGO_PATH).resize(size, size, { fit: "fill" }).png();
    await resized.toFile(path.join(baseDir, dir, "ic_launcher.png"));
    await sharp(APP_LOGO_PATH)
      .resize(size, size, { fit: "fill" })
      .png()
      .toFile(path.join(baseDir, dir, "ic_maskable.png"));
    console.log(`Generated AppLogo2 launcher resources in ${dir} (${size}x${size})`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateLauncherIcons().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
