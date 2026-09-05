import { QUIZ_COUNT_OPTIONS } from "@/features/quiz/chest-rewards";

/**
 * Result rewards use the selected quiz size as a multiplier. Keeping this
 * calculation shared prevents the animated and persisted rewards diverging.
 */
export function getQuizResultRewardPoints(stars: number, cardCount: number): number | null {
  const normalizedStars = Math.round(stars);
  const normalizedCardCount = Math.round(cardCount);

  if (
    !Number.isInteger(normalizedStars) ||
    normalizedStars < 1 ||
    normalizedStars > 5 ||
    !Number.isInteger(normalizedCardCount) ||
    !QUIZ_COUNT_OPTIONS.includes(normalizedCardCount as (typeof QUIZ_COUNT_OPTIONS)[number])
  ) {
    return null;
  }

  return normalizedStars * 2 * (normalizedCardCount / 10);
}
