import type { ChestTier } from "@/features/quiz/chest-rewards";

export const CHEST_OPENING_FRAME_WIDTH = 480;
export const CHEST_OPENING_FRAME_HEIGHT = 854;
export const CHEST_OPENING_FRAME_RATE = 24;
export const CHEST_OPENING_FRAME_COUNT = 97;
export const CHEST_OPENING_ATLAS_COLUMNS = 4;
export const CHEST_OPENING_ATLAS_ROWS = 4;
export const CHEST_OPENING_FRAMES_PER_ATLAS =
  CHEST_OPENING_ATLAS_COLUMNS * CHEST_OPENING_ATLAS_ROWS;
export const CHEST_OPENING_ATLAS_COUNT = Math.ceil(
  CHEST_OPENING_FRAME_COUNT / CHEST_OPENING_FRAMES_PER_ATLAS,
);
export const CHEST_OPENING_DURATION_SECONDS =
  CHEST_OPENING_FRAME_COUNT / CHEST_OPENING_FRAME_RATE;

// Generated from the source MP4s at 24 fps with ffmpeg scale=480:854 and tile=4x4.
export function getChestOpeningAtlasSource(tier: ChestTier, atlasIndex: number) {
  const atlasNumber = String(atlasIndex + 1).padStart(2, "0");
  return `/chests/opening-frames/${tier}/atlas-${atlasNumber}.webp?v=20261031-2`;
}

export async function loadChestOpeningAtlasImage(source: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const image = new window.Image();
    image.decoding = "async";
    const imageReady = typeof image.decode === "function"
      ? null
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not decode chest opening frames"));
        });
    image.src = attempt === 0 ? source : `${source}&retry=1`;

    try {
      if (imageReady) await imageReady;
      else await image.decode();
      return image;
    } catch (error) {
      lastError = error;
      image.src = "data:,";
    }
  }

  throw lastError ?? new Error("Could not decode chest opening frames");
}

export function preloadChestOpeningFrames(tier: ChestTier, firstAtlasIndex = 0) {
  if (typeof window === "undefined") return Promise.resolve();

  const preloadAtlas = async (atlasIndex: number) => {
    let image: HTMLImageElement | null = null;
    try {
      image = await loadChestOpeningAtlasImage(getChestOpeningAtlasSource(tier, atlasIndex));
    } finally {
      if (image) image.src = "data:,";
    }
  };

  return (async () => {
    for (let atlasIndex = firstAtlasIndex; atlasIndex < CHEST_OPENING_ATLAS_COUNT; atlasIndex += 1) {
      await preloadAtlas(atlasIndex);
    }
  })();
}
