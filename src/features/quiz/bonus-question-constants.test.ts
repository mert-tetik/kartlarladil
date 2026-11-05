import {
  BONUS_QUESTION_EARLY_WINDOW,
  BONUS_QUESTION_LATE_PROBABILITY,
  BONUS_QUESTION_PROBABILITY,
  BONUS_QUESTION_TYPE_WEIGHTS,
  getBonusQuestionProbability,
  getMaxBonusQuestionCount,
} from "@/features/quiz/bonus-question-constants";

describe("bonus question limits", () => {
  it("uses a two-in-ten probability for the first ten regular questions", () => {
    expect(BONUS_QUESTION_PROBABILITY).toBe(0.2);
    expect(BONUS_QUESTION_EARLY_WINDOW).toBe(10);
    expect(getBonusQuestionProbability(0)).toBe(0.2);
    expect(getBonusQuestionProbability(9)).toBe(0.2);
  });

  it("uses a one-in-ten probability after the first ten regular questions", () => {
    expect(BONUS_QUESTION_LATE_PROBABILITY).toBe(0.1);
    expect(getBonusQuestionProbability(10)).toBe(0.1);
    expect(getBonusQuestionProbability(20)).toBe(0.1);
  });

  it("uses the requested bonus type weights", () => {
    expect(BONUS_QUESTION_TYPE_WEIGHTS).toEqual({
      matching: 0.4,
      "sentence-order": 0.2,
      "category-sort": 0.2,
      imposter: 0.2,
    });
  });

  it("keeps one bonus for small quizzes and caps larger quizzes at one third", () => {
    expect(getMaxBonusQuestionCount(0)).toBe(0);
    expect(getMaxBonusQuestionCount(1)).toBe(1);
    expect(getMaxBonusQuestionCount(2)).toBe(1);
    expect(getMaxBonusQuestionCount(3)).toBe(1);
    expect(getMaxBonusQuestionCount(10)).toBe(3);
    expect(getMaxBonusQuestionCount(20)).toBe(6);
  });
});
