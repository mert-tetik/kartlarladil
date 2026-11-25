import { describe, expect, it, vi } from "vitest";
import { buildEasyLearningMatchingQuestion, EASY_LEARNING_BATCH_SIZE, type EasyLearningCandidate } from "@/features/quiz/easy-learning-quiz";
import type { VocabularyCard } from "@/types/domain";

function makeCandidate(index: number, meaning: string): EasyLearningCandidate {
  return {
    source: "pending",
    inventoryCard: null,
    card: {
      id: `card-${index}`,
      sourceKey: `card-${index}`,
      englishKey: `word-${index}`,
      language: "en",
      tier: "A1",
      termKind: "word",
      term: `word-${index}`,
      translation: meaning,
      translations: { tr: meaning } as VocabularyCard["translations"],
      translationMeaningsByLocale: { tr: [meaning] } as VocabularyCard["translationMeaningsByLocale"],
      pronunciation: "",
      partOfSpeech: "noun",
      example: "",
      exampleTranslation: "",
      examples: [],
      grammar: {} as VocabularyCard["grammar"],
      grammarByLocale: {} as VocabularyCard["grammarByLocale"],
    },
  };
}

describe("buildEasyLearningMatchingQuestion", () => {
  it("builds exactly five pairs and selects distinct alternate translations when needed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const candidates = [
      makeCandidate(1, "aynı"),
      makeCandidate(2, "aynı"),
      makeCandidate(3, "üç"),
      makeCandidate(4, "dört"),
      makeCandidate(5, "beş"),
    ];
    candidates[0]!.card.translationMeaningsByLocale.tr = ["aynı", "bir"];
    candidates[1]!.card.translationMeaningsByLocale.tr = ["aynı", "iki"];

    const question = buildEasyLearningMatchingQuestion(candidates, "tr", "test");

    expect(question?.pairs).toHaveLength(EASY_LEARNING_BATCH_SIZE);
    expect(new Set(question?.pairs.map((pair) => pair.meaning)).size).toBe(EASY_LEARNING_BATCH_SIZE);
    expect(question?.pairs.map((pair) => pair.cardId)).toEqual(candidates.map(({ card }) => card.id));
    vi.mocked(Math.random).mockRestore();
  });

  it("keeps all five cards even when the catalog has unavoidable duplicate translations", () => {
    const candidates = Array.from({ length: EASY_LEARNING_BATCH_SIZE }, (_, index) => makeCandidate(index, "aynı"));

    expect(buildEasyLearningMatchingQuestion(candidates, "tr", "test")?.pairs).toHaveLength(EASY_LEARNING_BATCH_SIZE);
  });
});
