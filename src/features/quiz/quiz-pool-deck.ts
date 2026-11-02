import { getMaxBonusQuestionCount } from "@/features/quiz/bonus-question-constants";
import { moveLearningQuestionsToEnd } from "@/features/quiz/quiz-deck-order";
import type { BonusQuizItem, PreparedQuizPool, QuizItem } from "@/features/quiz/quiz-pool-types";

export interface BuildPreparedQuizDeckOptions {
  targetRegularCount: number;
  sessionId: string;
  hasFixedQuestionType: boolean;
  bonusAfterEachNormalQuestion: boolean;
}

export interface PreparedQuizDeck {
  items: QuizItem[];
  categoryBonusIds: string[];
}

export function buildPreparedQuizDeck(
  pool: PreparedQuizPool,
  options: BuildPreparedQuizDeckOptions,
): PreparedQuizDeck {
  const regularCount = Math.min(options.targetRegularCount, pool.regularItems.length);
  const regularItems = pool.regularItems.slice(0, regularCount);
  // Keep the bonus quota tied to the selected session size while the pool
  // grows. Otherwise a later batch could add bonuses before earlier questions
  // and change the already-visible deck order.
  const bonusBasisCount = Math.min(options.targetRegularCount, pool.totalCandidateCount);
  const forceBonusAfterEachQuestion = options.bonusAfterEachNormalQuestion && !options.hasFixedQuestionType;
  const maxBonusQuestionCount = forceBonusAfterEachQuestion
    ? bonusBasisCount
    : options.hasFixedQuestionType
      ? 0
      : getMaxBonusQuestionCount(bonusBasisCount);
  const selectedBonusPlans = pool.bonusPlans
    .filter((plan) => plan.fallback && plan.index < regularCount && plan.selectedForMaxDeck)
    .slice(0, maxBonusQuestionCount);
  const selectedPlansByIndex = new Map(selectedBonusPlans.map((plan) => [plan.index, plan]));
  const categoryBonusIds: string[] = [];
  const items: QuizItem[] = [];

  for (const [index, item] of regularItems.entries()) {
    items.push(item);

    const plan = selectedPlansByIndex.get(index);
    if (!plan?.fallback) continue;

    const anchor = regularItems[0] ?? item;
    const bonusItem: BonusQuizItem = {
      card: anchor.card,
      inventoryCard: anchor.inventoryCard,
      // Keep a learning question's bonus beside it as incremental batches are
      // appended. The answer handler routes bonus items before this flag matters.
      willLearn: item.willLearn,
      isBonus: true,
      bonusId: `${options.sessionId}-${plan.kind}-${plan.index}`,
      questionType: `bonus-${plan.kind}`,
      bonusQuestion: plan.fallback,
    };
    items.push(bonusItem);

    if (plan.kind === "category-sort") categoryBonusIds.push(bonusItem.bonusId);
  }

  return {
    items: moveLearningQuestionsToEnd(items),
    categoryBonusIds,
  };
}

export function getQuizDeckItemKey(item: QuizItem) {
  return item.isBonus
    ? `bonus:${item.bonusId}`
    : `regular:${item.card.id}:${item.questionType}`;
}
