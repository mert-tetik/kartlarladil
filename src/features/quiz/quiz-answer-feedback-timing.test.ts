import {
  getCorrectAnswerFeedbackDurationMs,
  getCorrectAnswerPlaybackRate,
  QUIZ_BUTTON_FEEDBACK_DURATION_MS,
} from "./quiz-answer-feedback-timing";

describe("correct answer feedback timing", () => {
  it("keeps the first correct answer at the current feedback duration", () => {
    expect(getCorrectAnswerFeedbackDurationMs(1)).toBe(QUIZ_BUTTON_FEEDBACK_DURATION_MS);
  });

  it("shortens the button animation evenly through the fifth correct answer", () => {
    expect([
      getCorrectAnswerFeedbackDurationMs(1),
      getCorrectAnswerFeedbackDurationMs(2),
      getCorrectAnswerFeedbackDurationMs(3),
      getCorrectAnswerFeedbackDurationMs(4),
      getCorrectAnswerFeedbackDurationMs(5),
    ]).toEqual([700, 638, 575, 513, 450]);
  });

  it("keeps the fifth-streak speed cap for longer streaks", () => {
    expect(getCorrectAnswerFeedbackDurationMs(6)).toBe(450);
    expect(getCorrectAnswerPlaybackRate(6)).toBe(1.2);
  });

  it("raises the correct-answer playback rate with the same streak cap", () => {
    expect([
      getCorrectAnswerPlaybackRate(1),
      getCorrectAnswerPlaybackRate(2),
      getCorrectAnswerPlaybackRate(3),
      getCorrectAnswerPlaybackRate(4),
      getCorrectAnswerPlaybackRate(5),
    ]).toEqual([1, 1.05, 1.1, 1.15, 1.2]);
  });
});
