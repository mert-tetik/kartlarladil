import { describe, expect, it } from "vitest";
import {
  getQuizResultRewardPoints,
  getQuizSessionEarnedPoints,
} from "@/features/quiz/result-rewards";

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

describe("getQuizSessionEarnedPoints", () => {
  const base = {
    startingTotalPoints: 100,
    startingQuizResultPoints: 40,
  };

  it("uses the account total delta when all quiz rewards are reflected", () => {
    expect(getQuizSessionEarnedPoints({
      ...base,
      currentTotalPoints: 185,
      confirmedBonusPoints: 25,
      currentQuizResultPoints: 65,
    })).toBe(85);
  });

  it("includes confirmed bonus-question points while the profile total is still refreshing", () => {
    expect(getQuizSessionEarnedPoints({
      ...base,
      currentTotalPoints: 160,
      confirmedBonusPoints: 25,
      currentQuizResultPoints: 40,
    })).toBe(85);
  });

  it("does not count confirmed bonus points twice when only part has synced", () => {
    expect(getQuizSessionEarnedPoints({
      ...base,
      currentTotalPoints: 170,
      confirmedBonusPoints: 25,
      currentQuizResultPoints: 50,
    })).toBe(85);
  });

  it("clamps negative totals and non-finite rewards", () => {
    expect(getQuizSessionEarnedPoints({
      ...base,
      currentTotalPoints: 50,
      confirmedBonusPoints: Number.NaN,
      currentQuizResultPoints: 40,
    })).toBe(0);
  });
});
