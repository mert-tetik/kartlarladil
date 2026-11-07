import { describe, expect, it } from "vitest";
import { getChestOpeningFrameSource } from "./chest-opening-frames";

describe("chest opening frame assets", () => {
  it("maps every chest tier and frame index to an individual frame image", () => {
    const tiers = ["wood", "iron", "gold", "diamond", "emerald", "ruby"] as const;

    for (const tier of tiers) {
      expect(getChestOpeningFrameSource(tier, 0)).toBe(
        `/chests/opening-frames/${tier}-frames/frame-001.webp?v=20261107-esrgan-frame-sequence`,
      );
    }

    expect(getChestOpeningFrameSource("iron", 15)).toContain("frame-016.webp");
    expect(getChestOpeningFrameSource("iron", 16)).toContain("frame-017.webp");
    expect(getChestOpeningFrameSource("iron", 96)).toContain("frame-097.webp");
  });

  it("clamps frame indexes to the available sequence", () => {
    expect(getChestOpeningFrameSource("wood", -1)).toContain("frame-001.webp");
    expect(getChestOpeningFrameSource("wood", 97)).toContain("frame-097.webp");
  });
});
