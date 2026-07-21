import {
  buildCreateCardInput,
  buildCreateCardInstructions,
} from "@/features/cards/create-card-prompts";
import {
  createCardRequestSchema,
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
    expect(instructions).toContain('Russian "ya ne znayu" becomes term "я не знаю"');
    expect(buildCreateCardInput({ locale: "en", term: "ya ne znayu", targetLanguage: "ru" })).toContain("Generate a ru vocabulary card");
  });

  it("rejects model results that do not match a forced target language", () => {
    expect(matchesRequestedTargetLanguage({ language: "ru" }, "ru")).toBe(true);
    expect(matchesRequestedTargetLanguage({ language: "en" }, "ru")).toBe(false);
    expect(matchesRequestedTargetLanguage({ language: "en" })).toBe(true);
  });
});
