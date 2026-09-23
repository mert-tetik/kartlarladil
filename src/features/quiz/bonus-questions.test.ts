import { describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import type { Tier } from "@/types/domain";
import {
  buildCategoryBonusFromGenerated,
  buildFallbackCategoryBonusQuestion,
  buildFallbackSentenceOrderQuestion,
  buildImposterBonusQuestion,
  buildMatchingBonusQuestion,
  buildSentenceBonusFromGenerated,
  getMatchingLearnedTierWeights,
  getMatchingLearnedSelectionProbability,
} from "@/features/quiz/bonus-questions";

const ENGLISH_CARDS = VOCABULARY_CARDS.filter((card) => card.language === "en");

describe("bonus quiz questions", () => {
  it("builds a four-pair matching question from the full inventory pool", () => {
    const question = buildMatchingBonusQuestion(ENGLISH_CARDS.slice(0, 12), "tr", "session-matching");

    expect(question).not.toBeNull();
    expect(question?.pairs).toHaveLength(4);
    expect(new Set(question?.pairs.map((pair) => pair.cardId)).size).toBe(4);
    expect(question?.terms.map((pair) => pair.id).sort()).toEqual(
      question?.meanings.map((pair) => pair.id).sort(),
    );
  });

  it("uses progressive learned-card weights and keeps visible matching values unique", () => {
    expect(getMatchingLearnedSelectionProbability(10)).toBe(0.2);
    expect(getMatchingLearnedSelectionProbability(11)).toBe(0.4);
    expect(getMatchingLearnedSelectionProbability(20)).toBe(0.4);
    expect(getMatchingLearnedSelectionProbability(21)).toBe(0.6);
    expect(getMatchingLearnedSelectionProbability(30)).toBe(0.6);
    expect(getMatchingLearnedSelectionProbability(31)).toBe(0.75);
    expect(getMatchingLearnedSelectionProbability(39)).toBe(0.75);
    expect(getMatchingLearnedSelectionProbability(40)).toBe(0.9);

    const firstCard = ENGLISH_CARDS[0]!;
    const question = buildMatchingBonusQuestion(
      [...ENGLISH_CARDS.slice(0, 5), { ...firstCard, id: `${firstCard.id}-duplicate` }],
      "tr",
      "session-unique-values",
    );

    expect(question).not.toBeNull();
    expect(new Set(question?.pairs.map((pair) => pair.term)).size).toBe(4);
    expect(new Set(question?.pairs.map((pair) => pair.meaning)).size).toBe(4);
  });

  it("uses the learned-card tier distribution for each matching selection", () => {
    const tieredCards = ENGLISH_CARDS.slice(0, 12).map((card, index) => ({
      ...card,
      tier: (index < 4 ? "A1" : index < 8 ? "B1" : "C1") as Tier,
    }));
    const learnedCards = tieredCards.slice(0, 4);

    expect(getMatchingLearnedTierWeights(learnedCards)).toEqual({
      A1: 4,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const question = buildMatchingBonusQuestion(
        tieredCards,
        "tr",
        "session-tier-weighted-matching",
        learnedCards,
      );

      expect(question).not.toBeNull();
      expect(question?.pairs).toHaveLength(4);
      expect(question?.pairs.every((pair) => {
        return tieredCards.find((card) => card.id === pair.cardId)?.tier === "A1";
      })).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("keeps fallback sentence questions local and validates GPT token order", () => {
    const fallback = buildFallbackSentenceOrderQuestion(ENGLISH_CARDS.slice(0, 12), "session-sentence");
    expect(fallback).not.toBeNull();
    expect(fallback?.nativeSentence).toBeTruthy();

    const sentenceCard = ENGLISH_CARDS.find((card) => card.examples.some((example) => example.sentence.split(/\s+/u).length >= 2));
    const sentence = sentenceCard?.examples[0]?.sentence.trim();
    expect(sentenceCard).toBeDefined();
    expect(sentence).toBeTruthy();

    const generated = buildSentenceBonusFromGenerated(
      {
        sentence: sentence!,
        nativeSentence: "I learn",
        tokens: sentence!.split(/\s+/u),
        alternativeTokenOrders: [],
        sourceCardId: sentenceCard!.id,
      },
      ENGLISH_CARDS,
      "session-generated-sentence",
    );
    expect(generated?.tokens.map((token) => token.text).join(" ")).toBe(sentence);

    expect(
      buildSentenceBonusFromGenerated(
        {
          sentence: "This is not the token sequence",
          nativeSentence: "Bu token dizisi değil",
          tokens: ["different", "tokens"],
          alternativeTokenOrders: [],
          sourceCardId: sentenceCard!.id,
        },
        ENGLISH_CARDS,
        "session-invalid-sentence",
      ),
    ).toBeNull();
  });

  it("accepts valid alternative GPT sentence orders built from the same tokens", () => {
    const cards = ENGLISH_CARDS.slice(0, 12);
    const sourceCard = cards[0]!;
    const question = buildSentenceBonusFromGenerated(
      {
        sentence: "This pizza is the best in town",
        nativeSentence: "Bu pizza kasabadaki en iyisi",
        tokens: ["This", "pizza", "is", "the", "best", "in", "town"],
        alternativeTokenOrders: [["This", "is", "the", "best", "pizza", "in", "town"]],
        sourceCardId: sourceCard.id,
      },
      cards,
      "session-alternative-sentence",
    );

    expect(question).not.toBeNull();
    expect(question?.acceptedTokenOrders).toHaveLength(2);
    expect(question?.acceptedTokenOrders[1]?.map((id) => question.tokens.find((token) => token.id === id)?.text)).toEqual(
      ["This", "is", "the", "best", "pizza", "in", "town"],
    );
  });

  it("rejects alternative orders that do not preserve the exact token multiset", () => {
    const cards = ENGLISH_CARDS.slice(0, 12);
    const question = buildSentenceBonusFromGenerated(
      {
        sentence: "This pizza is the best in town",
        nativeSentence: "Bu pizza kasabadaki en iyisi",
        tokens: ["This", "pizza", "is", "the", "best", "in", "town"],
        alternativeTokenOrders: [
          ["This", "is", "the", "best", "pizza", "in", "town"],
          ["This", "is", "the", "best", "pizza", "in", "city"],
          ["This", "is", "the", "best", "pizza", "in", "town", "town"],
        ],
        sourceCardId: cards[0]!.id,
      },
      cards,
      "session-invalid-alternatives",
    );

    expect(question?.acceptedTokenOrders).toHaveLength(2);
  });

  it("creates three balanced local categories and an independent imposter question", () => {
    const category = buildFallbackCategoryBonusQuestion("en", "session-categories");
    const imposter = buildImposterBonusQuestion("en", "session-imposter");

    expect(category).not.toBeNull();
    expect(category?.categories).toHaveLength(3);
    expect(category?.categories.every((item) => item.wordIds.length === 3)).toBe(true);
    expect(category?.words).toHaveLength(9);

    expect(imposter).not.toBeNull();
    expect(imposter?.options).toHaveLength(6);
    expect(imposter?.options.filter((option) => !option.isImposter)).toHaveLength(5);
    expect(imposter?.options.filter((option) => option.isImposter)).toHaveLength(1);
  });

  it("rejects generated category payloads with duplicate or unknown cards", () => {
    const cards = ENGLISH_CARDS.slice(0, 9);
    const valid = buildCategoryBonusFromGenerated(
      {
        categories: [
          { name: "one", cardIds: cards.slice(0, 3).map((card) => card.id) },
          { name: "two", cardIds: cards.slice(3, 6).map((card) => card.id) },
          { name: "three", cardIds: cards.slice(6, 9).map((card) => card.id) },
        ],
      },
      cards,
      "session-generated-category",
    );
    const invalid = buildCategoryBonusFromGenerated(
      {
        categories: [
          { name: "one", cardIds: cards.slice(0, 3).map((card) => card.id) },
          { name: "two", cardIds: [cards[3]!.id, cards[3]!.id, cards[4]!.id] },
          { name: "three", cardIds: cards.slice(6, 9).map((card) => card.id) },
        ],
      },
      cards,
      "session-invalid-category",
    );

    expect(valid?.words).toHaveLength(9);
    expect(invalid).toBeNull();
  });
});
