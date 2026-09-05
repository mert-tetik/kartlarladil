import { describe, expect, it } from "vitest";
import { getQuizResultRewardPoints } from "@/features/quiz/result-rewards";

describe("getQuizResultRewardPoints", () => {
  it("doubles the star base and scales it by quiz size", () => {
    expect(getQuizResultRewardPoints(5, 10)).toBe(10);
    expect(getQuizResultRewardPoints(5, 20)).toBe(20);
    expect(getQuizResultRewardPoints(5, 50)).toBe(50);
  });

  it("rejects unsupported quiz sizes and star values", () => {
    expect(getQuizResultRewardPoints(5, 15)).toBeNull();
    expect(getQuizResultRewardPoints(0, 10)).toBeNull();
    expect(getQuizResultRewardPoints(6, 10)).toBeNull();
  });
});
