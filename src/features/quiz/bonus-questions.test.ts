import { describe, expect, it } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  buildCategoryBonusFromGenerated,
  buildFallbackCategoryBonusQuestion,
  buildFallbackSentenceOrderQuestion,
  buildImposterBonusQuestion,
  buildMatchingBonusQuestion,
  buildSentenceBonusFromGenerated,
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

  it("keeps fallback sentence questions local and validates GPT token order", () => {
    const fallback = buildFallbackSentenceOrderQuestion(ENGLISH_CARDS.slice(0, 12), "session-sentence");
    expect(fallback).not.toBeNull();

    const sentenceCard = ENGLISH_CARDS.find((card) => card.examples.some((example) => example.sentence.split(/\s+/u).length >= 2));
    const sentence = sentenceCard?.examples[0]?.sentence.trim();
    expect(sentenceCard).toBeDefined();
    expect(sentence).toBeTruthy();

    const generated = buildSentenceBonusFromGenerated(
      {
        sentence: sentence!,
        tokens: sentence!.split(/\s+/u),
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
          tokens: ["different", "tokens"],
          sourceCardId: sentenceCard!.id,
        },
        ENGLISH_CARDS,
        "session-invalid-sentence",
      ),
    ).toBeNull();
  });

  it("creates three balanced local categories and an independent imposter question", () => {
    const category = buildFallbackCategoryBonusQuestion("en", "session-categories");
    const imposter = buildImposterBonusQuestion("en", "session-imposter");

    expect(category).not.toBeNull();
    expect(category?.categories).toHaveLength(3);
    expect(category?.categories.every((item) => item.wordIds.length === 3)).toBe(true);
    expect(category?.words).toHaveLength(9);

    expect(imposter).not.toBeNull();
    expect(imposter?.options).toHaveLength(5);
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
