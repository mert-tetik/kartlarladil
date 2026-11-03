import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buildQuizPool } from "@/features/quiz/quiz-pool-engine";
import type { QuizPoolProgressUpdate } from "@/features/quiz/quiz-pool-types";

describe("buildQuizPool", () => {
  it("prepares a serializable question pool from the supplied inventory snapshot", async () => {
    const card = VOCABULARY_CARDS[0];
    const pool = await buildQuizPool({
      key: "test-pool",
      seed: "test-seed",
      cards: [{ cardId: card.id, status: "active", correctCount: 0, addedAt: "2026-01-01T00:00:00.000Z" }],
      customCards: [],
      language: card.language,
      mode: "active",
      locale: "en",
      normalQuestionType: "text",
      bonusAfterEachNormalQuestion: false,
    });

    expect(pool.key).toBe("test-pool");
    expect(pool).toMatchObject({ totalCandidateCount: 1, metadataReady: true, complete: true });
    expect(pool.regularItems).toHaveLength(1);
    expect(pool.regularItems[0]).toMatchObject({
      card: { id: card.id },
      inventoryCard: { cardId: card.id },
      questionType: "text",
    });
    expect(pool.bonusPlans).toHaveLength(1);
    expect(() => JSON.stringify(pool)).not.toThrow();
  });

  it("does not force a first active card to become learned for a new learner", async () => {
    const card = VOCABULARY_CARDS.find((item) => item.tier === "A1")!;
    const pool = await buildQuizPool({
      key: "new-learner-pool",
      seed: "new-learner-seed",
      cards: [{ cardId: card.id, status: "active", correctCount: 0, addedAt: "2026-01-01T00:00:00.000Z" }],
      customCards: [],
      language: card.language,
      mode: "active",
      locale: "en",
      normalQuestionType: null,
      bonusAfterEachNormalQuestion: false,
    });

    expect(pool.regularItems).toHaveLength(1);
    expect(pool.regularItems[0]?.willLearn).toBe(false);
    expect(pool.regularItems[0]).not.toHaveProperty("forceLearned");
  });

  it("stops when the preparation has been cancelled", async () => {
    await expect(buildQuizPool({
      key: "cancelled-pool",
      seed: "cancelled-seed",
      cards: [],
      customCards: [],
      language: "en",
      mode: "active",
      locale: "en",
      normalQuestionType: null,
      bonusAfterEachNormalQuestion: false,
    }, () => true)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("emits prepared question batches before the full pool completes", async () => {
    const cards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 6);
    const updates: QuizPoolProgressUpdate[] = [];

    const pool = await buildQuizPool({
      key: "progressive-pool",
      seed: "progressive-seed",
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
    }, undefined, (update) => updates.push(update));

    const questionUpdates = updates.filter((update) => update.regularItems.length > 0);
    expect(updates[0]).toMatchObject({
      totalCandidateCount: cards.length,
      regularItems: [],
      metadata: expect.any(Object),
    });
    expect(questionUpdates.length).toBeGreaterThan(1);
    expect(questionUpdates.every((update) => update.regularItems.length <= 2)).toBe(true);
    expect(questionUpdates.flatMap((update) => update.regularItems)).toEqual(pool.regularItems);
    expect(questionUpdates.flatMap((update) => update.bonusPlans)).toEqual(pool.bonusPlans);
  });
});
