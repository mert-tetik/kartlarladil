import OpenAI from "openai";
import {
  AI_PRACTICE_DEFAULT_MODEL,
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  imageTextTranslateRequestSchema,
  imageTextTranslateResponseSchema,
  normalizeImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";
import {
  buildImageTextTranslateImageInput,
  buildImageTextTranslateInstructions,
  buildImageTextTranslateTextInput,
} from "@/features/cards/image-text-translate-prompts";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { assertAndRecordAiUsage } from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import type { ResponseInputContent } from "openai/resources/responses/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 6;
const MAX_IMAGE_DATA_URL_LENGTH = 5_500_000;
const MAX_TOTAL_IMAGE_DATA_URL_LENGTH = 18_000_000;
const MAX_OUTPUT_TOKENS = 3600;

const IMAGE_TEXT_TRANSLATE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    detectedText: { type: "string", maxLength: 8000 },
    translatedText: { type: "string", maxLength: 8000 },
    questionAnswers: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string", minLength: 1, maxLength: 500 },
          answer: { type: "string", minLength: 1, maxLength: 500 },
          translatedQuestion: { type: "string", minLength: 1, maxLength: 500 },
          translatedAnswer: { type: "string", minLength: 1, maxLength: 500 },
        },
        required: ["question", "answer", "translatedQuestion", "translatedAnswer"],
      },
    },
    entries: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          source: { type: "string", minLength: 1, maxLength: 120 },
          translation: { type: "string", minLength: 1, maxLength: 240 },
          meaning: { type: "string", minLength: 1, maxLength: 300 },
        },
        required: ["id", "source", "translation", "meaning"],
      },
    },
  },
  required: ["detectedText", "translatedText", "questionAnswers", "entries"],
} as const;

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonError("not_configured", 503);
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = imageTextTranslateRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return jsonError("invalid_request", 400);
  }

  if (parsed.data.mode === "image") {
    const images = parsed.data.images ?? [];
    if (images.length > MAX_IMAGES || images.some((image) => image.length > MAX_IMAGE_DATA_URL_LENGTH)) {
      return jsonError("invalid_request", 413);
    }

    const totalLength = images.reduce((total, image) => total + image.length, 0);
    if (totalLength > MAX_TOTAL_IMAGE_DATA_URL_LENGTH) {
      return jsonError("invalid_request", 413);
    }
  }

  let entitlements;
  try {
    entitlements = await getUserEntitlements(user.id);
    const aiLimitError = await assertAndRecordAiUsage(user.id, entitlements.effectivePlan, "translate");
    if (aiLimitError) {
      return jsonError(aiLimitError, 429);
    }
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: parsed.data.mode === "image"
        ? buildImageTextTranslateImageInput(parsed.data.targetLanguage)
        : buildImageTextTranslateTextInput(parsed.data.text ?? "", parsed.data.targetLanguage),
    },
  ];

  if (parsed.data.mode === "image") {
    for (const image of parsed.data.images ?? []) {
      content.push({ type: "input_image", image_url: image, detail: "high" });
    }
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_AI_PRACTICE_MODEL?.trim() || AI_PRACTICE_DEFAULT_MODEL;

  let response;
  try {
    response = await openai.responses.create({
      model,
      instructions: buildImageTextTranslateInstructions(parsed.data),
      input: [{ role: "user", content }],
      max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "low" },
      stream: false,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "image_text_translate_response",
          strict: true,
          schema: IMAGE_TEXT_TRANSLATE_RESPONSE_JSON_SCHEMA,
        },
        verbosity: "medium",
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

  const validated = imageTextTranslateResponseSchema.safeParse(rawJson);
  if (!validated.success) {
    return jsonError("upstream_error", 502);
  }

  const normalized = normalizeImageTextTranslateResponse(validated.data);
  if (normalized.entries.length === 0) {
    return jsonError("no_text_detected", 422);
  }

  return Response.json(normalized, {
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(errorCode: string, status: number) {
  return Response.json({ errorCode }, { status, headers: { "Cache-Control": "no-store" } });
}
