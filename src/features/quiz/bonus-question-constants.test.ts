import {
  BONUS_QUESTION_PROBABILITY,
  getMaxBonusQuestionCount,
} from "@/features/quiz/bonus-question-constants";

describe("bonus question limits", () => {
  it("uses a one-in-four probability", () => {
    expect(BONUS_QUESTION_PROBABILITY).toBe(0.25);
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
