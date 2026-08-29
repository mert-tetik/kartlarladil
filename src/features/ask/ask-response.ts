import { z } from "zod";
import { LANGUAGE_CODES } from "@/data/languages";
import type { LanguageCode } from "@/types/domain";

export type AskDetectedLanguageCode = LanguageCode | "unknown";

const INFERRED_LANGUAGE_CODES = [...LANGUAGE_CODES, "unknown"] as const;

export interface AskLanguageState {
  nativeLanguageCode: AskDetectedLanguageCode;
  learningLanguageCode: AskDetectedLanguageCode;
}

export const ASK_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "ask_language_learning_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "nativeLanguageCode", "learningLanguageCode", "isLearningRequest"],
    properties: {
      reply: { type: "string" },
      nativeLanguageCode: { type: "string", enum: INFERRED_LANGUAGE_CODES },
      learningLanguageCode: { type: "string", enum: INFERRED_LANGUAGE_CODES },
      isLearningRequest: { type: "boolean" },
    },
  },
} as const;

const askResponseSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  nativeLanguageCode: z.enum(INFERRED_LANGUAGE_CODES),
  learningLanguageCode: z.enum(INFERRED_LANGUAGE_CODES),
  isLearningRequest: z.boolean(),
});

export type AskResponse = z.infer<typeof askResponseSchema>;

export function parseAskResponse(raw: string): AskResponse | null {
  const normalized = raw
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();

  if (!normalized) return null;

  try {
    const parsed = askResponseSchema.safeParse(JSON.parse(normalized));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
