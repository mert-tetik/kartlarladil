import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";
import { TIERS } from "@/data/tiers";

export const createCardRequestSchema = z.object({
  locale: z.enum(LOCALE_CODES),
  term: z.string().min(1).max(120),
});

export type CreateCardRequest = z.infer<typeof createCardRequestSchema>;

export const generatedCardSchema = z.object({
  language: z.enum(LANGUAGE_CODES),
  tier: z.enum(TIERS),
  termKind: z.enum(["word", "fixed_phrase"] as const),
  term: z.string().min(1).max(120),
  partOfSpeech: z.string().max(60),
  pronunciation: z.string().max(120),
  translations: z
    .record(z.string(), z.string().min(1).max(200))
    .refine(
      (record) => LOCALE_CODES.every((code) => record[code]?.trim().length > 0),
      { message: "A translation is required for every supported locale" },
    ),
  example: z.string().min(1).max(300),
  exampleTranslation: z.string().min(1).max(300),
  grammar: z.array(z.string().min(1).max(200)).max(4),
});

export type GeneratedCardResponse = z.infer<typeof generatedCardSchema>;
