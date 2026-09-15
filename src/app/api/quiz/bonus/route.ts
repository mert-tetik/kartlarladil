import OpenAI from "openai";
import { z } from "zod";
import {
  generatedCategoryBonusSchema,
  generatedSentenceBonusSchema,
} from "@/features/quiz/bonus-questions";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
} from "@/features/ai-practice/ai-practice-openai";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { isLanguageCode } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 7_500;
const requestSchema = z.object({
  kind: z.enum(["sentence-order", "category-sort"]),
  language: z.string().min(2).max(8),
  cards: z.array(z.object({
    id: z.string().min(1).max(160),
    term: z.string().trim().min(1).max(100),
  })).min(4).max(40),
});

const SENTENCE_FORMAT = {
  type: "json_schema",
  name: "quiz_bonus_sentence",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["sentence", "tokens", "alternativeTokenOrders", "sourceCardId"],
    properties: {
      sentence: { type: "string" },
      tokens: { type: "array", minItems: 2, maxItems: 14, items: { type: "string" } },
      alternativeTokenOrders: {
        type: "array",
        maxItems: 4,
        items: {
          type: "array",
          minItems: 2,
          maxItems: 14,
          items: { type: "string" },
        },
      },
      sourceCardId: { type: "string" },
    },
  },
} as const;

const CATEGORY_FORMAT = {
  type: "json_schema",
  name: "quiz_bonus_categories",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["categories"],
    properties: {
      categories: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "cardIds"],
          properties: {
            name: { type: "string" },
            cardIds: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
          },
        },
      },
    },
  },
} as const;

const ALTERNATIVE_VALIDATION_FORMAT = {
  type: "json_schema",
  name: "quiz_bonus_sentence_alternatives",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["acceptedAlternativeIndexes"],
    properties: {
      acceptedAlternativeIndexes: {
        type: "array",
        maxItems: 4,
        items: { type: "integer", minimum: 0, maximum: 3 },
      },
    },
  },
} as const;

const alternativeValidationSchema = z.object({
  acceptedAlternativeIndexes: z.array(z.number().int().min(0).max(3)).max(4),
});

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return Response.json({ errorCode: "auth_required" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ errorCode: "not_configured" }, { status: 503 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  const language = parsed.data.language;
  if (!isLanguageCode(language)) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const languageName = getLanguageDisplayName(language, "en");
  const cardList = parsed.data.cards.map((card) => `${card.id}: ${card.term}`).join("\n");
  const instructions = parsed.data.kind === "sentence-order"
    ? [
        "Create one short, natural vocabulary-learning example sentence.",
        `Write the sentence in ${languageName}.`,
        "Use exactly one or more of the supplied card terms naturally.",
        "Return tokens in the exact order of the sentence. Each token should be a tappable chunk; keep punctuation attached to the nearest token.",
        "For languages without spaces, split the sentence into useful short chunks.",
        "Also return alternativeTokenOrders: up to 4 alternative grammatically correct orders that use exactly the same token chunks as the primary sentence, each exactly once.",
        "Only include genuinely natural alternatives. Do not invent, remove, duplicate, translate, or modify any token. If no alternative order is natural, return an empty array.",
        "sourceCardId must be one of the supplied IDs.",
        `Cards:\n${cardList}`,
      ].join("\n")
    : [
        "Create three clear semantic categories for a vocabulary sorting bonus question.",
        `Category names must be written in ${languageName}.`,
        "Use exactly three supplied card IDs in each category, never repeat an ID, and use nine different supplied cards in total.",
        "Choose categories that are easy to distinguish for a learner.",
        `Cards:\n${cardList}`,
      ].join("\n");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.responses.create(
      {
        model: process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL,
        instructions,
        input: "Return only the requested JSON object.",
        max_output_tokens: parsed.data.kind === "sentence-order" ? 220 : 260,
        reasoning: { effort: "minimal" },
        store: false,
        text: {
          format: parsed.data.kind === "sentence-order" ? SENTENCE_FORMAT : CATEGORY_FORMAT,
          verbosity: "low",
        },
        safety_identifier: createAiPracticeSafetyIdentifier(user.id),
      },
      { signal: controller.signal },
    );

    const rawText = response.output_text?.trim() ?? "";
    const parsedOutput = JSON.parse(rawText) as unknown;
    const schema = parsed.data.kind === "sentence-order"
      ? generatedSentenceBonusSchema
      : generatedCategoryBonusSchema;
    const generated = schema.safeParse(parsedOutput);

    if (!generated.success) return Response.json({ errorCode: "upstream_error" }, { status: 502 });

    if (parsed.data.kind === "sentence-order") {
      const sentenceGenerated = generatedSentenceBonusSchema.safeParse(generated.data);
      if (!sentenceGenerated.success) return Response.json({ errorCode: "upstream_error" }, { status: 502 });

      const sentenceData = sentenceGenerated.data;
      if (sentenceData.alternativeTokenOrders.length === 0) {
        return Response.json(sentenceData, { headers: { "Cache-Control": "no-store" } });
      }

      const acceptedAlternativeIndexes = await validateSentenceAlternatives({
        openai,
        model: process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL,
        languageName,
        sentence: sentenceData.sentence,
        tokens: sentenceData.tokens,
        alternatives: sentenceData.alternativeTokenOrders,
        signal: controller.signal,
      });

      const acceptedIndexes = new Set(acceptedAlternativeIndexes);
      return Response.json(
        {
          ...sentenceData,
          alternativeTokenOrders: sentenceData.alternativeTokenOrders.filter((_, index) => acceptedIndexes.has(index)),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(generated.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function validateSentenceAlternatives(input: {
  openai: OpenAI;
  model: string;
  languageName: string;
  sentence: string;
  tokens: string[];
  alternatives: string[][];
  signal: AbortSignal;
}) {
  const response = await input.openai.responses.create(
    {
      model: input.model,
      instructions: [
        "Act as a strict grammar reviewer for a vocabulary-learning sentence-order question.",
        `Review the sentence and candidate alternatives in ${input.languageName}.`,
        "Accept an alternative only when it is a genuinely natural, grammatically correct sentence that preserves the primary sentence's meaning.",
        "An accepted alternative must use the exact same token chunks as the primary sentence, each exactly once, and must have a different order.",
        "Reject the primary order repeated as an alternative, awkward or ungrammatical orders, and any alternative that changes, adds, removes, or duplicates a token.",
        "Return only the zero-based indexes of accepted alternatives. If none are valid, return an empty array.",
      ].join("\n"),
      input: JSON.stringify({
        sentence: input.sentence,
        primaryTokens: input.tokens,
        alternatives: input.alternatives,
      }),
      max_output_tokens: 80,
      reasoning: { effort: "minimal" },
      store: false,
      text: { format: ALTERNATIVE_VALIDATION_FORMAT, verbosity: "low" },
    },
    { signal: input.signal },
  );

  const parsed = alternativeValidationSchema.safeParse(
    JSON.parse(response.output_text?.trim() ?? "{}") as unknown,
  );

  return parsed.success ? [...new Set(parsed.data.acceptedAlternativeIndexes)] : [];
}
