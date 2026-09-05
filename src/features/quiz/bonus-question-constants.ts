export type BonusQuestionKind =
  | "matching"
  | "sentence-order"
  | "category-sort"
  | "imposter";

export const BONUS_QUESTION_POINTS: Record<BonusQuestionKind, number> = {
  matching: 25,
  "sentence-order": 30,
  "category-sort": 35,
  imposter: 20,
};

export function getBonusQuestionPoints(kind: BonusQuestionKind): number {
  return BONUS_QUESTION_POINTS[kind];
}
