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
