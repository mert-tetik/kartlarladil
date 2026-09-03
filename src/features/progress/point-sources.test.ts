import { describe, expect, it } from "vitest";
import { getGemBalance, getProfilePointTotal } from "@/features/progress/point-sources";

describe("shared point sources", () => {
  it("adds every persisted point source exactly once", () => {
    expect(getProfilePointTotal({
      aiPracticePoints: 2,
      chestPoints: 3,
      streakPoints: 4,
      missionPoints: 5,
      quizResultPoints: 6,
      gamePoints: 7,
      gemPoints: 8,
    })).toBe(35);
  });

  it("reads the requested gem balance without changing the other balances", () => {
    const balances = { blueGems: 10, greenGems: 5, purpleGems: 2 };

    expect(getGemBalance(balances, "blue")).toBe(10);
    expect(getGemBalance(balances, "green")).toBe(5);
    expect(getGemBalance(balances, "purple")).toBe(2);
  });
});
