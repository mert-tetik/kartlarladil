import { describe, expect, it } from "vitest";
import { GEM_POINTS, GEM_COSTS } from "@/features/gems/gem-types";

describe("gem economy rules", () => {
  it("keeps the common-to-epic conversion values ordered", () => {
    expect(GEM_POINTS).toEqual({ blue: 1, green: 5, purple: 20 });
  });

  it("uses the agreed costs for mobile card and quiz actions", () => {
    expect(GEM_COSTS).toMatchObject({
      removeCard: { type: "blue", amount: 10 },
      markLearned: { type: "purple", amount: 2 },
      rerollQuestion: { type: "green", amount: 2 },
    });
  });
});
