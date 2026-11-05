import { describe, expect, it } from "vitest";
import {
  getQuizPerformanceRankUp,
  getQuizPerformanceRewardBreakdown,
  isQuizPerformanceContinueLocked,
  QUIZ_PERFORMANCE_REWARD_CONTINUE_FAILSAFE_MS,
} from "@/features/quiz/quiz-performance-rewards";

describe("getQuizPerformanceRewardBreakdown", () => {
  it("awards each category independently and caps every category at 50", () => {
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 10,
      durationSeconds: 0,
      correctAnswerCount: 10,
      answeredCount: 10,
      correctCardCount: 10,
      learnedCardCount: 10,
    })).toEqual({
      accuracyPoints: 50,
      timePoints: 50,
      correctPoints: 50,
      learnedPoints: 50,
      totalPoints: 200,
    });
  });

  it("scales time against quiz size and accuracy against answered questions", () => {
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 20,
      durationSeconds: 600,
      correctAnswerCount: 7,
      answeredCount: 10,
      correctCardCount: 3,
      learnedCardCount: 1,
    })).toEqual({
      accuracyPoints: 35,
      timePoints: 25,
      correctPoints: 30,
      learnedPoints: 20,
      totalPoints: 110,
    });
  });

  it("awards performance points when a learner studies fewer than ten cards", () => {
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 3,
      durationSeconds: 60,
      correctAnswerCount: 8,
      answeredCount: 10,
      correctCardCount: 2,
      learnedCardCount: 1,
    })).toEqual({
      accuracyPoints: 40,
      timePoints: 33,
      correctPoints: 20,
      learnedPoints: 20,
      totalPoints: 113,
    });
  });

  it("skips empty categories and returns zero when no answers were given", () => {
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 10,
      durationSeconds: 600,
      correctAnswerCount: 0,
      answeredCount: 0,
      correctCardCount: 0,
      learnedCardCount: 0,
    })).toEqual({
      accuracyPoints: 0,
      timePoints: 0,
      correctPoints: 0,
      learnedPoints: 0,
      totalPoints: 0,
    });
  });

  it("rejects invalid or impossible result values", () => {
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 0,
      durationSeconds: 0,
      correctAnswerCount: 0,
      answeredCount: 0,
      correctCardCount: 0,
      learnedCardCount: 0,
    })).toBeNull();
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 51,
      durationSeconds: 0,
      correctAnswerCount: 0,
      answeredCount: 0,
      correctCardCount: 0,
      learnedCardCount: 0,
    })).toBeNull();
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 10,
      durationSeconds: -1,
      correctAnswerCount: 1,
      answeredCount: 1,
      correctCardCount: 0,
      learnedCardCount: 0,
    })).toBeNull();
    expect(getQuizPerformanceRewardBreakdown({
      selectedCount: 10,
      durationSeconds: 0,
      correctAnswerCount: 2,
      answeredCount: 1,
      correctCardCount: 0,
      learnedCardCount: 0,
    })).toBeNull();
  });
});

describe("getQuizPerformanceRankUp", () => {
  it("returns the rank crossed by the points confirmed for this result", () => {
    expect(getQuizPerformanceRankUp(180, 40)).toEqual({
      fromRank: {
        id: "baslangic",
        label: "Başlangıç",
        minPoints: 0,
        icon: "trophy",
      },
      rank: {
        id: "kart-ciragi",
        label: "Kart Çırağı",
        minPoints: 200,
        icon: "medal",
      },
    });
  });

  it("returns null when the awarded points do not cross a threshold", () => {
    expect(getQuizPerformanceRankUp(180, 19)).toBeNull();
  });
});

describe("quiz performance Continue gate", () => {
  const settledNoRank = {
    hasRewardSequence: true,
    animationsComplete: true,
    rankCheckComplete: true,
    rankUp: null,
    rankOverlayPresented: false,
    failsafeElapsed: false,
  } as const;

  it("stays locked until the scatter/HUD exit and rank check are complete", () => {
    expect(isQuizPerformanceContinueLocked({
      ...settledNoRank,
      animationsComplete: false,
    })).toBe(true);
    expect(isQuizPerformanceContinueLocked({
      ...settledNoRank,
      rankCheckComplete: false,
    })).toBe(true);
    expect(isQuizPerformanceContinueLocked(settledNoRank)).toBe(false);
  });

  it("waits for a rank-up overlay to mount before unlocking Continue", () => {
    const rankUp = getQuizPerformanceRankUp(180, 40);
    expect(rankUp).not.toBeNull();
    expect(isQuizPerformanceContinueLocked({
      ...settledNoRank,
      rankUp,
      rankOverlayPresented: false,
    })).toBe(true);
    expect(isQuizPerformanceContinueLocked({
      ...settledNoRank,
      rankUp,
      rankOverlayPresented: true,
    })).toBe(false);
  });

  it("releases the button after the hard 3.5-second failsafe in every state", () => {
    expect(QUIZ_PERFORMANCE_REWARD_CONTINUE_FAILSAFE_MS).toBe(3500);
    expect(isQuizPerformanceContinueLocked({
      hasRewardSequence: true,
      animationsComplete: false,
      rankCheckComplete: false,
      rankUp: getQuizPerformanceRankUp(180, 40),
      rankOverlayPresented: false,
      failsafeElapsed: true,
    })).toBe(false);
  });
});
