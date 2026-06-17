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
});
