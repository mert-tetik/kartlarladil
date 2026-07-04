export const QUIZ_STREAK_STEP = 5;
export const QUIZ_STREAK_POINTS_PER_STEP = 20;

export function getRewardableQuizStreak(streak: number) {
  if (streak < QUIZ_STREAK_STEP) {
    return 0;
  }

  return Math.floor(streak / QUIZ_STREAK_STEP) * QUIZ_STREAK_STEP;
}

export function getQuizStreakRewardPoints(streak: number) {
  return Math.floor(streak / QUIZ_STREAK_STEP) * QUIZ_STREAK_POINTS_PER_STEP;
}
