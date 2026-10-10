import OpenAI from "openai";
import { z } from "zod";
import { generatedCategoryBonusSchema } from "@/features/quiz/bonus-questions";
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
  kind: z.literal("category-sort"),
  language: z.string().min(2).max(8),
  cards: z.array(z.object({
    id: z.string().min(1).max(160),
    term: z.string().trim().min(1).max(100),
  })).min(4).max(40),
});

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
        minItems: 2,
        maxItems: 2,
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
  if (!parsed.success || !isLanguageCode(parsed.data.language)) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const languageName = getLanguageDisplayName(parsed.data.language, "en");
  const cardList = parsed.data.cards.map((card) => `${card.id}: ${card.term}`).join("\n");
  const instructions = [
    "Create two clear semantic categories for a vocabulary sorting bonus question.",
    `Category names must be written in ${languageName}.`,
    "Use exactly three supplied card IDs in each category, never repeat an ID, and use six different supplied cards in total.",
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
        max_output_tokens: 260,
        reasoning: { effort: "minimal" },
        store: false,
        text: { format: CATEGORY_FORMAT, verbosity: "low" },
        safety_identifier: createAiPracticeSafetyIdentifier(user.id),
      },
      { signal: controller.signal },
    );

    const generated = generatedCategoryBonusSchema.safeParse(
      JSON.parse(response.output_text?.trim() ?? "{}") as unknown,
    );
    if (!generated.success) return Response.json({ errorCode: "upstream_error" }, { status: 502 });

    return Response.json(generated.data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
