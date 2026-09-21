import {
  buildCreateCardInput,
  buildCreateCardInstructions,
} from "@/features/cards/create-card-prompts";
import {
  createCardRequestSchema,
  isSupportedCreateCardDirection,
  matchesRequestedTargetLanguage,
  matchesRequestedTargetWritingSystem,
  shouldRetryForDictionaryLemma,
} from "@/features/cards/create-card-schema";
import {
  containsRequiredTargetScript,
  normalizeLatinTransliteration,
} from "@/features/cards/create-card-language";

describe("mobile custom card target language", () => {
  it("accepts an optional target language without changing legacy requests", () => {
    expect(createCardRequestSchema.parse({ locale: "en", term: "coffee" }).targetLanguage).toBeUndefined();
    expect(createCardRequestSchema.parse({ locale: "en", term: "ya ne znayu", targetLanguage: "ru" }).targetLanguage).toBe("ru");
  });

  it("instructs the model to normalize Latin transliteration into the requested native script", () => {
    const instructions = buildCreateCardInstructions({ locale: "en", targetLanguage: "ru" });

    expect(instructions).toContain('Set language to exactly "ru"');
    expect(instructions).toContain('"definitions"');
    expect(instructions).toContain("definition for every locale key");
    expect(instructions).toContain('Russian "ya ne znayu" becomes "я не знаю"');
    expect(instructions).toContain('Russian "slu\u015fat", "slushat", and "slushat\'" mean "слушать"');
    expect(instructions).toContain("standard dictionary lemma");
    expect(instructions).toContain('"slu\u015fayu" or "slushayu"');
    expect(buildCreateCardInput({
      locale: "en",
      term: "slu\u015fat",
      targetLanguage: "ru",
      direction: "learning-to-native",
    })).toContain('normalized into a common Latin pronunciation spelling is "slushat"');
    expect(buildCreateCardInput({
      locale: "tr",
      term: "slu\u015fayu",
      targetLanguage: "ru",
      direction: "learning-to-native",
    })).toContain("standard dictionary lemma");
  });

  it("describes both custom-card input directions explicitly", () => {
    const nativeToLearning = buildCreateCardInstructions({
      locale: "tr",
      targetLanguage: "en",
      direction: "native-to-learning",
    });
    const learningToNative = buildCreateCardInstructions({
      locale: "tr",
      targetLanguage: "en",
      direction: "learning-to-native",
    });

    expect(nativeToLearning).toContain("native/UI language tr");
    expect(nativeToLearning).toContain("learning language en");
    expect(learningToNative).toContain("intended to be written in the learning language en");
    expect(learningToNative).toContain("do not treat a Latin transliteration as an English or tr word");
    expect(buildCreateCardInput({
      locale: "tr",
      term: "book",
      targetLanguage: "en",
      direction: "learning-to-native",
    })).toContain("already intended to be in the target learning language");
    expect(buildCreateCardInput({
      locale: "tr",
      term: "arigatou",
      targetLanguage: "ja",
      direction: "learning-to-native",
    })).toContain("standard dictionary lemma only");
  });

  it("requires a target language for the reverse direction", () => {
    expect(createCardRequestSchema.parse({
      locale: "tr",
      term: "kitap",
      targetLanguage: "en",
      direction: "native-to-learning",
    }).direction).toBe("native-to-learning");
    expect(isSupportedCreateCardDirection("learning-to-native", "en")).toBe(true);
    expect(isSupportedCreateCardDirection("learning-to-native")).toBe(false);
  });

  it("rejects model results that do not match a forced target language", () => {
    expect(matchesRequestedTargetLanguage({ language: "ru" }, "ru")).toBe(true);
    expect(matchesRequestedTargetLanguage({ language: "en" }, "ru")).toBe(false);
    expect(matchesRequestedTargetLanguage({ language: "en" })).toBe(true);
  });

  it("requires native script for non-Latin target languages", () => {
    expect(matchesRequestedTargetWritingSystem({ term: "слушать" }, "ru")).toBe(true);
    expect(matchesRequestedTargetWritingSystem({ term: "slushat" }, "ru")).toBe(false);
    expect(matchesRequestedTargetWritingSystem({ term: "listen" }, "en")).toBe(true);
    expect(containsRequiredTargetScript("مرحبا", "ar")).toBe(true);
  });

  it("normalizes common Turkish transliteration variants consistently", () => {
    expect(normalizeLatinTransliteration("slu\u015fat")).toBe("slushat");
    expect(normalizeLatinTransliteration("  YA NE ZNAYU ")).toBe("ya ne znayu");
  });

  it("detects likely surface-form outputs for a lemma correction retry", () => {
    expect(shouldRetryForDictionaryLemma({ term: "hablando", termKind: "fixed_phrase" }, "hablando", "es")).toBe(true);
    expect(shouldRetryForDictionaryLemma({ term: "слушаю", termKind: "word" }, "слушаю", "ru")).toBe(true);
    expect(shouldRetryForDictionaryLemma({ term: "falaro? n,p", termKind: "word" }, "falando", "pt")).toBe(true);
    expect(shouldRetryForDictionaryLemma({ term: "ありがとう", termKind: "fixed_phrase" }, "arigatou", "ja")).toBe(false);
    expect(shouldRetryForDictionaryLemma({ term: "hablar", termKind: "word" }, "hablando", "es")).toBe(false);
  });
});
