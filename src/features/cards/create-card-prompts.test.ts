import {
  buildCreateCardInput,
  buildCreateCardInstructions,
} from "@/features/cards/create-card-prompts";
import {
  createCardRequestSchema,
  isSupportedCreateCardDirection,
  matchesRequestedTargetLanguage,
} from "@/features/cards/create-card-schema";

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
    expect(instructions).toContain('Russian "ya ne znayu" becomes term "я не знаю"');
    expect(buildCreateCardInput({ locale: "en", term: "ya ne znayu", targetLanguage: "ru" })).toContain("Generate a ru vocabulary card");
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
    expect(learningToNative).toContain("already written in the learning language en");
    expect(learningToNative).toContain("Do not treat the input as a tr word");
    expect(buildCreateCardInput({
      locale: "tr",
      term: "book",
      targetLanguage: "en",
      direction: "learning-to-native",
    })).toContain("already in the target learning language");
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
});
