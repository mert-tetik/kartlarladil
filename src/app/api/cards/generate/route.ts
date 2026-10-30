import OpenAI from "openai";
import {
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  createCardRequestSchema,
  generatedCardSchema,
  isSupportedCreateCardDirection,
  matchesRequestedTargetLanguage,
  matchesRequestedTargetWritingSystem,
  normalizeGeneratedCardPayload,
  shouldRetryForDictionaryLemma,
} from "@/features/cards/create-card-schema";
import { buildCreateCardInput, buildCreateCardInstructions } from "@/features/cards/create-card-prompts";
import { CUSTOM_CARD_RESPONSE_FORMAT } from "@/features/cards/create-card-openai-format";
import { CUSTOM_CARD_REASONING_EFFORT, getCustomCardModel } from "@/features/cards/custom-card-ai";
import { getCurrentAuthUser } from "@/features/auth/auth-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 2200;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  const parsed = createCardRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  if (!isSupportedCreateCardDirection(parsed.data.direction, parsed.data.targetLanguage)) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });
  const instructions = buildCreateCardInstructions({
    locale: parsed.data.locale,
    targetLanguage: parsed.data.targetLanguage,
    direction: parsed.data.direction,
  });

  try {
    const response = await openai.responses.create({
      model: getCustomCardModel(),
      instructions,
      input: buildCreateCardInput(parsed.data),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: CUSTOM_CARD_REASONING_EFFORT },
      stream: false,
      store: false,
      text: { format: CUSTOM_CARD_RESPONSE_FORMAT, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });

    const rawText = extractResponseOutputText(response) ?? "";
    const generated = parseGeneratedCard(rawText);

    if (
      !generated ||
      !matchesRequestedTargetLanguage(generated, parsed.data.targetLanguage) ||
      !matchesRequestedTargetWritingSystem(generated, parsed.data.targetLanguage) ||
      shouldRetryForDictionaryLemma(generated, parsed.data.term, parsed.data.targetLanguage)
    ) {
      return Response.json({ errorCode: "upstream_error" }, { status: 502 });
    }

    return Response.json(generated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }
}

function parseGeneratedCard(rawText: string) {
  try {
    const parsedJson = normalizeGeneratedCardPayload(JSON.parse(rawText));
    const generated = generatedCardSchema.safeParse(parsedJson);
    return generated.success ? generated.data : null;
  } catch {
    return null;
  }
}
