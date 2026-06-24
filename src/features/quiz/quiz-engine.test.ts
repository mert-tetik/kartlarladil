import { VOCABULARY_CARDS } from "@/data/cards";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { getPrimaryCardTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import {
  addCardToInventory,
  applyAnswerProgress,
  buildQuizQuestion,
  createInventoryCard,
  getTierRequirement,
  isAnswerSimilarEnough,
} from "@/features/quiz/quiz-engine";
import type { InventoryCard } from "@/types/domain";

describe("quiz engine", () => {
  it("exposes the planned tier requirements", () => {
    expect(getTierRequirement("A1")).toBe(4);
    expect(getTierRequirement("A2")).toBe(4);
    expect(getTierRequirement("B1")).toBe(6);
    expect(getTierRequirement("B2")).toBe(6);
    expect(getTierRequirement("C1")).toBe(8);
    expect(TIER_REQUIREMENTS).toEqual({ A1: 4, A2: 4, B1: 6, B2: 6, C1: 8 });
  });

  it("increments correct answers and marks a card learned at its tier threshold", () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1");
    expect(card).toBeDefined();

    let state = createInventoryCard(card!.id);
    for (let step = 1; step <= 4; step += 1) {
      state = applyAnswerProgress(
        state,
        card!,
        true,
        `2026-01-0${step}T00:00:00.000Z`,
      );
    }

    expect(state.correctCount).toBe(4);
    expect(state.status).toBe("learned");
    expect(state.learnedAt).toBe("2026-01-04T00:00:00.000Z");
  });

  it("decrements wrong answers without going below zero", () => {
    const card = VOCABULARY_CARDS[0];
    const activeCard: InventoryCard = {
      ...createInventoryCard(card.id),
      correctCount: 1,
    };

    const firstWrong = applyAnswerProgress(activeCard, card, false);
    const secondWrong = applyAnswerProgress(firstWrong, card, false);

    expect(firstWrong.correctCount).toBe(0);
    expect(secondWrong.correctCount).toBe(0);
    expect(secondWrong.status).toBe("active");
  });

  it("does not add the same card twice", () => {
    const card = VOCABULARY_CARDS[0];
    const first = addCardToInventory([], card.id);
    const second = addCardToInventory(first, card.id);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  it("keeps inventory cards separated by language", () => {
    const enCard = VOCABULARY_CARDS.find((card) => card.language === "en")!;
    const deCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;
    const inventory = [createInventoryCard(enCard.id), createInventoryCard(deCard.id)];

    expect(filterInventoryCards({ cards: inventory, language: "en" })).toHaveLength(1);
    expect(filterInventoryCards({ cards: inventory, language: "de" })).toHaveLength(1);
    expect(filterInventoryCards({ cards: inventory, language: "ru" })).toHaveLength(0);
  });

  it("builds a four-option multiple choice question", () => {
    const question = buildQuizQuestion(VOCABULARY_CARDS[0], VOCABULARY_CARDS);

    expect(question.options).toHaveLength(4);
    expect(question.options).toContain(question.correctAnswer);
  });

  it("uses only the primary meaning for multiple choice answers", () => {
    const card = VOCABULARY_CARDS.find(
      (item) => item.language !== "tr" && item.translationMeaningsByLocale.tr.length > 1,
    );
    expect(card).toBeDefined();

    const question = buildQuizQuestion(card!, VOCABULARY_CARDS, "tr");

    expect(question.correctAnswer).toBe(card!.translationMeaningsByLocale.tr[0]);
    expect(question.correctAnswer).not.toContain(",");
  });

  it("keeps distractors in the requested answer language", () => {
    const card = VOCABULARY_CARDS.find((item) => item.language === "en" && item.translationMeaningsByLocale.tr.length > 0);
    expect(card).toBeDefined();

    const question = buildQuizQuestion(card!, VOCABULARY_CARDS, "tr");
    const eligibleAnswers = new Set(
      VOCABULARY_CARDS
        .filter((candidate) => candidate.id !== card!.id && getStudyLocale(candidate.language, "tr") === "tr")
        .map((candidate) => getPrimaryCardTranslation(candidate, "tr")),
    );

    for (const option of question.options) {
      if (option === question.correctAnswer) {
        continue;
      }

      expect(eligibleAnswers.has(option)).toBe(true);
    }
  });

  describe("isAnswerSimilarEnough", () => {
    it("accepts an answer that is only missing the last three letters", () => {
      expect(isAnswerSimilarEnough("dance", "dancing")).toBe(true);
      expect(isAnswerSimilarEnough("danc", "dancing")).toBe(true);
    });

    it("accepts an answer that adds up to three extra trailing letters", () => {
      expect(isAnswerSimilarEnough("dancing", "dance")).toBe(true);
    });

    it("accepts an answer when only the last three letters differ", () => {
      expect(isAnswerSimilarEnough("dancery", "dancing")).toBe(true);
      expect(isAnswerSimilarEnough("dancer", "dancing")).toBe(true);
    });

    it("rejects an answer when more than the last three letters are missing", () => {
      expect(isAnswerSimilarEnough("dan", "dancing")).toBe(false);
    });

    it("rejects an answer when the mismatch is not in the last three letters", () => {
      expect(isAnswerSimilarEnough("dane", "dancing")).toBe(false);
    });

    it("rejects an answer that is too different even when the first three letters match", () => {
      expect(isAnswerSimilarEnough("dankingly", "dancing")).toBe(false);
      expect(isAnswerSimilarEnough("danceable", "dancing")).toBe(false);
    });

    it("still accepts small typos within the similarity threshold", () => {
      expect(isAnswerSimilarEnough("dancig", "dancing")).toBe(true);
    });
  });
});
