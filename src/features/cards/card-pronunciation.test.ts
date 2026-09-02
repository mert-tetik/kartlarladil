import { cardPronunciationRequestSchema, normalizeGeneratedPronunciation } from "@/features/cards/card-pronunciation";
import { generatedCardSchema } from "@/features/cards/create-card-schema";
import { LOCALE_CODES } from "@/data/languages";

describe("card pronunciation helpers", () => {
  it("accepts a simple Turkish-style Latin sound guide instead of IPA", () => {
    expect(normalizeGeneratedPronunciation("Ekshılly")).toBe("ekshılly");
    expect(normalizeGeneratedPronunciation("buon-corno")).toBe("buon-corno");
    expect(normalizeGeneratedPronunciation("w\u00e7\u015f")).toBe("vchsh");
    expect(normalizeGeneratedPronunciation("/həˈloʊ/")).toBeNull();
    expect(normalizeGeneratedPronunciation("[hello]")).toBeNull();
    expect(normalizeGeneratedPronunciation("bonjür")).toBeNull();
    expect(normalizeGeneratedPronunciation("")).toBeNull();
  });

  it("accepts only a bounded source key request", () => {
    expect(cardPronunciationRequestSchema.safeParse({ sourceKey: "en:A1:word:hello:noun" }).success).toBe(true);
    expect(cardPronunciationRequestSchema.safeParse({ sourceKey: "" }).success).toBe(false);
    expect(cardPronunciationRequestSchema.safeParse({ sourceKey: "card", unexpected: true }).success).toBe(false);
  });

  it("normalizes custom-card pronunciations and rejects IPA", () => {
    const baseCard = {
      language: "en" as const,
      tier: "A1" as const,
      termKind: "word" as const,
      term: "actually",
      partOfSpeech: "adverb",
      translations: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "actually"])),
      example: "Actually, I agree.",
      exampleTranslation: "Aslında, katılıyorum.",
      definitions: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, "A test definition."])),
      grammar: ["An adverb."],
    };

    expect(generatedCardSchema.parse({ ...baseCard, pronunciation: "Ekshılly" }).pronunciation).toBe("ekshılly");
    expect(generatedCardSchema.safeParse({ ...baseCard, pronunciation: "/æk.tʃu.ə.li/" }).success).toBe(false);
  });
});
