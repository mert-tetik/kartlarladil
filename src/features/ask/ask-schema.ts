import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);

export const askChatRequestSchema = z.object({
  language: languageCodeSchema,
  locale: localeCodeSchema,
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
