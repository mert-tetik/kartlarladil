import { TIER_REQUIREMENTS } from "@/data/tiers";
import { getCardTranslation } from "@/features/cards/card-localization";
import { createId } from "@/lib/utils";
import type {
  InventoryCard,
  LocaleCode,
  PracticeAttempt,
  PracticeMode,
  QuizQuestion,
  Tier,
  VocabularyCard,
} from "@/types/domain";

export function getTierRequirement(tier: Tier) {
  return TIER_REQUIREMENTS[tier];
}

export function createInventoryCard(cardId: string, now = new Date().toISOString()): InventoryCard {
  return {
    cardId,
    status: "active",
    correctCount: 0,
    addedAt: now,
  };
}

export function addCardToInventory(cards: InventoryCard[], cardId: string, now = new Date().toISOString()) {
  if (cards.some((card) => card.cardId === cardId)) {
    return cards;
  }

  return [...cards, createInventoryCard(cardId, now)];
}

export function applyAnswerProgress(
  inventoryCard: InventoryCard,
  vocabularyCard: VocabularyCard,
  isCorrect: boolean,
  now = new Date().toISOString(),
): InventoryCard {
  // The product rule is intentionally strict: users cannot mark cards learned manually.
  // Only repeated correct quiz answers can move a card into learned status.
  const nextCorrectCount = isCorrect
    ? inventoryCard.correctCount + 1
    : Math.max(0, inventoryCard.correctCount - 1);
  const learned = nextCorrectCount >= getTierRequirement(vocabularyCard.tier);

  return {
    ...inventoryCard,
    correctCount: nextCorrectCount,
    status: learned ? "learned" : inventoryCard.status,
    learnedAt: learned ? inventoryCard.learnedAt ?? now : inventoryCard.learnedAt,
  };
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export function buildQuizQuestion(card: VocabularyCard, allCards: VocabularyCard[], locale: LocaleCode = "tr"): QuizQuestion {
  const correctAnswer = getCardTranslation(card, locale);
  const sameLanguageDistractors = allCards
    .filter((candidate) => candidate.language === card.language && candidate.id !== card.id)
    .map((candidate) => getCardTranslation(candidate, locale));
  const fallbackDistractors = allCards
    .filter((candidate) => candidate.id !== card.id)
    .map((candidate) => getCardTranslation(candidate, locale));

  const uniqueDistractors = Array.from(
    new Set([...sameLanguageDistractors, ...fallbackDistractors].filter((answer) => answer !== correctAnswer)),
  );
  const options = shuffle([correctAnswer, ...shuffle(uniqueDistractors).slice(0, 3)]);

  return {
    card,
    options,
    correctAnswer,
  };
}

export function createPracticeAttempt(input: {
  cardId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  mode: PracticeMode;
  now?: string;
}): PracticeAttempt {
  return {
    id: createId("attempt"),
    cardId: input.cardId,
    selectedAnswer: input.selectedAnswer,
    correctAnswer: input.correctAnswer,
    isCorrect: input.isCorrect,
    mode: input.mode,
    createdAt: input.now ?? new Date().toISOString(),
  };
}
