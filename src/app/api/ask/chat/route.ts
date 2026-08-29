import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { askChatRequestSchema } from "@/features/ask/ask-schema";
import { buildAskInput, buildAskInstructions } from "@/features/ask/ask-prompts";
import { ASK_RESPONSE_FORMAT, parseAskResponse } from "@/features/ask/ask-response";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { assertAndRecordAiUsage } from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 520;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return Response.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({ errorCode: "not_configured" }, { status: 503 });
  }

  const parsed = askChatRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const entitlements = await getUserEntitlements(user.id);
  const aiLimitError = await assertAndRecordAiUsage(user.id, entitlements.effectivePlan, "ask");

  if (aiLimitError) {
    return Response.json({ errorCode: aiLimitError }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;
  const instructions = buildAskInstructions({
    locale: parsed.data.locale,
    previousState: parsed.data.languageState,
    contextLanguage: parsed.data.contextLanguage,
  });
  const input = buildAskInput({
    messages: parsed.data.messages,
  });

  let response: OpenAIResponse;

  try {
    response = await openai.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      store: false,
      text: { format: ASK_RESPONSE_FORMAT, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  const askResponse = parseAskResponse(response.output_text || extractResponseOutputText(response));

  if (!askResponse) {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  return Response.json(askResponse, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
