import { z } from "zod";

const scenarioEvaluationTierSchema = z.enum(["green", "yellow", "red"]);

export const scenarioEvaluationSchema = z.object({
  tier: scenarioEvaluationTierSchema,
  explanation: z.string().trim().min(1).max(1_200),
  suggestedReply: z.string().trim().min(1).max(900),
});

export const aiPracticeScenarioResponseSchema = z.object({
  reply: z.string().trim().min(1).max(900),
  evaluation: scenarioEvaluationSchema,
});

export const aiPracticeScenarioHelpResponseSchema = z.object({
  suggestions: z.array(z.string().trim().min(1).max(900)).max(3),
});

export type ScenarioEvaluationTier = z.infer<typeof scenarioEvaluationTierSchema>;
export type ScenarioEvaluation = z.infer<typeof scenarioEvaluationSchema>;
export type AiPracticeScenarioResponse = z.infer<typeof aiPracticeScenarioResponseSchema>;
export type AiPracticeScenarioHelpResponse = z.infer<typeof aiPracticeScenarioHelpResponseSchema>;

export const AI_PRACTICE_SCENARIO_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "ai_practice_scenario_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "evaluation"],
    properties: {
      reply: { type: "string" },
      evaluation: {
        type: "object",
        additionalProperties: false,
        required: ["tier", "explanation", "suggestedReply"],
        properties: {
          tier: { type: "string", enum: ["green", "yellow", "red"] },
          explanation: { type: "string" },
          suggestedReply: { type: "string" },
        },
      },
    },
  },
} as const;

export const AI_PRACTICE_SCENARIO_HELP_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "ai_practice_scenario_help",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        maxItems: 3,
        items: { type: "string" },
      },
    },
  },
} as const;

function normalizeJsonText(raw: string) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

export function parseAiPracticeScenarioResponse(raw: string) {
  const normalized = normalizeJsonText(raw);

  if (!normalized) return null;

  try {
    const parsed = aiPracticeScenarioResponseSchema.safeParse(JSON.parse(normalized));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseAiPracticeScenarioHelpResponse(raw: string) {
  const normalized = normalizeJsonText(raw);

  if (!normalized) return null;

  try {
    const parsed = aiPracticeScenarioHelpResponseSchema.safeParse(JSON.parse(normalized));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
