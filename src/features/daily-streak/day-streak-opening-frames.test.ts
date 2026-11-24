import { describe, expect, it } from "vitest";
import {
  DAY_STREAK_OPENING_ATLAS_COUNT,
  DAY_STREAK_OPENING_DURATION_SECONDS,
  DAY_STREAK_OPENING_FRAME_COUNT,
  DAY_STREAK_OPENING_FRAME_HEIGHT,
  DAY_STREAK_OPENING_FRAME_RATE,
  DAY_STREAK_OPENING_FRAME_WIDTH,
  getDayStreakOpeningAtlasSource,
} from "@/features/daily-streak/day-streak-opening-frames";

describe("daily streak opening frame atlases", () => {
  it("matches the source animation timeline and atlas layout", () => {
    expect(DAY_STREAK_OPENING_FRAME_COUNT).toBe(97);
    expect(DAY_STREAK_OPENING_FRAME_WIDTH).toBe(960);
    expect(DAY_STREAK_OPENING_FRAME_HEIGHT).toBe(1708);
    expect(DAY_STREAK_OPENING_FRAME_RATE).toBe(24);
    expect(DAY_STREAK_OPENING_DURATION_SECONDS).toBeCloseTo(4.0417, 3);
    expect(DAY_STREAK_OPENING_ATLAS_COUNT).toBe(7);
  });

  it("resolves atlas assets by theme and stable ordered index", () => {
    expect(getDayStreakOpeningAtlasSource("dark", 0)).toBe(
      "/day-streak/opening-frames/dark/atlas-01.webp?v=20261124-2x-upscale-1",
    );
    expect(getDayStreakOpeningAtlasSource("dark", 6)).toBe(
      "/day-streak/opening-frames/dark/atlas-07.webp?v=20261124-2x-upscale-1",
    );
  });
});
