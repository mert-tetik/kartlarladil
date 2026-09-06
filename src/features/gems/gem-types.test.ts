import { describe, expect, it } from "vitest";
import { GEM_POINTS, getGemBalancesBeforeRewards, normalizeGemRewards } from "./gem-types";

describe("gem reward payloads", () => {
  it("normalizes a multi-gem payload in the stable display order", () => {
    expect(normalizeGemRewards([
      { type: "purple", amount: 2 },
      { type: "blue", amount: 4 },
      { type: "green", amount: 3 },
    ])).toEqual([
      { type: "blue", amount: 4 },
      { type: "green", amount: 3 },
      { type: "purple", amount: 2 },
    ]);
  });

  it("ignores malformed values and does not duplicate a gem type", () => {
    expect(normalizeGemRewards([
      { type: "blue", amount: 2 },
      { type: "blue", amount: 99 },
      { type: "gold", amount: 4 },
      { type: "green", amount: 0 },
      null,
    ])).toEqual([{ type: "blue", amount: 2 }]);
  });

  it("keeps the intended conversion values", () => {
    expect(GEM_POINTS).toEqual({ blue: 5, green: 20, purple: 40 });
  });

  it("derives the pre-reward totals for the animated HUD", () => {
    expect(getGemBalancesBeforeRewards(
      { blue: 14, green: 8, purple: 3 },
      [
        { type: "blue", amount: 4 },
        { type: "green", amount: 2 },
        { type: "purple", amount: 1 },
      ],
    )).toEqual({ blue: 10, green: 6, purple: 2 });
  });
});
