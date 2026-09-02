import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { normalizeGeneratedPronunciation } from "@/features/cards/card-pronunciation";
import type { LanguageCode } from "@/types/domain";

export const createCardRequestSchema = z.object({
  locale: z.enum(LOCALE_CODES),
  term: z.string().min(1).max(120),
  targetLanguage: z.enum(LANGUAGE_CODES).optional(),
});

export type CreateCardRequest = z.infer<typeof createCardRequestSchema>;

export const generatedCardSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  tier: z.enum(TIERS),
  termKind: z.enum(["word", "fixed_phrase"] as const),
  term: z.string().min(1).max(120),
  partOfSpeech: z.string().max(60),
  pronunciation: z
    .string()
    .min(1)
    .max(120)
    .refine((value) => normalizeGeneratedPronunciation(value) !== null, {
      message: "Pronunciation must use Turkish-style simple Latin phonetics",
    })
    .transform((value) => normalizeGeneratedPronunciation(value)!),
  translations: z
    .record(z.string(), z.string().min(1).max(200))
    .refine(
      (record) => LOCALE_CODES.every((code) => record[code]?.trim().length > 0),
      { message: "A translation is required for every supported locale" },
    ),
  example: z.string().min(1).max(300),
  exampleTranslation: z.string().min(1).max(300),
  definitions: z
    .record(z.string(), z.string().min(1).max(240))
    .refine(
      (record) => LOCALE_CODES.every((code) => record[code]?.trim().length > 0),
      { message: "A definition is required for every supported locale" },
    ),
  grammar: z.array(z.string().min(1).max(200)).max(4),
});

export type GeneratedCardResponse = z.infer<typeof generatedCardSchema>;

export function matchesRequestedTargetLanguage(
  card: Pick<GeneratedCardResponse, "language">,
  targetLanguage?: LanguageCode,
) {
  return !targetLanguage || card.language === targetLanguage;
}
