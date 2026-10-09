import {
  BONUS_QUESTION_PROBABILITY,
  BONUS_QUESTION_TYPE_WEIGHTS,
  getMaxBonusQuestionCount,
} from "@/features/quiz/bonus-question-constants";

describe("bonus question limits", () => {
  it("uses a one-in-ten probability", () => {
    expect(BONUS_QUESTION_PROBABILITY).toBe(0.1);
  });

  it("uses the requested bonus type weights", () => {
    expect(BONUS_QUESTION_TYPE_WEIGHTS).toEqual({
      matching: 0.55,
      "sentence-order": 0.1,
      "category-sort": 0.35,
      imposter: 0,
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
