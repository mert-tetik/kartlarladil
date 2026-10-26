import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDirectories = [
  "pricing-subscription-menu-frames-v2",
  "pricing-subscription-menu-pro-frames-v2",
];
const outputRoot = path.resolve(
  process.argv[2] ?? "tmp/pricing-subscription-menu-edge-cleanup",
);
const onlyFrame = process.argv[3] ? `${Number.parseInt(process.argv[3])}.png` : null;

function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === r) hue = ((g - b) / delta) % 6;
    else if (maximum === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  return { hue, saturation: maximum === 0 ? 0 : delta / maximum };
}

function isGreenScreenFringe(red, green, blue) {
  const { hue, saturation } = rgbToHsv(red, green, blue);

  // Green-screen spill mixed with orange fox fur becomes saturated olive/yellow;
  // spill mixed with the blue/purple card art becomes saturated cyan.
  return (
    (hue >= 42 && hue <= 90 && saturation >= 0.55) ||
    (hue > 90 && hue <= 205 && saturation >= 0.35)
  );
}

function touchesTransparency(data, width, height, x, y, radius) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const sampleX = x + dx;
      const sampleY = y + dy;

      if (
        sampleX < 0 ||
        sampleX >= width ||
        sampleY < 0 ||
        sampleY >= height ||
        data[(sampleY * width + sampleX) * 4 + 3] === 0
      ) {
        return true;
      }
    }
  }

  return false;
}

function cleanFrame(data, width, height) {
  const source = Buffer.from(data);
  const pixelCount = width * height;
  const candidates = new Uint8Array(pixelCount);
  const edgeCandidates = [];

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    if (source[offset + 3] === 0) continue;

    if (
      isGreenScreenFringe(
        source[offset],
        source[offset + 1],
        source[offset + 2],
      )
    ) {
      candidates[pixel] = 1;
    }
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (!candidates[pixel]) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);

    for (let radius = 1; radius <= 12; radius += 1) {
      if (touchesTransparency(source, width, height, x, y, radius)) {
        edgeCandidates.push(pixel);
        break;
      }
    }
  }

  let replaced = 0;

  for (const pixel of edgeCandidates) {
    const offset = pixel * 4;
    const red = source[offset];
    const green = source[offset + 1];
    const blue = source[offset + 2];
    const { hue } = rgbToHsv(red, green, blue);

    // Suppress green spill without repainting the subject: warm olive fringe
    // is shifted toward its red/blue midpoint, green spill toward the stronger
    // neighboring channel, and cyan spill back toward the underlying blue hue.
    const cleanGreen =
      hue > 90 && hue <= 170
        ? Math.max(red, blue)
        : Math.round((red + blue) / 2);
    data[offset + 1] = Math.min(green, cleanGreen);
    replaced += 1;
  }

  return { replaced };
}

async function processDirectory(directoryName) {
  const sourceDirectory = path.resolve("public", directoryName);
  const outputDirectory = path.join(outputRoot, directoryName);
  await fs.mkdir(outputDirectory, { recursive: true });

  const frameNames = (await fs.readdir(sourceDirectory))
    .filter((name) => /^\d+\.png$/i.test(name))
    .sort((left, right) => Number.parseInt(left) - Number.parseInt(right))
    .filter((name) => !onlyFrame || name === onlyFrame);

  if (!onlyFrame && frameNames.length !== 50) {
    throw new Error(`${directoryName}: expected 50 frames, found ${frameNames.length}`);
  }
  if (onlyFrame && frameNames.length !== 1) {
    throw new Error(`${directoryName}: could not find requested frame ${onlyFrame}`);
  }

  let changedFrames = 0;
  let replacedPixels = 0;

  for (const frameName of frameNames) {
    const sourcePath = path.join(sourceDirectory, frameName);
    const outputPath = path.join(outputDirectory, frameName);
    const { data, info } = await sharp(sourcePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const counts = cleanFrame(data, info.width, info.height);
    if (counts.replaced > 0) changedFrames += 1;
    replacedPixels += counts.replaced;

    if (counts.replaced === 0) {
      await fs.copyFile(sourcePath, outputPath);
    } else {
      await sharp(data, {
        raw: { width: info.width, height: info.height, channels: 4 },
      })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toFile(outputPath);
    }
  }

  console.log(
    `${directoryName}: ${frameNames.length} frames; ${changedFrames} changed; ${replacedPixels} edge pixels decontaminated`,
  );
}

await fs.mkdir(outputRoot, { recursive: true });
for (const directoryName of sourceDirectories) {
  await processDirectory(directoryName);
}
