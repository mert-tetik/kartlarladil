import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { buildQuizPool } from "@/features/quiz/quiz-pool-engine";

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
    expect(pool.regularItems).toHaveLength(1);
    expect(pool.regularItems[0]).toMatchObject({
      card: { id: card.id },
      inventoryCard: { cardId: card.id },
      questionType: "text",
    });
    expect(pool.bonusPlans).toHaveLength(1);
    expect(() => JSON.stringify(pool)).not.toThrow();
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
});
