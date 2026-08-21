export type ConfusedWordsPhasePlan = {
  firstTerm: string;
  secondTerm: string;
  firstMeaningTail: string;
  secondMeaningTail: string;
  connector: string;
  question: string;
};

export type ConfusedWordsPlan = {
  phases: ConfusedWordsPhasePlan[];
};

const PHASE_COUNT = 3;

/**
 * The plan is intentionally limited to values the renderer actually consumes.
 * Captions are created deterministically by the app after the video succeeds.
 */
export const CONFUSED_WORDS_PLAN_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "confused_words_video_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["phases"],
    properties: {
      phases: {
        type: "array",
        minItems: PHASE_COUNT,
        maxItems: PHASE_COUNT,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["firstTerm", "secondTerm", "connector", "question", "firstMeaningTail", "secondMeaningTail"],
          properties: {
            firstTerm: { type: "string" },
            secondTerm: { type: "string" },
            connector: { type: "string" },
            question: { type: "string" },
            firstMeaningTail: { type: "string" },
            secondMeaningTail: { type: "string" },
          },
        },
      },
    },
  },
} as const;

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

export function normalizeConfusedWordsTerm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("en").trim();
}

function parsePhase(value: unknown): ConfusedWordsPhasePlan | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const field = (name: keyof ConfusedWordsPhasePlan) => typeof record[name] === "string" ? record[name].trim() : "";
  const firstTerm = field("firstTerm");
  const secondTerm = field("secondTerm");
  const connector = field("connector");
  const question = field("question");
  const firstMeaningTail = field("firstMeaningTail");
  const secondMeaningTail = field("secondMeaningTail");

  // Single-character CJK words and concise native-language explanations are
  // valid. The former character-count floor rejected otherwise healthy plans.
  if (
    !firstTerm || !secondTerm || /\s/u.test(firstTerm) || /\s/u.test(secondTerm) || normalizeConfusedWordsTerm(firstTerm) === normalizeConfusedWordsTerm(secondTerm)
    || !connector || !question || !firstMeaningTail || !secondMeaningTail
  ) return null;

  return {
    firstTerm: firstTerm.slice(0, 80),
    secondTerm: secondTerm.slice(0, 80),
    connector: connector.slice(0, 40),
    question: question.slice(0, 120),
    firstMeaningTail: firstMeaningTail.slice(0, 180),
    secondMeaningTail: secondMeaningTail.slice(0, 180),
  };
}

export function parseConfusedWordsVideoPlan(value: string): ConfusedWordsPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { phases?: unknown };
    const phases = Array.isArray(parsed.phases) ? parsed.phases.map(parsePhase) : [];
    if (phases.length !== PHASE_COUNT || phases.some((phase) => !phase)) return null;
    const resolvedPhases = phases as ConfusedWordsPhasePlan[];
    const terms = resolvedPhases.flatMap((phase) => [normalizeConfusedWordsTerm(phase.firstTerm), normalizeConfusedWordsTerm(phase.secondTerm)]);
    if (new Set(terms).size !== terms.length) return null;
    return { phases: resolvedPhases };
  } catch {
    return null;
  }
}
