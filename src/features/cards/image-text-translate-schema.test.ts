import { describe, expect, it } from "vitest";
import {
  imageTextTranslateRequestSchema,
  imageTextTranslateResponseSchema,
  normalizeImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";

describe("image-text translate schema", () => {
  it("requires the correct input for each mode", () => {
    expect(
      imageTextTranslateRequestSchema.safeParse({
        mode: "image",
        locale: "tr",
        targetLanguage: "en",
        images: [],
      }).success,
    ).toBe(false);

    expect(
      imageTextTranslateRequestSchema.safeParse({
        mode: "text",
        locale: "tr",
        targetLanguage: "en",
        text: "",
      }).success,
    ).toBe(false);

    expect(
      imageTextTranslateRequestSchema.safeParse({
        mode: "text",
        locale: "tr",
        targetLanguage: "en",
        text: "This is a test.",
      }).success,
    ).toBe(true);
  });

  it("deduplicates normalized source words while preserving the response contract", () => {
    const parsed = imageTextTranslateResponseSchema.parse({
      detectedText: "apple apple",
      translatedText: "elma elma",
      questionAnswers: [],
      entries: [
        { id: "entry-1", source: "Apple", translation: "elma", meaning: "Bir meyve" },
        { id: "entry-2", source: "apple", translation: "elma", meaning: "Bir meyve" },
      ],
    });

    expect(normalizeImageTextTranslateResponse(parsed).entries).toHaveLength(1);
    expect(normalizeImageTextTranslateResponse(parsed).translatedText).toBe("elma elma");
  });

  it("adds a model-provided answer when it is missing from either reconstructed text", () => {
    const parsed = imageTextTranslateResponseSchema.parse({
      detectedText: "What time is it?",
      translatedText: "Saat kaç?",
      questionAnswers: [{
        question: "What time is it?",
        answer: "Answer: It is eight o'clock.",
        translatedQuestion: "Saat kaç?",
        translatedAnswer: "Cevap: Saat sekiz.",
      }],
      entries: [],
    });

    const normalized = normalizeImageTextTranslateResponse(parsed);
    expect(normalized.detectedText).toContain("Answer: It is eight o'clock.");
    expect(normalized.translatedText).toContain("Cevap: Saat sekiz.");
  });
});
