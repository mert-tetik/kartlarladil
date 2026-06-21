import { TIER_REQUIREMENTS } from "@/data/tiers";
import { getPrimaryCardTranslation } from "@/features/cards/card-localization";
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
  const correctAnswer = getPrimaryCardTranslation(card, locale);
  const sameLanguageDistractors = allCards
    .filter((candidate) => candidate.language === card.language && candidate.id !== card.id)
    .map((candidate) => getPrimaryCardTranslation(candidate, locale));
  const fallbackDistractors = allCards
    .filter((candidate) => candidate.id !== card.id)
    .map((candidate) => getPrimaryCardTranslation(candidate, locale));

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

export function isAnswerSimilarEnough(input: string, correctAnswer: string, threshold = 0.75) {
  const normalizedInput = normalizeQuizAnswer(input);
  const normalizedCorrect = normalizeQuizAnswer(correctAnswer);

  if (normalizedInput.length === 0 || normalizedCorrect.length === 0) {
    return false;
  }

  if (normalizedInput === normalizedCorrect) {
    return true;
  }

  const distance = levenshteinDistance(normalizedInput, normalizedCorrect);
  const similarity = 1 - distance / Math.max(normalizedInput.length, normalizedCorrect.length);

  return similarity >= threshold;
}

function normalizeQuizAnswer(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function levenshteinDistance(a: string, b: string) {
  const matrix: number[][] = [];

  for (let rowIndex = 0; rowIndex <= b.length; rowIndex += 1) {
    matrix[rowIndex] = [rowIndex];
  }

  for (let columnIndex = 1; columnIndex <= a.length; columnIndex += 1) {
    matrix[0][columnIndex] = columnIndex;
  }

  for (let rowIndex = 1; rowIndex <= b.length; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= a.length; columnIndex += 1) {
      const cost = a[columnIndex - 1] === b[rowIndex - 1] ? 0 : 1;
      matrix[rowIndex][columnIndex] = Math.min(
        matrix[rowIndex - 1][columnIndex] + 1,
        matrix[rowIndex][columnIndex - 1] + 1,
        matrix[rowIndex - 1][columnIndex - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
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
