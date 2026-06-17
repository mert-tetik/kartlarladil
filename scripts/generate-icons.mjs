import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const publicDir = path.join(root, "public");
const source = path.join(publicDir, "logo.png");

async function main() {
  const buffer = await fs.readFile(source);

  await sharp(buffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, "icon.png"));

  await sharp(buffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, "apple-icon.png"));

  console.log("Icons generated successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
