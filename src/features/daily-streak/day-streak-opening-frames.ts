import type { ThemeMode } from "@/lib/themes";

export const DAY_STREAK_OPENING_FRAME_WIDTH = 480;
export const DAY_STREAK_OPENING_FRAME_HEIGHT = 854;
export const DAY_STREAK_OPENING_FRAME_RATE = 24;
export const DAY_STREAK_OPENING_FRAME_COUNT = 97;
export const DAY_STREAK_OPENING_ATLAS_COLUMNS = 4;
export const DAY_STREAK_OPENING_ATLAS_ROWS = 4;
export const DAY_STREAK_OPENING_FRAMES_PER_ATLAS =
  DAY_STREAK_OPENING_ATLAS_COLUMNS * DAY_STREAK_OPENING_ATLAS_ROWS;
export const DAY_STREAK_OPENING_ATLAS_COUNT = Math.ceil(
  DAY_STREAK_OPENING_FRAME_COUNT / DAY_STREAK_OPENING_FRAMES_PER_ATLAS,
);
export const DAY_STREAK_OPENING_DURATION_SECONDS =
  DAY_STREAK_OPENING_FRAME_COUNT / DAY_STREAK_OPENING_FRAME_RATE;
const preloadingByTheme = new Map<ThemeMode, Promise<void>>();

export function getDayStreakOpeningAtlasSource(mode: ThemeMode, atlasIndex: number) {
  const atlasNumber = String(atlasIndex + 1).padStart(2, "0");
  return `/day-streak/opening-frames/${mode}/atlas-${atlasNumber}.webp?v=20261103-1`;
}

export async function loadDayStreakOpeningAtlasImage(source: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const image = new window.Image();
    image.decoding = "async";
    const imageReady = typeof image.decode === "function"
      ? null
      : new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Could not decode daily streak frames"));
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

  throw lastError ?? new Error("Could not decode daily streak frames");
}

export function preloadDayStreakFrames(mode: ThemeMode) {
  if (typeof window === "undefined") return Promise.resolve();
  const existing = preloadingByTheme.get(mode);
  if (existing) return existing;

  const preloading = (async () => {
    for (let atlasIndex = 0; atlasIndex < DAY_STREAK_OPENING_ATLAS_COUNT; atlasIndex += 1) {
      try {
        const image = await loadDayStreakOpeningAtlasImage(
          getDayStreakOpeningAtlasSource(mode, atlasIndex),
        );
        image.src = "data:,";
      } catch {
        // The visible player retries the specific atlas and keeps its poster fallback.
      }
    }
  })();
  preloadingByTheme.set(mode, preloading);
  return preloading;
}
