import {
  getCorrectAnswerFeedbackDelayMs,
  QUIZ_BUTTON_FEEDBACK_DURATION_MS,
} from "./quiz-answer-feedback-timing";

describe("correct answer feedback timing", () => {
  it("keeps the first correct answer at the current feedback duration", () => {
    expect(getCorrectAnswerFeedbackDelayMs(1)).toBe(QUIZ_BUTTON_FEEDBACK_DURATION_MS);
  });

  it("reduces the wait evenly through the fifth correct answer", () => {
    expect([
      getCorrectAnswerFeedbackDelayMs(1),
      getCorrectAnswerFeedbackDelayMs(2),
      getCorrectAnswerFeedbackDelayMs(3),
      getCorrectAnswerFeedbackDelayMs(4),
      getCorrectAnswerFeedbackDelayMs(5),
    ]).toEqual([700, 525, 350, 175, 0]);
  });

  it("keeps the fifth-streak no-wait behavior for longer streaks", () => {
    expect(getCorrectAnswerFeedbackDelayMs(6)).toBe(0);
  });
});
