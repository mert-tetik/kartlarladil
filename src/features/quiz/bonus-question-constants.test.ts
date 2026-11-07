import { describe, expect, it } from "vitest";
import {
  BONUS_QUESTION_POINTS,
  getBonusQuestionPoints,
} from "@/features/quiz/bonus-question-constants";

describe("bonus question points", () => {
  it("awards 50 points for every bonus question type", () => {
    expect(BONUS_QUESTION_POINTS).toEqual({
      matching: 50,
      "sentence-order": 50,
      "category-sort": 50,
      imposter: 50,
    });

    expect(getBonusQuestionPoints("matching")).toBe(50);
    expect(getBonusQuestionPoints("sentence-order")).toBe(50);
    expect(getBonusQuestionPoints("category-sort")).toBe(50);
    expect(getBonusQuestionPoints("imposter")).toBe(50);
  });
});
