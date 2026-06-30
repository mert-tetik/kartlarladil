import { Medal, Star, XCircle } from "lucide-react";
import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { getQuizPerformanceSummary } from "@/features/quiz/components/quiz-station";

const SAMPLE_CARDS = VOCABULARY_CARDS.filter((card) => card.language === "en" && card.tier === "A1").slice(0, 12);

function buildResults(correctCount: number, incorrectCount: number, learnedCount = 0) {
  const correct = SAMPLE_CARDS.slice(0, correctCount);
  const incorrect = SAMPLE_CARDS.slice(correctCount, correctCount + incorrectCount);

  return {
    correct,
    incorrect,
    learned: correct.slice(0, learnedCount),
  };
}

describe("getQuizPerformanceSummary", () => {
  it("unlocks the chest for high accuracy without double-counting learned cards", () => {
    const summary = getQuizPerformanceSummary("active", buildResults(8, 2, 3), 10, false);

    expect(summary.level).toBe("mediumHigh");
    expect(summary.accuracy).toBe(80);
    expect(summary.chestUnlocked).toBe(true);
    expect(summary.icon).toBe(Medal);
    expect(summary.messageKeys).toContain("quiz.resultMessageMediumHigh1");
  });

  it("uses the medium state at the passing threshold without chest access", () => {
    const summary = getQuizPerformanceSummary("active", buildResults(5, 5, 1), 10, false);

    expect(summary.level).toBe("mediumLow");
    expect(summary.accuracy).toBe(50);
    expect(summary.chestUnlocked).toBe(false);
    expect(summary.icon).toBe(Star);
    expect(summary.messageKeys).toContain("quiz.resultMessageMediumLow1");
  });

  it("uses the low state for weaker runs", () => {
    const summary = getQuizPerformanceSummary("active", buildResults(3, 7, 0), 10, false);

    expect(summary.level).toBe("low");
    expect(summary.accuracy).toBe(30);
    expect(summary.chestUnlocked).toBe(false);
    expect(summary.icon).toBe(XCircle);
    expect(summary.messageKeys).toContain("quiz.resultMessageLow1");
  });
});
