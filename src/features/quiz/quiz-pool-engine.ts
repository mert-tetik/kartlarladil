import { VOCABULARY_CARDS } from "@/data/cards";
import { getStudyLocale } from "@/features/cards/card-localization";
import {
  buildQuizQuestion,
  buildListeningQuizQuestion,
  buildDefinitionQuizQuestion,
  buildSentenceCompletionQuizQuestion,
  buildTrueFalseQuizQuestion,
  getTierRequirement,
  shouldUseSentenceCompletionQuestion,
  shouldUseListeningQuestion,
  shouldUseDefinitionQuestion,
  shouldUseTrueFalseQuestion,
} from "@/features/quiz/quiz-engine";
import { moveLearningQuestionsToEnd } from "@/features/quiz/quiz-deck-order";
import { buildGroupQuestion, shouldUseGroupQuestion } from "@/features/quiz/group-question";
import {
  buildFallbackCategoryBonusQuestion,
  buildFallbackSentenceOrderQuestion,
  buildImposterBonusQuestion,
  buildMatchingBonusQuestion,
  type BonusQuestion,
  type BonusQuestionKind,
} from "@/features/quiz/bonus-questions";
import {
  BONUS_QUESTION_PROBABILITY,
  BONUS_QUESTION_TYPE_WEIGHTS,
} from "@/features/quiz/bonus-question-constants";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import type { InventoryCard, LanguageCode, LocaleCode, PracticeMode, VocabularyCard } from "@/types/domain";
import type { PreparedBonusPlan, PreparedQuizPool, QuizItem } from "@/features/quiz/quiz-pool-types";

export type NormalQuestionType =
  | "choice"
  | "listening"
  | "definition"
  | "text"
  | "true-false"
  | "sentence-completion"
  | "group"
  | null;

export interface QuizPoolInput {
  key: string;
  seed: string;
  cards: InventoryCard[];
  customCards: VocabularyCard[];
  language: LanguageCode;
  mode: PracticeMode;
  locale: LocaleCode;
  normalQuestionType: NormalQuestionType;
  bonusAfterEachNormalQuestion: boolean;
}

