import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const rawRoot = path.resolve("tmp/quiz-feedback-mascots-raw");
const outputRoot = path.resolve("public/quiz-feedback-mascots-v1");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function rgbToHsv(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;

    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return {
    hue,
    saturation: max === 0 ? 0 : delta / max,
  };
}

function chromaKeyGreen(data, width, height) {
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];

    if (alpha === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      continue;
    }

    const { hue, saturation } = rgbToHsv(red, green, blue);
    const greenExcess = green - Math.max(red, blue);

    // Green is identified by both hue and a genuinely green-dominant channel.
    // The small excess threshold catches pale anti-aliased green edges without
    // treating neutral white pixels as chroma-key pixels.
    const isGreenPixel =
      hue > 50 &&
      hue < 175 &&
      saturation > 0.004 &&
      greenExcess >= 1;

    if (!isGreenPixel) continue;

    // Strong green becomes transparent; soft green edges fade proportionally.
    const greenStrength = smoothstep(0, 42, greenExcess);
    data[offset + 3] = Math.round(alpha * (1 - greenStrength));

    // Any green that remains visible is neutralized so no green fringe survives
    // fractional alpha blending against either app theme.
    const neutral = Math.min(red, blue);
    data[offset] = neutral;
    data[offset + 1] = neutral;
    data[offset + 2] = neutral;

    if (data[offset + 3] === 0) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
    }
  }

  // Pull the matte very slightly inward wherever a keyed edge touches full
  // transparency. This removes the one-pixel green-screen rim while keeping
  // the character's anti-aliased silhouette soft.
  const keyed = Buffer.from(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (keyed[offset + 3] === 0) continue;

      let touchesTransparency = false;
      for (let dy = -1; dy <= 1 && !touchesTransparency; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighborX = x + dx;
          const neighborY = y + dy;
          if (
            neighborX < 0 ||
            neighborX >= width ||
            neighborY < 0 ||
            neighborY >= height ||
            keyed[(neighborY * width + neighborX) * 4 + 3] === 0
          ) {
            touchesTransparency = true;
            break;
          }
        }
      }

      if (touchesTransparency) {
        data[offset + 3] = Math.round(data[offset + 3] * 0.2);
      }
    }
  }
}

function applySubtlePremultipliedBlur(data, width, height) {
  const source = Buffer.from(data);
  const kernel = [
    [1, 4, 6, 4, 1],
    [4, 16, 24, 16, 4],
    [6, 24, 36, 24, 6],
    [4, 16, 24, 16, 4],
    [1, 4, 6, 4, 1],
  ];
  const kernelTotal = 256;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let ky = -2; ky <= 2; ky += 1) {
        for (let kx = -2; kx <= 2; kx += 1) {
          const weight = kernel[ky + 2][kx + 2];
          if (!weight) continue;
          const sampleX = clamp(x + kx, 0, width - 1);
          const sampleY = clamp(y + ky, 0, height - 1);
          const offset = (sampleY * width + sampleX) * 4;
          const sampleAlpha = source[offset + 3];
          const weightedAlpha = sampleAlpha * weight;

          red += source[offset] * weightedAlpha;
          green += source[offset + 1] * weightedAlpha;
          blue += source[offset + 2] * weightedAlpha;
          alpha += weightedAlpha;
        }
      }

      const outputOffset = (y * width + x) * 4;
      const outputAlpha = Math.round(alpha / kernelTotal);
      data[outputOffset + 3] = outputAlpha;

      if (outputAlpha === 0 || alpha === 0) {
        data[outputOffset] = 0;
        data[outputOffset + 1] = 0;
        data[outputOffset + 2] = 0;
        continue;
      }

      data[outputOffset] = clamp(Math.round(red / alpha), 0, 255);
      data[outputOffset + 1] = clamp(Math.round(green / alpha), 0, 255);
      data[outputOffset + 2] = clamp(Math.round(blue / alpha), 0, 255);
    }
  }

  // The green screen can tint one or two transition pixels toward olive even
  // when red is still slightly higher than green. Remove those pixels only
  // when they are close to transparency; opaque yellow/orange artwork remains.
  const blurred = Buffer.from(data);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (blurred[offset + 3] === 0) continue;

      let nearTransparency = false;
      for (let dy = -2; dy <= 2 && !nearTransparency; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighborX = x + dx;
          const neighborY = y + dy;
          if (
            neighborX < 0 ||
            neighborX >= width ||
            neighborY < 0 ||
            neighborY >= height ||
            blurred[(neighborY * width + neighborX) * 4 + 3] === 0
          ) {
            nearTransparency = true;
            break;
          }
        }
      }

      if (!nearTransparency) continue;
      const { hue, saturation } = rgbToHsv(
        blurred[offset],
        blurred[offset + 1],
        blurred[offset + 2],
      );
      if (hue > 50 && hue < 175 && saturation > 0.35) {
        data[offset] = 0;
        data[offset + 1] = 0;
        data[offset + 2] = 0;
        data[offset + 3] = 0;
      }
    }
  }

  // A tiny amount of high-chroma colour can survive as a semi-transparent
  // fringe after blur. It is easy to miss at native size but becomes a
  // green/yellow outline when the mascot is scaled up, so remove only that
  // low-alpha fringe and keep the opaque yellow/orange artwork untouched.
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0 || data[offset + 3] >= 96) continue;

    const { hue, saturation } = rgbToHsv(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    if (hue > 45 && hue < 175 && saturation > 0.02) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }

  // Final despill pass: neutralize any genuinely green-dominant colour that
  // survived the matte/blur stages. Red-dominant yellow and orange pixels are
  // intentionally excluded here.
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    const { hue, saturation } = rgbToHsv(
      data[offset],
      data[offset + 1],
      data[offset + 2],
    );
    if (
      hue > 50 &&
      hue < 175 &&
      saturation > 0.03 &&
      data[offset + 1] > data[offset] + 2
    ) {
      const neutral = Math.min(data[offset], data[offset + 2]);
      data[offset] = neutral;
      data[offset + 1] = neutral;
      data[offset + 2] = neutral;
    }
  }
}

async function processDirectory(directoryName) {
  const sourceDirectory = path.join(rawRoot, directoryName);
  const outputDirectory = path.join(outputRoot, directoryName);
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  const frameNames = fs
    .readdirSync(sourceDirectory)
    .filter((name) => name.endsWith(".png"))
    .sort((left, right) => Number.parseInt(left) - Number.parseInt(right));

  for (const frameName of frameNames) {
    const sourcePath = path.join(sourceDirectory, frameName);
    const outputPath = path.join(outputDirectory, frameName);
    const { data, info } = await sharp(sourcePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    chromaKeyGreen(data, info.width, info.height);
    applySubtlePremultipliedBlur(data, info.width, info.height);

    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  }

  console.log(`${directoryName}: ${frameNames.length} frames`);
}

fs.mkdirSync(outputRoot, { recursive: true });
for (const directoryName of fs
  .readdirSync(rawRoot)
  .filter((name) => fs.statSync(path.join(rawRoot, name)).isDirectory())) {
  await processDirectory(directoryName);
}
