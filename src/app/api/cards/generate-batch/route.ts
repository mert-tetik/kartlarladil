import OpenAI from "openai";
import {
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { parseGeneratedCardBatch } from "@/features/cards/create-card-batch";
import { createCustomCardBatchResponseFormat } from "@/features/cards/create-card-openai-format";
import {
  createCardBatchRequestSchema,
  isSupportedCreateCardDirection,
  MAX_CUSTOM_CARD_BATCH_SIZE,
} from "@/features/cards/create-card-schema";
import {
  buildCreateCardsBatchInput,
  buildCreateCardsBatchInstructions,
} from "@/features/cards/create-card-prompts";
import { CUSTOM_CARD_REASONING_EFFORT, getCustomCardModel } from "@/features/cards/custom-card-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS_PER_CARD = 2_200;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();
  if (!user) return Response.json({ errorCode: "auth_required" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ errorCode: "not_configured" }, { status: 503 });

  const parsed = createCardBatchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.cards.length > MAX_CUSTOM_CARD_BATCH_SIZE) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (parsed.data.cards.some((card) => !isSupportedCreateCardDirection(card.direction, card.targetLanguage))) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { cards } = parsed.data;
  const openai = new OpenAI({ apiKey });
  const model = getCustomCardModel();

  try {
    const response = await openai.responses.create({
      model,
      instructions: buildCreateCardsBatchInstructions(cards),
      input: buildCreateCardsBatchInput(cards),
      max_output_tokens: MAX_OUTPUT_TOKENS_PER_CARD * cards.length,
      reasoning: { effort: CUSTOM_CARD_REASONING_EFFORT },
      stream: false,
      store: false,
      text: { format: createCustomCardBatchResponseFormat(cards.length), verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });

    const rawText = extractResponseOutputText(response) ?? "";
    const generatedCards = parseGeneratedCardBatch(rawText, cards);
    if (!generatedCards) return Response.json({ errorCode: "upstream_error" }, { status: 502 });

    return Response.json({ cards: generatedCards }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }
}
