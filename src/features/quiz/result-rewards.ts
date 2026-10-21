import { QUIZ_COUNT_OPTIONS } from "@/features/quiz/chest-rewards";

/**
 * Result rewards use the selected quiz size as a multiplier. Keeping this
 * calculation shared prevents the animated and persisted rewards diverging.
 */
export function getQuizResultRewardPoints(medals: number, cardCount: number): number | null {
  const normalizedMedals = Math.round(medals);
  const normalizedCardCount = Math.round(cardCount);

  if (
    !Number.isInteger(normalizedMedals) ||
    normalizedMedals < 1 ||
    normalizedMedals > 5 ||
    !Number.isInteger(normalizedCardCount) ||
    !QUIZ_COUNT_OPTIONS.includes(normalizedCardCount as (typeof QUIZ_COUNT_OPTIONS)[number])
  ) {
    return null;
  }

  return normalizedMedals * 2 * (normalizedCardCount / 10);
}

export function getQuizSessionEarnedPoints({
  currentTotalPoints,
  startingTotalPoints,
  confirmedBonusPoints,
  currentQuizResultPoints,
  startingQuizResultPoints,
}: {
  currentTotalPoints: number;
  startingTotalPoints: number;
  confirmedBonusPoints: number;
  currentQuizResultPoints: number;
  startingQuizResultPoints: number;
}) {
  const safePoints = (points: number) =>
    Number.isFinite(points) ? Math.max(0, Math.floor(points)) : 0;
  const totalPointsEarned = Math.max(
    0,
    safePoints(currentTotalPoints) - safePoints(startingTotalPoints),
  );
  const bonusPointsAlreadyInTotal = Math.max(
    0,
    safePoints(currentQuizResultPoints) - safePoints(startingQuizResultPoints),
  );
  const confirmedBonusPointsNotInTotal = Math.max(
    0,
    safePoints(confirmedBonusPoints) - bonusPointsAlreadyInTotal,
  );

  return totalPointsEarned + confirmedBonusPointsNotInTotal;
}
