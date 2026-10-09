export const QUIZ_BUTTON_FEEDBACK_DURATION_MS = 700;

const CORRECT_STREAK_SPEED_CAP = 5;
// Keep the new streak acceleration deliberately gentle: only half of the
// previous duration reduction and half of the previous pitch increase.
const FASTEST_CORRECT_BUTTON_FEEDBACK_DURATION_MS = 450;
const FASTEST_CORRECT_ANSWER_PLAYBACK_RATE = 1.2;

function normalizeCorrectStreak(correctStreak: number) {
  return Math.max(
    1,
    Math.min(CORRECT_STREAK_SPEED_CAP, Math.floor(correctStreak)),
  );
}

export function getCorrectAnswerFeedbackDurationMs(correctStreak: number) {
  const normalizedStreak = normalizeCorrectStreak(correctStreak);

  return Math.round(
    QUIZ_BUTTON_FEEDBACK_DURATION_MS -
      ((QUIZ_BUTTON_FEEDBACK_DURATION_MS - FASTEST_CORRECT_BUTTON_FEEDBACK_DURATION_MS) *
        (normalizedStreak - 1)) /
        (CORRECT_STREAK_SPEED_CAP - 1),
  );
}

export function getCorrectAnswerPlaybackRate(correctStreak: number) {
  const normalizedStreak = Math.max(
    1,
    Math.min(CORRECT_STREAK_SPEED_CAP, Math.floor(correctStreak)),
  );

  return Number(
    (
      1 +
      ((FASTEST_CORRECT_ANSWER_PLAYBACK_RATE - 1) * (normalizedStreak - 1)) /
        (CORRECT_STREAK_SPEED_CAP - 1)
    ).toFixed(2),
  );
}

/** @deprecated Use getCorrectAnswerFeedbackDurationMs instead. */
export const getCorrectAnswerFeedbackDelayMs = getCorrectAnswerFeedbackDurationMs;
