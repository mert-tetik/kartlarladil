import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

export const IMAGE_TEXT_MODES = ["image", "text"] as const;
export const imageTextModeSchema = z.enum(IMAGE_TEXT_MODES);
export type ImageTextMode = z.infer<typeof imageTextModeSchema>;

const imageDataUrlSchema = z
  .string()
  .regex(/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Unsupported image data URL");

export const imageTextTranslateRequestSchema = z.object({
  mode: imageTextModeSchema,
  locale: z.enum(LOCALE_CODES),
  targetLanguage: z.enum(LANGUAGE_CODES),
  answerQuestions: z.boolean().default(true),
  text: z.string().trim().max(4000).optional(),
  images: z.array(imageDataUrlSchema).max(6).optional(),
}).superRefine((value, context) => {
  if (value.mode === "image" && (!value.images || value.images.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["images"], message: "At least one image is required" });
  }

  if (value.mode === "text" && !value.text?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "Text is required" });
  }
});

export type ImageTextTranslateRequest = z.infer<typeof imageTextTranslateRequestSchema>;

export const IMAGE_TEXT_SEPARATOR_TYPES = ["text", "paragraph", "question"] as const;
export const imageTextSeparatorSchema = z.enum(IMAGE_TEXT_SEPARATOR_TYPES);
export type ImageTextSeparator = z.infer<typeof imageTextSeparatorSchema>;

const imageTextSentencePairInputSchema = z.object({
  source: z.string().trim().min(1).max(1600),
  translation: z.string().trim().min(1).max(2000),
  separators: z.array(imageTextSeparatorSchema).max(3).optional(),
  // Kept only so translations saved before the three-way separator update can
  // still be opened and normalized.
  paragraphStart: z.boolean().optional(),
});

export const imageTextSentencePairSchema = imageTextSentencePairInputSchema.transform((sentence) => {
  const separators = "separators" in sentence && sentence.separators
    ? Array.from(new Set(sentence.separators))
    : "paragraphStart" in sentence && sentence.paragraphStart
      ? ["paragraph" as const]
      : [];

  return {
    source: sentence.source.trim(),
    translation: sentence.translation.trim(),
    separators: separators as ImageTextSeparator[],
  };
});

export const imageTextTranslateResponseSchema = z.object({
  sentences: z.array(imageTextSentencePairSchema).max(120),
});

export type ImageTextTranslateResponse = z.infer<typeof imageTextTranslateResponseSchema>;
export type ImageTextSentencePair = z.infer<typeof imageTextSentencePairSchema>;

function splitSentenceUnits(value: string, locale?: string): string[] {
  const text = value.trim();
  if (!text) return [];

  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
    const segments = Array.from(segmenter.segment(text), ({ segment }) => segment.trim()).filter(Boolean);
    if (segments.length > 0) return segments;
  } catch {
    // Older runtimes may not expose Intl.Segmenter. The fallback below still
    // handles the common terminal punctuation used by the supported languages.
  }

  return text.split(/(?<=[.!?。！？])\s+(?=\S)/u).map((segment) => segment.trim()).filter(Boolean);
}

function splitSentencePair(
  sentence: ImageTextSentencePair,
  sourceLocale?: string,
  translationLocale?: string,
): ImageTextSentencePair[] {
  const sources = splitSentenceUnits(sentence.source, sourceLocale);
  const translations = splitSentenceUnits(sentence.translation, translationLocale);

  // A source sentence and its translation must stay paired. If a language's
  // sentence segmenter produces different counts, preserve the original pair
  // instead of silently pairing unrelated text.
  if (sources.length <= 1 || sources.length !== translations.length) {
    return [{
      source: sentence.source.trim(),
      translation: sentence.translation.trim(),
      separators: sentence.separators,
    }];
  }

  return sources.map((source, index) => ({
    source,
    translation: translations[index]!,
    separators: index === 0 ? sentence.separators : [],
  }));
}

export function normalizeImageTextTranslateResponse(
  value: ImageTextTranslateResponse,
  options?: { sourceLocale?: string; translationLocale?: string },
): ImageTextTranslateResponse {
  const sentences = value.sentences.flatMap((sentence) =>
    splitSentencePair(sentence, options?.sourceLocale, options?.translationLocale),
  );

  return {
    sentences: sentences.map((sentence, index) => {
      const separators = new Set(sentence.separators);
      if (index === 0) {
        separators.delete("paragraph");
        separators.add("text");
      }
      if (/[?？]/u.test(sentence.source)) separators.add("question");

      return { ...sentence, separators: Array.from(separators) };
    }),
  };
}

export const imageTextWordTranslateRequestSchema = z.object({
  locale: z.enum(LOCALE_CODES),
  sourceLanguage: z.enum(LANGUAGE_CODES),
  clickedLanguage: z.enum(LANGUAGE_CODES),
  word: z.string().trim().min(1).max(160),
  sourceText: z.string().max(12000),
  translatedText: z.string().max(12000),
}).superRefine((value, context) => {
  if (value.clickedLanguage !== value.sourceLanguage && value.clickedLanguage !== value.locale) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["clickedLanguage"],
      message: "The clicked language must be the source or native language",
    });
  }
});

export type ImageTextWordTranslateRequest = z.infer<typeof imageTextWordTranslateRequestSchema>;

export const imageTextWordTranslateResponseSchema = z.object({
  translation: z.string().trim().min(1).max(240),
});

export type ImageTextWordTranslateResponse = z.infer<typeof imageTextWordTranslateResponseSchema>;
