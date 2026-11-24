import type { ChestTier } from "@/features/quiz/chest-rewards";
import { getNativeMediaFallbackSource } from "@/lib/native-media-fallback";

export const CHEST_OPENING_FRAME_WIDTH = 480;
export const CHEST_OPENING_FRAME_HEIGHT = 854;
export const CHEST_OPENING_FRAME_RATE = 24;
export const CHEST_OPENING_FRAME_COUNT = 97;
export const CHEST_OPENING_FRAME_PREFETCH_AHEAD = 6;
export const CHEST_OPENING_DURATION_SECONDS =
  CHEST_OPENING_FRAME_COUNT / CHEST_OPENING_FRAME_RATE;

const CHEST_OPENING_FRAME_VERSION = "20261124-native-cache-routing-1";
const FRAME_IMAGE_LOAD_TIMEOUT_MS = 8_000;

export type ChestFrameImageSource = "bundled" | "remote-fallback";

export function getChestOpeningFrameSource(tier: ChestTier, frameIndex: number) {
  const safeFrameIndex = Math.max(
    0,
    Math.min(CHEST_OPENING_FRAME_COUNT - 1, Math.floor(frameIndex)),
  );
  const frameNumber = String(safeFrameIndex + 1).padStart(3, "0");

  return `/chests/opening-frames/${tier}-frames/frame-${frameNumber}.webp?v=${CHEST_OPENING_FRAME_VERSION}`;
}

export async function loadChestOpeningFrameImage(
  source: string,
  onSourceAttempt?: (attempt: ChestFrameImageSource) => void,
) {
  const remoteFallbackUrl = new URL(getNativeMediaFallbackSource(source), window.location.origin);
  remoteFallbackUrl.searchParams.set("chest-frame-retry", "1");
  const attempts: Array<{ url: string; source: ChestFrameImageSource }> = [
    { url: source, source: "bundled" },
    { url: remoteFallbackUrl.toString(), source: "remote-fallback" },
  ];
  let lastError: unknown;

  for (const attempt of attempts) {
    const image = new window.Image();
    image.decoding = "async";
    onSourceAttempt?.(attempt.source);

    try {
      await waitForDecodedImage(image, attempt.url);
      return image;
    } catch (error) {
      lastError = error;
      image.onload = null;
      image.onerror = null;
      image.src = "data:,";
    }
  }

  throw lastError ?? new Error("Could not decode chest opening frame");
}

function waitForDecodedImage(image: HTMLImageElement, source: string) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(new Error(`Timed out loading chest frame ${new URL(source, window.location.origin).pathname}`));
    }, FRAME_IMAGE_LOAD_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.onload = null;
      image.onerror = null;
    };

    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const handleLoaded = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        finish();
      } else {
        finish(new Error(`Chest frame has no decoded pixels: ${new URL(source, window.location.origin).pathname}`));
      }
    };

    image.onload = handleLoaded;
    image.onerror = () => {
      finish(new Error(`Could not load chest frame ${new URL(source, window.location.origin).pathname}`));
    };
    image.src = source;

    if (typeof image.decode === "function") {
      const handleDecodeFailure = (error: unknown) => {
        // Some embedded WebViews reject decode() before the corresponding
        // load/error event has settled. Keep listening for those events so a
        // valid image is not discarded just because decode() raced onload.
        if (!image.complete) return;
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
          handleLoaded();
          return;
        }
        finish(error);
      };

      try {
        void image.decode().then(handleLoaded).catch(handleDecodeFailure);
      } catch (error) {
        handleDecodeFailure(error);
      }
    } else if (image.complete) {
      handleLoaded();
    }
  });
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
