import { VOCABULARY_CARDS } from "@/data/cards";
import { findCustomCardMatch } from "@/features/cards/custom-card-matching";

describe("findCustomCardMatch", () => {
  it("matches a native-language input to a learning card translation", () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "en" && candidate.translations.tr,
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: card!.translations.tr,
      inputLanguage: "tr",
      targetLanguage: "en",
      direction: "native-to-learning",
    })).toBe(card);
  });

  it("matches a learning-language input to the card term in reverse mode", () => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en");
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: card!.term,
      inputLanguage: "tr",
      targetLanguage: "en",
      direction: "learning-to-native",
    })).toBe(card);
  });

  it("does not treat a native-language translation as a reverse-mode term", () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "en" && candidate.translations.tr,
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: card!.translations.tr,
      inputLanguage: "tr",
      targetLanguage: "en",
      direction: "learning-to-native",
    })).toBeUndefined();
  });

  it("does not use the learning-language term as a native input match", () => {
    const card = VOCABULARY_CARDS.find((candidate) => candidate.language === "en");
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: card!.term,
      inputLanguage: "tr",
      targetLanguage: "en",
      direction: "native-to-learning",
    })).toBeUndefined();
  });
});
