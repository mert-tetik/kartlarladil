import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);
const detectedLanguageCodeSchema = z.enum([...LANGUAGE_CODES, "unknown"] as const);

export const askLanguageStateSchema = z.object({
  nativeLanguageCode: detectedLanguageCodeSchema,
  learningLanguageCode: detectedLanguageCodeSchema,
});

export const askChatRequestSchema = z.object({
  locale: localeCodeSchema,
  contextLanguage: languageCodeSchema.optional(),
  languageState: askLanguageStateSchema.optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(900),
      }),
    )
    .min(1)
    .max(20),
});
