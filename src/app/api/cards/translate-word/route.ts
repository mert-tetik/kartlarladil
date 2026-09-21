import OpenAI from "openai";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  buildImageTextWordTranslateInput,
  buildImageTextWordTranslateInstructions,
} from "@/features/cards/image-text-translate-prompts";
import {
  imageTextWordTranslateRequestSchema,
  imageTextWordTranslateResponseSchema,
} from "@/features/cards/image-text-translate-schema";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { assertAndRecordAiUsage } from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORD_TRANSLATE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    translation: { type: "string", minLength: 1, maxLength: 240 },
  },
  required: ["translation"],
} as const;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError("not_configured", 503);
  }

  const parsed = imageTextWordTranslateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (parsed.data.clickedLanguage !== parsed.data.sourceLanguage && parsed.data.clickedLanguage !== parsed.data.locale)) {
    return jsonError("invalid_request", 400);
  }

  try {
    const entitlements = await getUserEntitlements(user.id);
    const aiLimitError = await assertAndRecordAiUsage(user.id, entitlements.effectivePlan, "translate");
    if (aiLimitError) {
      return jsonError(aiLimitError, 429);
    }
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  let response;
  try {
    response = await openai.responses.create({
      model,
      instructions: buildImageTextWordTranslateInstructions(parsed.data),
      input: buildImageTextWordTranslateInput(parsed.data),
      max_output_tokens: 500,
      reasoning: { effort: "low" },
      stream: false,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "image_text_word_translate_response",
          strict: true,
          schema: WORD_TRANSLATE_RESPONSE_JSON_SCHEMA,
        },
        verbosity: "low",
      },
      truncation: "auto",
      safety_identifier: createAiPracticeSafetyIdentifier(user.id),
    });
  } catch {
    return jsonError("upstream_error", 502);
  }

  const rawText = extractResponseOutputText(response) ?? "";
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch {
    return jsonError("upstream_error", 502);
  }

  const validated = imageTextWordTranslateResponseSchema.safeParse(rawJson);
  if (!validated.success) {
    return jsonError("upstream_error", 502);
  }

  return Response.json(validated.data, {
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(errorCode: string, status: number) {
  return Response.json({ errorCode }, { status, headers: { "Cache-Control": "no-store" } });
}