const BONUS_QUESTION_KINDS: readonly BonusQuestionKind[] = [
  "matching",
  "sentence-order",
  "category-sort",
  "imposter",
];

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function createSeededRandom(seed: string) {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getBonusKind(excludedKinds: ReadonlySet<BonusQuestionKind>): BonusQuestionKind {
  const availableKinds = BONUS_QUESTION_KINDS.filter(
    (kind) => kind === "matching" || !excludedKinds.has(kind),
  );
  const totalWeight = availableKinds.reduce(
    (total, kind) => total + BONUS_QUESTION_TYPE_WEIGHTS[kind],
    0,
  );
  let roll = Math.random() * totalWeight;

  for (const kind of availableKinds) {
    roll -= BONUS_QUESTION_TYPE_WEIGHTS[kind];
    if (roll < 0) return kind;
  }
  return "matching";
}

function buildFallbackBonusQuestion(
  kind: BonusQuestionKind,
  cards: VocabularyCard[],
  language: LanguageCode,
  locale: LocaleCode,
  seed: string,
  learnedCards: VocabularyCard[] = [],
): BonusQuestion | null {
  if (kind === "matching") return buildMatchingBonusQuestion(cards, locale, seed, learnedCards);
  if (kind === "sentence-order") return buildFallbackSentenceOrderQuestion(cards, seed, locale);
  if (kind === "category-sort") return buildFallbackCategoryBonusQuestion(language, seed);
  return buildImposterBonusQuestion(language, seed);
}

function getCardMap(customCards: VocabularyCard[]) {
  const customBySourceKey = new Map(customCards.map((card) => [card.sourceKey, card]));
  const cards = [
    ...VOCABULARY_CARDS.filter((card) => !customBySourceKey.has(card.sourceKey)),
    ...customCards,
  ];
  return new Map(cards.flatMap((card) => [[card.id, card] as const, [card.sourceKey, card] as const]));
}

function getRandomCharacter() {
  const characters = getAiPracticeCharacters();
  return characters[Math.floor(Math.random() * characters.length)];
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function buildQuizPool(
  input: QuizPoolInput,
  shouldCancel: () => boolean = () => false,
): Promise<PreparedQuizPool> {
  const {
    key,
    seed,
    cards,
    customCards,
    language,
    mode,
    locale,
    normalQuestionType,
    bonusAfterEachNormalQuestion,
  } = input;
  const cardById = getCardMap(customCards);
  const inventoryById = new Map(cards.map((item) => [item.cardId, item]));
  const joined = cards.flatMap((inventory) => {
    const card = cardById.get(inventory.cardId);
    return card ? [{ inventory, card }] : [];
  });
  const source = joined
    .filter(({ inventory, card }) =>
      card.language === language && inventory.status.trim().toLowerCase() === mode,
    )
    .map(({ card }) => card);
  const maxRegularCount = Math.min(50, source.length);
  const listeningCards = [...VOCABULARY_CARDS, ...source];
  const shuffled = shuffle(source).slice(0, maxRegularCount);
  const hasNoLearnedCards = !cards.some((item) => item.status === "learned");
  const builtRegularItems: QuizItem[] = [];

  for (const [index, card] of shuffled.entries()) {
    if (shouldCancel()) throw new DOMException("Quiz preparation cancelled", "AbortError");
    const inventoryCard = inventoryById.get(card.id) ?? inventoryById.get(card.sourceKey);
    if (!inventoryCard) continue;

    const requirement = getTierRequirement(card.tier);
    const answerLocale = getStudyLocale(card.language, locale);
    let built: QuizItem | null = null;

    if (normalQuestionType) {
      const willLearn = inventoryCard.status !== "learned" && inventoryCard.correctCount + 1 >= requirement;
      const forceLearned = mode === "active" && hasNoLearnedCards && index === 0;
      switch (normalQuestionType) {
        case "choice":
          built = { card, inventoryCard, questionType: "choice", question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale), willLearn, forceLearned };
          break;
        case "listening": {
          const question = buildListeningQuizQuestion(card, listeningCards);
          built = question ? { card, inventoryCard, questionType: "listening", question, willLearn, forceLearned } : null;
          break;
        }
        case "definition": {
          const question = buildDefinitionQuizQuestion(card, VOCABULARY_CARDS, answerLocale);
          built = question ? { card, inventoryCard, questionType: "definition", question, willLearn, forceLearned } : null;
          break;
        }
        case "text":
          built = { card, inventoryCard, questionType: "text", question: { correctAnswer: card.term }, willLearn, forceLearned };
          break;
        case "true-false":
          built = { card, inventoryCard, questionType: "true-false", question: buildTrueFalseQuizQuestion(card, VOCABULARY_CARDS, answerLocale), willLearn, forceLearned };
          break;
        case "sentence-completion": {
          const question = buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS);
          built = question ? { card, inventoryCard, questionType: "sentence-completion", question, character: getRandomCharacter(), willLearn, forceLearned } : null;
          break;
        }
        case "group": {
          const question = buildGroupQuestion(card, createSeededRandom(`${seed}-group-${card.id}`));
          built = question ? { card, inventoryCard, questionType: "group", question, character: getRandomCharacter(), willLearn, forceLearned } : null;
          break;
        }
      }
    } else if (mode === "active" && hasNoLearnedCards && index === 0) {
      built = {
        card,
        inventoryCard,
        questionType: "choice",
        question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale),
        willLearn: true,
        forceLearned: true,
      };
    } else {
      const willLearn = inventoryCard.status !== "learned" && inventoryCard.correctCount + 1 >= requirement;
      const isLearningQuestion = mode === "active" && willLearn;
      if (isLearningQuestion && shouldUseDefinitionQuestion()) {
        const question = buildDefinitionQuizQuestion(card, VOCABULARY_CARDS, answerLocale);
        if (question) built = { card, inventoryCard, questionType: "definition", question, willLearn: true };
      }
      if (!built && isLearningQuestion) {
        built = { card, inventoryCard, questionType: "text", question: { correctAnswer: card.term }, willLearn: true };
      }
      if (!built) {
        const question = shouldUseSentenceCompletionQuestion(isLearningQuestion)
          ? buildSentenceCompletionQuizQuestion(card, VOCABULARY_CARDS)
          : null;
        if (question) {
          built = { card, inventoryCard, questionType: "sentence-completion", question, character: getRandomCharacter(), willLearn: false };
        }
      }
      if (!built) {
        const groupRandom = createSeededRandom(`${seed}-group-${card.id}`);
        const question = shouldUseGroupQuestion(groupRandom) ? buildGroupQuestion(card, groupRandom) : null;
        if (question) built = { card, inventoryCard, questionType: "group", question, character: getRandomCharacter(), willLearn: false };
      }
      if (!built && shouldUseTrueFalseQuestion(inventoryCard, mode)) {
        built = { card, inventoryCard, questionType: "true-false", question: buildTrueFalseQuizQuestion(card, VOCABULARY_CARDS, answerLocale), willLearn: false };
      }
      if (!built && shouldUseListeningQuestion()) {
        const question = buildListeningQuizQuestion(card, listeningCards);
        if (question) built = { card, inventoryCard, questionType: "listening", question, willLearn: false };
      }
      if (!built) {
        built = { card, inventoryCard, questionType: "choice", question: buildQuizQuestion(card, VOCABULARY_CARDS, answerLocale), willLearn: false };
      }
    }
    if (built) builtRegularItems.push(built);
    await yieldToEventLoop();
  }

  const regularItems = moveLearningQuestionsToEnd(builtRegularItems);
  const bonusInventoryCards = joined.filter(({ card }) => card.language === language);
  const bonusCards = bonusInventoryCards.map(({ card }) => card);
  const bonusLearnedCards = bonusInventoryCards
    .filter(({ inventory }) => inventory.status.trim().toLowerCase() === "learned")
    .map(({ card }) => card);
  const forceBonusAfterEachQuestion = bonusAfterEachNormalQuestion && !normalQuestionType;
  const usedNonMatchingBonusKinds = new Set<BonusQuestionKind>();
  const bonusPlans: PreparedBonusPlan[] = [];

  for (const [index] of regularItems.entries()) {
    if (shouldCancel()) throw new DOMException("Quiz preparation cancelled", "AbortError");
    const preferredKind = getBonusKind(usedNonMatchingBonusKinds);
    const candidateKinds = [
      preferredKind,
      ...shuffle(BONUS_QUESTION_KINDS.filter((kind) => kind !== preferredKind && (kind === "matching" || !usedNonMatchingBonusKinds.has(kind)))),
    ];
    let selectedKind = preferredKind;
    let selectedFallback: BonusQuestion | null = null;
    for (const candidateKind of candidateKinds) {
      const fallback = buildFallbackBonusQuestion(
        candidateKind,
        bonusCards,
        language,
        locale,
        `${seed}-bonus-${candidateKind}-${index}`,
        bonusLearnedCards,
      );
      if (fallback) {
        selectedKind = candidateKind;
        selectedFallback = fallback;
        break;
      }
    }
    const selectedForMaxDeck = Boolean(
      selectedFallback && (forceBonusAfterEachQuestion || Math.random() < BONUS_QUESTION_PROBABILITY),
    );
    if (selectedForMaxDeck && selectedKind !== "matching") usedNonMatchingBonusKinds.add(selectedKind);
    bonusPlans.push({ index, kind: selectedKind, fallback: selectedFallback, selectedForMaxDeck });
    await yieldToEventLoop();
  }

  if (shouldCancel()) throw new DOMException("Quiz preparation cancelled", "AbortError");
  return { key, regularItems, bonusCards, bonusLearnedCards, bonusPlans };
}
