import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buildQuizPool } from "@/features/quiz/quiz-pool-engine";
import { buildPreparedQuizDeck, getQuizDeckItemKey } from "@/features/quiz/quiz-pool-deck";
import type { BonusQuestion } from "@/features/quiz/bonus-questions";

const matchingQuestion: BonusQuestion = {
  kind: "matching",
  pairs: [{ id: "pair-1", cardId: "card-1", term: "word", meaning: "meaning" }],
  terms: [{ id: "pair-1", cardId: "card-1", term: "word", meaning: "meaning" }],
  meanings: [{ id: "pair-1", cardId: "card-1", term: "word", meaning: "meaning" }],
};

describe("buildPreparedQuizDeck", () => {
  it("keeps the already prepared deck as a prefix while more questions arrive", async () => {
    const cards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 12);
    const completePool = await buildQuizPool({
      key: "deck-pool",
      seed: "deck-seed",
      cards: cards.map((card) => ({
        cardId: card.id,
        status: "active",
        correctCount: 0,
        addedAt: "2026-01-01T00:00:00.000Z",
      })),
      customCards: [],
      language: "en",
      mode: "active",
      locale: "en",
      normalQuestionType: "text",
      bonusAfterEachNormalQuestion: false,
    });
    const pool = {
      ...completePool,
      bonusPlans: completePool.bonusPlans.map((plan) => ({
        ...plan,
        fallback: matchingQuestion,
        selectedForMaxDeck: plan.index < 4,
      })),
    };
    const partialPool = {
      ...pool,
      regularItems: pool.regularItems.slice(0, 5),
      bonusPlans: pool.bonusPlans.slice(0, 5),
      complete: false,
    };
    const options = {
      targetRegularCount: 10,
      sessionId: "stable-session",
      hasFixedQuestionType: false,
      bonusAfterEachNormalQuestion: false,
    };

    const partialDeck = buildPreparedQuizDeck(partialPool, options).items;
    const completeDeck = buildPreparedQuizDeck(pool, options).items;

    expect(partialDeck.map(getQuizDeckItemKey)).toEqual(
      completeDeck.slice(0, partialDeck.length).map(getQuizDeckItemKey),
    );
  });
});
