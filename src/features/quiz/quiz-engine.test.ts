import { VOCABULARY_CARDS } from "@/data/cards";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { filterInventoryCards } from "@/features/inventory/inventory-selectors";
import {
  addCardToInventory,
  applyAnswerProgress,
  buildQuizQuestion,
  createInventoryCard,
  getTierRequirement,
} from "@/features/quiz/quiz-engine";
import type { InventoryCard } from "@/types/domain";

describe("quiz engine", () => {
  it("exposes the planned tier requirements", () => {
    expect(getTierRequirement("A1")).toBe(2);
    expect(getTierRequirement("A2")).toBe(3);
    expect(getTierRequirement("B1")).toBe(4);
    expect(getTierRequirement("B2")).toBe(5);
    expect(getTierRequirement("C1")).toBe(6);
    expect(TIER_REQUIREMENTS).toEqual({ A1: 2, A2: 3, B1: 4, B2: 5, C1: 6 });
  });

  it("increments correct answers and marks a card learned at its tier threshold", () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1");
    expect(card).toBeDefined();

    const firstAnswer = applyAnswerProgress(createInventoryCard(card!.id), card!, true, "2026-01-01T00:00:00.000Z");
    const secondAnswer = applyAnswerProgress(firstAnswer, card!, true, "2026-01-02T00:00:00.000Z");

    expect(secondAnswer.correctCount).toBe(2);
    expect(secondAnswer.status).toBe("learned");
    expect(secondAnswer.learnedAt).toBe("2026-01-02T00:00:00.000Z");
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
});
