import { describe, expect, it } from "vitest";
import {
  imageTextTranslateRequestSchema,
  imageTextTranslateResponseSchema,
  imageTextWordTranslateRequestSchema,
  imageTextWordTranslateResponseSchema,
  normalizeImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";

describe("image-text translate schema", () => {
  it("requires the correct input for each mode", () => {
    expect(imageTextTranslateRequestSchema.safeParse({ mode: "image", locale: "tr", targetLanguage: "en", images: [] }).success).toBe(false);
    expect(imageTextTranslateRequestSchema.safeParse({ mode: "text", locale: "tr", targetLanguage: "en", text: "" }).success).toBe(false);
    expect(imageTextTranslateRequestSchema.safeParse({ mode: "text", locale: "tr", targetLanguage: "en", text: "This is a test." }).success).toBe(true);
  });

  it("defaults to answering questions and accepts disabling that behavior", () => {
    const defaultRequest = imageTextTranslateRequestSchema.parse({
      mode: "text",
      locale: "tr",
      targetLanguage: "en",
      text: "What is this?",
    });
    const disabledRequest = imageTextTranslateRequestSchema.parse({
      mode: "text",
      locale: "tr",
      targetLanguage: "en",
      answerQuestions: false,
      text: "What is this?",
    });

    expect(defaultRequest.answerQuestions).toBe(true);
    expect(disabledRequest.answerQuestions).toBe(false);
  });

  it("normalizes source and translation sentence pairs", () => {
    const parsed = imageTextTranslateResponseSchema.parse({
      sentences: [
        { source: "\nFirst sentence.\n", translation: "\nFirst translated sentence.\n" },
        { source: "Second sentence.", translation: "Second translated sentence.", separators: ["paragraph"] },
      ],
    });

    expect(normalizeImageTextTranslateResponse(parsed)).toEqual({
      sentences: [
        { source: "First sentence.", translation: "First translated sentence.", separators: ["text"] },
        { source: "Second sentence.", translation: "Second translated sentence.", separators: ["paragraph"] },
      ],
    });
  });

  it("splits multiple completed sentences returned in one pair", () => {
    const parsed = imageTextTranslateResponseSchema.parse({
      sentences: [{
        source: "Однажды утром Алексей опаздывал в университет. Он быстро оделся, выпил чай и выбежал из дома.",
        translation: "Bir sabah Aleksey üniversiteye geç kaldı. Hızla giyindi, çayını içti ve evden çıktı.",
        separators: ["paragraph"],
      }],
    });

    expect(normalizeImageTextTranslateResponse(parsed, {
      sourceLocale: "ru",
      translationLocale: "tr",
    })).toEqual({
      sentences: [
        {
          source: "Однажды утром Алексей опаздывал в университет.",
          translation: "Bir sabah Aleksey üniversiteye geç kaldı.",
          separators: ["text"],
        },
        {
          source: "Он быстро оделся, выпил чай и выбежал из дома.",
          translation: "Hızla giyindi, çayını içti ve evden çıktı.",
          separators: [],
        },
      ],
    });
  });

  it("ignores legacy per-word fields in saved records", () => {
    const parsed = imageTextTranslateResponseSchema.parse({
      sentences: [{
        source: "Old sentence.",
        translation: "Eski cumle.",
        wordTranslations: { source: [], translation: [] },
      }],
    });

    expect(parsed.sentences[0]).toEqual({ source: "Old sentence.", translation: "Eski cumle.", separators: [] });
  });

  it("accepts a word translation request from either document language", () => {
    expect(imageTextWordTranslateRequestSchema.safeParse({
      locale: "tr",
      sourceLanguage: "en",
      clickedLanguage: "en",
      word: "chronological",
      sourceText: "The events are chronological.",
      translatedText: "Olaylar kronolojiktir.",
    }).success).toBe(true);

    expect(imageTextWordTranslateRequestSchema.safeParse({
      locale: "tr",
      sourceLanguage: "en",
      clickedLanguage: "de",
      word: "falsch",
      sourceText: "The answer is false.",
      translatedText: "Cevap yanlistir.",
    }).success).toBe(false);
  });

  it("validates the translation-only word response", () => {
    expect(imageTextWordTranslateResponseSchema.parse({ translation: "kronolojik" })).toEqual({
      translation: "kronolojik",
    });
    expect(imageTextWordTranslateResponseSchema.safeParse({
      translation: "kronolojik",
      meaning: "A sequence that follows time order.",
    }).data).toEqual({ translation: "kronolojik" });
  });
});
