import { z } from "zod";
import { LANGUAGE_CODES } from "@/data/languages";

const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const aiValidateAnswerRequestSchema = z.object({
  userAnswer: z.string().trim().min(1).max(200),
  correctAnswers: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  targetLanguage: languageCodeSchema,
  sourceLanguage: languageCodeSchema,
  promptContext: z.string().trim().min(1).max(1_000),
});

export const aiValidateAnswerResponseSchema = z.object({
  accepted: z.boolean(),
});

export type AiValidateAnswerRequest = z.infer<typeof aiValidateAnswerRequestSchema>;
export type AiValidateAnswerResponse = z.infer<typeof aiValidateAnswerResponseSchema>;
