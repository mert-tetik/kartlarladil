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
import {
  consumeImageTextTranslation,
  getImageTextTranslationUsage,
} from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import type { ResponseInputContent } from "openai/resources/responses/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGES = 6;
// Keep the JSON request comfortably below serverless request-body limits. The
// client produces bounded JPEG data URLs, but these checks remain authoritative
// for direct callers and malformed/oversized requests.
const MAX_IMAGE_DATA_URL_LENGTH = 750_000;
const MAX_TOTAL_IMAGE_DATA_URL_LENGTH = 4_000_000;
const MAX_OUTPUT_TOKENS = 6000;
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;

const IMAGE_TEXT_TRANSLATE_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sentences: {
      type: "array",
      maxItems: 120,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          source: { type: "string", minLength: 1, maxLength: 1600 },
          translation: { type: "string", minLength: 1, maxLength: 2000 },
          separators: {
            type: "array",
            maxItems: 3,
            items: { type: "string", enum: ["text", "paragraph", "question"] },
          },
        },
        required: ["source", "translation", "separators"],
      },
    },
  },
  required: ["sentences"],
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

  // This is an inexpensive fail-fast check. The post-response atomic RPC
  // below remains authoritative because another request may win the quota
  // race while OpenAI is processing this request.
  try {
    const entitlements = await getUserEntitlements(user.id);
    const usage = await getImageTextTranslationUsage(user.id, entitlements.effectivePlan);
    if (!usage.canUse) {
      return jsonError("image_text_translate_limit", 429);
    }
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: parsed.data.mode === "image"
        ? buildImageTextTranslateImageInput(parsed.data.targetLanguage, parsed.data.answerQuestions)
        : buildImageTextTranslateTextInput(parsed.data.text ?? "", parsed.data.targetLanguage, parsed.data.answerQuestions),
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);
  const abortFromRequest = () => controller.abort();
  request.signal.addEventListener("abort", abortFromRequest, { once: true });

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
    }, { signal: controller.signal });
  } catch {
    return jsonError("upstream_error", 502);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromRequest);
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

  const normalized = normalizeImageTextTranslateResponse(validated.data, {
    sourceLocale: parsed.data.targetLanguage,
    translationLocale: parsed.data.locale,
  });
  if (normalized.sentences.length === 0) {
    return jsonError("no_text_detected", 422);
  }

  if (normalized.sentences.length > 120) {
    return jsonError("upstream_error", 502);
  }

  // The two Free/Basic uses are consumed only after a complete, validated
  // translation exists. The RPC serializes concurrent requests so a client
  // cannot receive a third successful result by racing two requests.
  try {
    const usageError = await consumeImageTextTranslation(user.id);
    if (usageError) {
      return jsonError(usageError, 429);
    }
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  return Response.json(normalized, {
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(errorCode: string, status: number) {
  return Response.json({ errorCode }, { status, headers: { "Cache-Control": "no-store" } });
}
