import { describe, expect, it } from "vitest";
import { getQuizStreakRewardPoints, getRewardableQuizStreak } from "@/features/quiz/streak-rewards";

describe("quiz streak rewards", () => {
  it("does not reward streaks below five", () => {
    expect(getRewardableQuizStreak(4)).toBe(0);
    expect(getQuizStreakRewardPoints(4)).toBe(0);
  });

  it("rewards the nearest lower multiple of five", () => {
    expect(getRewardableQuizStreak(7)).toBe(5);
    expect(getQuizStreakRewardPoints(7)).toBe(20);
  });

  it("uses the biggest completed five-step streak bucket", () => {
    expect(getRewardableQuizStreak(13)).toBe(10);
    expect(getQuizStreakRewardPoints(13)).toBe(40);
  });
});
