import type { ChestTier } from "@/features/quiz/chest-rewards";

export const CHEST_OPENING_FRAME_WIDTH = 480;
export const CHEST_OPENING_FRAME_HEIGHT = 854;
export const CHEST_OPENING_FRAME_RATE = 24;
export const CHEST_OPENING_FRAME_COUNT = 97;
export const CHEST_OPENING_FRAME_PREFETCH_AHEAD = 6;
export const CHEST_OPENING_DURATION_SECONDS =
  CHEST_OPENING_FRAME_COUNT / CHEST_OPENING_FRAME_RATE;

const CHEST_OPENING_FRAME_VERSION = "20261107-esrgan-frame-sequence";

export function getChestOpeningFrameSource(tier: ChestTier, frameIndex: number) {
  const safeFrameIndex = Math.max(
    0,
    Math.min(CHEST_OPENING_FRAME_COUNT - 1, Math.floor(frameIndex)),
  );
  const frameNumber = String(safeFrameIndex + 1).padStart(3, "0");

  return `/chests/opening-frames/${tier}-frames/frame-${frameNumber}.webp?v=${CHEST_OPENING_FRAME_VERSION}`;
}

export async function loadChestOpeningFrameImage(source: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const image = new window.Image();
    image.decoding = "async";
    const imageReady = typeof image.decode === "function"
      ? null
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not decode chest opening frame"));
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

  throw lastError ?? new Error("Could not decode chest opening frame");
}

export async function preloadChestOpeningFrames(
  tier: ChestTier,
  firstFrameIndex = 0,
  frameCount = CHEST_OPENING_FRAME_COUNT,
) {
  if (typeof window === "undefined") return;

  const firstFrame = Math.max(0, Math.floor(firstFrameIndex));
  const endFrame = Math.min(
    CHEST_OPENING_FRAME_COUNT,
    firstFrame + Math.max(0, Math.floor(frameCount)),
  );

  for (let frameIndex = firstFrame; frameIndex < endFrame; frameIndex += 1) {
    let image: HTMLImageElement | null = null;
    try {
      image = await loadChestOpeningFrameImage(getChestOpeningFrameSource(tier, frameIndex));
    } catch {
      // This idle warmup is best-effort; the active animation retries frames on demand.
    } finally {
      if (image) image.src = "data:,";
    }
  }
}
