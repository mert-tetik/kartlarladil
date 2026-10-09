type LearningQuestionItem = {
  willLearn: boolean;
};

/**
 * Moves card-learning questions to the end of the regular quiz sequence.
 */
export function moveLearningQuestionsToEnd<T extends LearningQuestionItem>(
  items: readonly T[],
): T[] {
  const regularItems: T[] = [];
  const learningItems: T[] = [];

  for (const item of items) {
    if (item.willLearn) {
      learningItems.push(item);
    } else {
      regularItems.push(item);
    }
  }

  return regularItems.concat(learningItems);
}

export function getUniqueCardsForRepetition<T extends { id: string }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
