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

  it("matches a non-Latin card by its pronunciation when the input is transliterated", () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "ru" && candidate.term === "слушать",
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: "slushat",
      inputLanguage: "tr",
      targetLanguage: "ru",
      direction: "learning-to-native",
    })).toBe(card);
  });

  it("matches Turkish-style transliteration variants by the same pronunciation", () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "ru" && candidate.term === "слушать",
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: "slu\u015fat",
      inputLanguage: "tr",
      targetLanguage: "ru",
      direction: "learning-to-native",
    })).toBe(card);
  });

  it("ignores a Russian soft-sign apostrophe in transliterated input", () => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === "ru" && candidate.term === "слушать",
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: "slushat'",
      inputLanguage: "tr",
      targetLanguage: "ru",
      direction: "learning-to-native",
    })).toBe(card);
  });

  it.each([
    ["ar", "مرحبا", "marhaban"],
    ["ja", "こんにちは", "konnichiwa"],
    ["ko", "안녕하세요", "annyeonghaseyo"],
    ["zh-CN", "你好", "ni hao"],
  ] as const)("matches transliteration variants for %s", (targetLanguage, term, input) => {
    const card = VOCABULARY_CARDS.find(
      (candidate) => candidate.language === targetLanguage && candidate.term === term,
    );
    expect(card).toBeDefined();

    expect(findCustomCardMatch({
      cards: [card!],
      term: input,
      inputLanguage: "tr",
      targetLanguage,
      direction: "learning-to-native",
    })).toBe(card);
  });
});
