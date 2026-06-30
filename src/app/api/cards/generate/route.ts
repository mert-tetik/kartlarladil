import OpenAI from "openai";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import { createCardRequestSchema, generatedCardSchema } from "@/features/cards/create-card-schema";
import { buildCreateCardInput, buildCreateCardInstructions } from "@/features/cards/create-card-prompts";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import {
  assertCanUseAi,
  recordAiUsageEvent,
} from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 600;

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

  const entitlements = await getUserEntitlements(user.id);
  const aiLimitError = await assertCanUseAi(user.id, entitlements.effectivePlan);

  if (aiLimitError) {
    return Response.json({ errorCode: aiLimitError }, { status: 429 });
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;
  const instructions = buildCreateCardInstructions({ locale: parsed.data.locale });
  const input = buildCreateCardInput(parsed.data);

  let response;

  try {
    response = await openai.responses.create({
      model,
      instructions,
      input,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { effort: "minimal" },
      stream: false,
      store: false,
      text: { format: { type: "json_object" }, verbosity: "low" },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  const rawText = extractResponseOutputText(response) ?? "";

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return Response.json({ errorCode: "upstream_error" }, { status: 502 });
  }

  const generated = generatedCardSchema.safeParse(parsedJson);

  if (!generated.success) {
    return Response.json({ errorCode: "invalid_request" }, { status: 502 });
  }

  await recordAiUsageEvent(user.id, entitlements.effectivePlan, "create_card").catch(() => {
    // Ignore usage recording failures so the user still receives the response.
  });

  return Response.json(generated.data, {
    headers: { "Cache-Control": "no-store" },
  });
}
