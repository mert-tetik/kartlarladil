export const QUIZ_BUTTON_FEEDBACK_DURATION_MS = 700;

const CORRECT_STREAK_WITHOUT_WAIT = 5;

export function getCorrectAnswerFeedbackDelayMs(correctStreak: number) {
  const normalizedStreak = Math.max(
    1,
    Math.min(CORRECT_STREAK_WITHOUT_WAIT, Math.floor(correctStreak)),
  );

  return Math.round(
    (QUIZ_BUTTON_FEEDBACK_DURATION_MS *
      (CORRECT_STREAK_WITHOUT_WAIT - normalizedStreak)) /
      (CORRECT_STREAK_WITHOUT_WAIT - 1),
  );
}
