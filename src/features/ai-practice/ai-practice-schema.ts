import { z } from "zod";
import { LANGUAGE_CODES, LOCALE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);
const localeCodeSchema = z.enum(LOCALE_CODES);
const tierSchema = z.enum(["A1", "A2", "B1", "B2", "C1"]);
const practiceModeSchema = z.enum(["character", "scenario"]);

export const aiPracticeChatRequestSchema = z
  .object({
    language: languageCodeSchema,
    characterId: z.string().min(1).max(80),
    mode: practiceModeSchema.optional().default("character"),
    scenarioId: z.string().min(1).max(80).optional(),
    requestType: z.enum(["message", "help"]).optional().default("message"),
    uiLocale: localeCodeSchema.optional().default("en"),
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
  })
  .refine((value) => value.mode === "character" || Boolean(value.scenarioId), {
    message: "A scenario is required for situation role-play.",
    path: ["scenarioId"],
  })
  .refine((value) => value.requestType !== "help" || value.mode === "scenario", {
    message: "Help suggestions are only available for situation role-play.",
    path: ["requestType"],
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
