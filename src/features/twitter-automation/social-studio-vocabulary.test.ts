import { isTurkishAsciiPronunciation, normalizeSocialStudioVocabularyTerm } from "@/features/twitter-automation/social-studio-vocabulary";

describe("social studio vocabulary", () => {
  it("normalizes a term before it is compared", () => {
    expect(normalizeSocialStudioVocabularyTerm("  Café   NOIR ")).toBe("café noir");
  });

  it("accepts Turkish-reader ASCII pronunciations only", () => {
    expect(isTurkishAsciiPronunciation("vanderlast")).toBe(true);
    expect(isTurkishAsciiPronunciation("/wandərlust/")).toBe(false);
    expect(isTurkishAsciiPronunciation("vanderlüst")).toBe(false);
  });
});
