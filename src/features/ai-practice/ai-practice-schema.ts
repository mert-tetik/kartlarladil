import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);
const tierSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);

export const aiPracticeChatRequestSchema = z
  .object({
    language: languageCodeSchema,
    characterId: z.string().min(1).max(80),
    tier: tierSchema.optional().default("A1"),
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(900),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((value) => value.messages.at(-1)?.role === "user", {
    message: "The latest message must be from the user.",
    path: ["messages"],
  });

export const aiPracticeTranslateRequestSchema = z.object({
  language: languageCodeSchema,
  targetLocale: localeCodeSchema,
  text: z.string().trim().min(1).max(2_000),
});

export const aiPracticeScoreRequestSchema = z.object({
  language: languageCodeSchema,
  characterId: z.string().min(1).max(80),
  userMessage: z.string().trim().min(1).max(900),
  assistantMessage: z.string().trim().min(1).max(900),
});
