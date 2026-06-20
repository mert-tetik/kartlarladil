import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOUND_EFFECT_ASSETS, type SoundEffectName } from "@/lib/sound-effects";

describe("SOUND_EFFECT_ASSETS", () => {
  it("covers every non-correct sound effect key", () => {
    const assetKeys = Object.keys(SOUND_EFFECT_ASSETS).sort();
    const effectKeys: SoundEffectName[] = [
      "incorrect",
      "rank-up",
      "points",
      "learned",
      "confetti",
      "quiz-complete",
      "chest-tap",
      "chest-open",
    ];

    expect(assetKeys).toEqual(effectKeys.sort());
  });

  it("points to files that exist under public/", () => {
    for (const asset of Object.values(SOUND_EFFECT_ASSETS)) {
      expect(asset.src.startsWith("/sounds/")).toBe(true);
      expect(existsSync(join(process.cwd(), "public", asset.src.slice(1)))).toBe(true);
      expect(asset.volume).toBeGreaterThan(0);
      expect(asset.volume).toBeLessThanOrEqual(1);
    }
  });
});
