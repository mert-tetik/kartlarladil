export type BonusQuestionKind =
  | "matching"
  | "sentence-order"
  | "category-sort"
  | "imposter";

export const BONUS_QUESTION_PROBABILITY = 1 / 4;

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
