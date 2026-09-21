import { describe, expect, it } from "vitest";
import {
  BONUS_QUIZ_FEEDBACK_MASCOT,
  NORMAL_QUIZ_FEEDBACK_MASCOTS,
  pickQuizFeedbackMascotAnimation,
  QUIZ_FEEDBACK_MASCOT_CHANCE,
} from "./quiz-feedback-mascot-animation";

describe("quiz feedback mascot selection", () => {
  it("keeps the mascot off for the other six sevenths of questions", () => {
    expect(pickQuizFeedbackMascotAnimation(false, QUIZ_FEEDBACK_MASCOT_CHANCE)).toBeNull();
    expect(pickQuizFeedbackMascotAnimation(false, 0.99)).toBeNull();
  });

  it("uses only the bonus mascot for bonus questions", () => {
    expect(pickQuizFeedbackMascotAnimation(true, 0, 0)).toEqual(BONUS_QUIZ_FEEDBACK_MASCOT);
  });

  it("randomizes normal mascots without selecting the bonus mascot", () => {
    expect(pickQuizFeedbackMascotAnimation(false, 0, 0)?.id).toBe(
      NORMAL_QUIZ_FEEDBACK_MASCOTS[0]?.id,
    );
    expect(pickQuizFeedbackMascotAnimation(false, 0, 0.99)?.id).toBe(
      NORMAL_QUIZ_FEEDBACK_MASCOTS.at(-1)?.id,
    );
  });
});
