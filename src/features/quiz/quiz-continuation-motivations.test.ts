import { describe, expect, it, vi } from "vitest";
import { selectQuizContinuationMotivations } from "./quiz-continuation-motivations";

const baseInput = {
  nearLearnedCount: 0,
  nearLevelUpCount: 0,
  rankProgressPercent: 40,
  pointsToNextRank: 100,
  accuracy: 80,
  incorrectCount: 1,
  answeredCount: 10,
  remainingActiveCards: 8,
  gainedXp: 10,
  gainedGems: 0,
  earnedMedals: 3,
  chestWasMissed: false,
  chestMissedByPercentagePoints: 0,
};

describe("selectQuizContinuationMotivations", () => {
  it("keeps the leaderboard motivation as the final reason", () => {
    const selected = selectQuizContinuationMotivations({
      ...baseInput,
      chestWasMissed: true,
      chestMissedByPercentagePoints: 1,
    });

    expect(selected).toHaveLength(3);
    expect(selected.at(-1)?.id).toBe("leaderboard");
    expect(selected.some(({ id }) => id === "missedChest")).toBe(true);
    expect(selected.find(({ id }) => id === "missedChest")?.strength).toBeGreaterThanOrEqual(0.84);
    expect(selected.every(({ strength }) => strength >= 0 && strength <= 1)).toBe(true);
  });

  it("always puts the leaderboard motivation last, including when new cards are needed", () => {
    const selected = selectQuizContinuationMotivations({
      ...baseInput,
      remainingActiveCards: 0,
    });

    expect(selected.at(-1)?.id).toBe("leaderboard");
    expect(selected.some(({ id }) => id === "drawCards")).toBe(true);
    expect(selected).toHaveLength(3);
  });

  it("keeps the selected motivation cards unique", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const selected = selectQuizContinuationMotivations({
      ...baseInput,
      nearLearnedCount: 1,
      nearLevelUpCount: 1,
      rankProgressPercent: 0,
      remainingActiveCards: 8,
    });

    expect(new Set(selected.map(({ id }) => id)).size).toBe(selected.length);
    random.mockRestore();
  });

  it("uses review-focused motivations after a learned-card quiz", () => {
    const selected = selectQuizContinuationMotivations(baseInput, {
      isReviewQuiz: true,
    });

    expect(selected.map(({ id }) => id)).toEqual([
      "nearLearned",
      "accuracy",
      "mistakes",
    ]);
    expect(selected.map(({ headerKey }) => headerKey)).toEqual([
      "quiz.continuation.review.header.memory",
      "quiz.continuation.review.header.recall",
      "quiz.continuation.review.header.tricky",
    ]);
  });

  it("bases the next-rank motivation on the remaining points", () => {
    const close = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 25,
    }).find(({ id }) => id === "nextRank");
    const far = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 2400,
    }).find(({ id }) => id === "nextRank");

    expect(close?.values).toEqual({ points: 25 });
    expect(close?.strength).toBeGreaterThan(far?.strength ?? 0);
  });

  it("guarantees the next-rank motivation when the rank threshold is met", () => {
    const belowPointThreshold = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 369,
      rankProgressPercent: 10,
    });
    const atProgressThreshold = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 2400,
      rankProgressPercent: 75,
    });
    const belowBothThresholds = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 370,
      rankProgressPercent: 74,
    });

    expect(belowPointThreshold.some(({ id }) => id === "nextRank")).toBe(true);
    expect(atProgressThreshold.some(({ id }) => id === "nextRank")).toBe(true);
    expect(belowBothThresholds.some(({ id }) => id === "nextRank")).toBe(false);
  });

  it("can prioritize the next-rank motivation for the normal test mode", () => {
    const selected = selectQuizContinuationMotivations(
      {
        ...baseInput,
        pointsToNextRank: 2400,
        remainingActiveCards: 0,
      },
      { prioritizeNextRank: true },
    );

    expect(selected[0]?.id).toBe("nextRank");
    expect(selected).toHaveLength(3);
  });

  it("disables the next-rank motivation at the final rank", () => {
    const selected = selectQuizContinuationMotivations({
      ...baseInput,
      pointsToNextRank: 0,
    });

    expect(selected.some(({ id }) => id === "nextRank")).toBe(false);
  });

  it("includes leaderboard and medal collection as continuation reasons", () => {
    const selected = selectQuizContinuationMotivations({
      ...baseInput,
      answeredCount: 0,
      remainingActiveCards: 1,
      pointsToNextRank: 0,
      gainedXp: 0,
    });

    expect(selected.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["leaderboard", "medals"]),
    );
  });

  it("makes medal collection more compelling when fewer medals were earned", () => {
    const lowMedalResult = selectQuizContinuationMotivations({
      ...baseInput,
      earnedMedals: 1,
    }).find(({ id }) => id === "medals");
    const fullMedalResult = selectQuizContinuationMotivations({
      ...baseInput,
      earnedMedals: 5,
    }).find(({ id }) => id === "medals");

    expect(lowMedalResult?.strength).toBeGreaterThan(fullMedalResult?.strength ?? 0);
  });
});
