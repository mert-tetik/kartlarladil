import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const chestTiers = ["wood", "iron", "gold", "diamond", "emerald", "ruby"];
const publicDirectory = join(process.cwd(), "public");
const outputDirectory = join(publicDirectory, "chests", "count-preview");

await mkdir(outputDirectory, { recursive: true });

await Promise.all(
  chestTiers.map((tier) => {
    const sourceName = tier === "wood" ? "wooden_chest.png" : `${tier}_chest.png`;

    return sharp(join(publicDirectory, "chests", sourceName))
      .resize(128, 128, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(join(outputDirectory, `${tier}.webp`));
  }),
);
