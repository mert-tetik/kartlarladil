import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = join(__dirname, "..", "public", "icon.png");
const publicDir = join(__dirname, "..", "public");

const white = { r: 255, g: 255, b: 255, alpha: 1 };

async function main() {
  // Standard 192x192 launcher icon
  await sharp(source)
    .resize(192, 192, { fit: "contain", background: white })
    .toFile(join(publicDir, "icon-192.png"));

  // Maskable 512x512 icon with padding for adaptive icon shapes
  const size = 512;
  const padding = Math.round(size * 0.15);
  const innerSize = size - padding * 2;

  const resized = await sharp(source)
    .resize(innerSize, innerSize, { fit: "contain", background: white })
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: white,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .toFile(join(publicDir, "icon-maskable.png"));

  console.log("Generated public/icon-192.png and public/icon-maskable.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
