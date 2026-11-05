export type BonusQuestionKind =
  | "matching"
  | "sentence-order"
  | "category-sort"
  | "imposter";

export const BONUS_QUESTION_PROBABILITY = 2 / 10;
export const BONUS_QUESTION_LATE_PROBABILITY = 1 / 10;
export const BONUS_QUESTION_EARLY_WINDOW = 10;

/**
 * The index is zero-based and counts regular quiz questions.
 * The first ten regular questions use the higher probability.
 */
export function getBonusQuestionProbability(regularQuestionIndex: number): number {
  return regularQuestionIndex < BONUS_QUESTION_EARLY_WINDOW
    ? BONUS_QUESTION_PROBABILITY
    : BONUS_QUESTION_LATE_PROBABILITY;
}

export const BONUS_QUESTION_TYPE_WEIGHTS: Record<BonusQuestionKind, number> = {
  matching: 0.4,
  "sentence-order": 0.2,
  "category-sort": 0.2,
  imposter: 0.2,
};

export function getMaxBonusQuestionCount(regularQuestionCount: number) {
  const normalizedCount = Math.max(0, Math.floor(regularQuestionCount));

  if (normalizedCount === 0) return 0;

  return Math.min(normalizedCount, Math.max(1, Math.floor(normalizedCount / 3)));
}

export const BONUS_QUESTION_POINTS: Record<BonusQuestionKind, number> = {
  matching: 25,
  "sentence-order": 30,
  "category-sort": 35,
  imposter: 20,
};

export function getBonusQuestionPoints(kind: BonusQuestionKind): number {
  return BONUS_QUESTION_POINTS[kind];
}
