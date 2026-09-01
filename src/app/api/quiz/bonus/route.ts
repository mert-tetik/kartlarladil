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

const REQUEST_TIMEOUT_MS = 4_000;
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
    required: ["sentence", "tokens", "sourceCardId"],
    properties: {
      sentence: { type: "string" },
      tokens: { type: "array", minItems: 2, maxItems: 14, items: { type: "string" } },
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

    return Response.json(generated.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
