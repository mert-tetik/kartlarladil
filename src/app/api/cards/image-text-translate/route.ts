import OpenAI from "openai";
import {
  createAiPracticeSafetyIdentifier,
  extractResponseOutputText,
} from "@/features/ai-practice/ai-practice-openai";
import {
  imageTextTranslateRequestSchema,
  imageTextTranslateResponseSchema,
  imageTextExtractResponseSchema,
  normalizeImageTextTranslateResponse,
} from "@/features/cards/image-text-translate-schema";
import {
  buildImageTextExtractImageInput,
  buildImageTextExtractInstructions,
  buildImageTextTranslateInstructions,
  buildImageTextTranslateTextInput,
} from "@/features/cards/image-text-translate-prompts";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import {
  completeImageTextTranslation,
  getImageTextTranslationUsage,
  releaseImageTextTranslation,
  reserveImageTextTranslation,
} from "@/features/subscriptions/ai-usage-service";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
  ResponseInputContent,
} from "openai/resources/responses/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_IMAGES = 6;
// Keep the JSON request comfortably below serverless request-body limits. The
// client produces bounded JPEG data URLs, but these checks remain authoritative
// for direct callers and malformed/oversized requests.
const MAX_IMAGE_DATA_URL_LENGTH = 750_000;
const MAX_TOTAL_IMAGE_DATA_URL_LENGTH = 4_000_000;
const MAX_OUTPUT_TOKENS = 6000;
const OPENAI_REQUEST_TIMEOUT_MS = 45_000;
const OCR_MAX_OUTPUT_TOKENS = 5000;
const IMAGE_TEXT_TRANSLATE_DEFAULT_MODEL = "gpt-4.1-mini";

const IMAGE_TEXT_EXTRACT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string", maxLength: 4000 },
  },
  required: ["text"],
} as const;

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
    if (
      images.length > MAX_IMAGES ||
      images.some((image) => image.length > MAX_IMAGE_DATA_URL_LENGTH)
    ) {
      return jsonError("invalid_request", 413);
    }

    const totalLength = images.reduce(
      (total, image) => total + image.length,
      0,
    );
    if (totalLength > MAX_TOTAL_IMAGE_DATA_URL_LENGTH) {
      return jsonError("invalid_request", 413);
    }
  }

  // This is an inexpensive fail-fast check. The reservation below is the
  // authoritative atomic guard against concurrent requests.
  try {
    const entitlements = await getUserEntitlements(user.id);
    const usage = await getImageTextTranslationUsage(
      user.id,
      entitlements.effectivePlan,
    );
    if (!usage.canUse) {
      return jsonError("image_text_translate_limit", 429);
    }
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  let reservationId: string;
  try {
    const reservation = await reserveImageTextTranslation(user.id);
    if (reservation.status === "limit") {
      return jsonError("image_text_translate_limit", 429);
    }
    reservationId = reservation.reservationId;
  } catch {
    return jsonError("usage_unavailable", 503);
  }

  let usageCompleted = false;
  let preserveReservationForRecovery = false;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model =
      process.env.OPENAI_IMAGE_TEXT_TRANSLATE_MODEL?.trim() ||
      IMAGE_TEXT_TRANSLATE_DEFAULT_MODEL;

    let sourceText = parsed.data.text ?? "";

    if (parsed.data.mode === "image") {
      const extractionContent: ResponseInputContent[] = [
        {
          type: "input_text",
          text: buildImageTextExtractImageInput(parsed.data.targetLanguage),
        },
        ...(parsed.data.images ?? []).map((image) => ({
          type: "input_image" as const,
          image_url: image,
          detail: "high" as const,
        })),
      ];

      let extractionResponse;
      try {
        extractionResponse = await createOpenAiResponse(
          openai,
          {
            model,
            instructions: buildImageTextExtractInstructions(parsed.data),
            input: [{ role: "user", content: extractionContent }],
            max_output_tokens: OCR_MAX_OUTPUT_TOKENS,
            ...getReasoningOptions(model),
            stream: false,
            store: false,
            text: {
              format: {
                type: "json_schema",
                name: "image_text_extract_response",
                strict: true,
                schema: IMAGE_TEXT_EXTRACT_RESPONSE_JSON_SCHEMA,
              },
              verbosity: "medium",
            },
            truncation: "auto",
            safety_identifier: createAiPracticeSafetyIdentifier(user.id),
          },
          request.signal,
        );
      } catch (error) {
        logOpenAiFailure(model, "image-extraction", error);
        return jsonError("upstream_error", 502);
      }

      const extractedRawText =
        extractResponseOutputText(extractionResponse) ?? "";
      let extractedJson: unknown;
      try {
        extractedJson = JSON.parse(extractedRawText);
      } catch {
        return jsonError("upstream_error", 502);
      }

      const extracted = imageTextExtractResponseSchema.safeParse(extractedJson);
      if (!extracted.success || !extracted.data.text.trim()) {
        return jsonError("no_text_detected", 422);
      }

      sourceText = extracted.data.text;
    }

    const translationContent: ResponseInputContent[] = [
      {
        type: "input_text",
        text: buildImageTextTranslateTextInput(
          sourceText,
          parsed.data.targetLanguage,
          parsed.data.answerQuestions,
        ),
      },
    ];

    let translationResponse;
    try {
      translationResponse = await createOpenAiResponse(
        openai,
        {
          model,
          instructions: buildImageTextTranslateInstructions(parsed.data),
          input: [{ role: "user", content: translationContent }],
          max_output_tokens: MAX_OUTPUT_TOKENS,
          ...getReasoningOptions(model),
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
        },
        request.signal,
      );
    } catch (error) {
      logOpenAiFailure(model, "translation", error);
      return jsonError("upstream_error", 502);
    }

    const rawText = extractResponseOutputText(translationResponse) ?? "";
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

    // Turn the reservation into a usage event only after a valid result exists.
    try {
      await completeImageTextTranslation(user.id, reservationId);
    } catch {
      // Completion may have committed even if its response was lost. Keep the
      // idempotent reservation until TTL cleanup rather than reopening a quota
      // slot and allowing an immediate retry to generate unmetered output.
      preserveReservationForRecovery = true;
      return jsonError("usage_unavailable", 503);
    }

    usageCompleted = true;
    return Response.json(normalized, {
      headers: { "Cache-Control": "no-store" },
    });
  } finally {
    if (!usageCompleted && !preserveReservationForRecovery) {
      try {
        await releaseImageTextTranslation(user.id, reservationId);
      } catch (error) {
        // A TTL cleanup in the reservation RPC frees abandoned slots if a
        // request is terminated before this cleanup can reach Supabase.
        console.error(
          "[image-text-translate] Could not release quota reservation",
          error,
        );
      }
    }
  }
}

async function createOpenAiResponse(
  openai: OpenAI,
  params: ResponseCreateParamsNonStreaming,
  requestSignal: AbortSignal,
): Promise<OpenAIResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    OPENAI_REQUEST_TIMEOUT_MS,
  );
  const abortFromRequest = () => controller.abort();
  requestSignal.addEventListener("abort", abortFromRequest, { once: true });

  try {
    return await openai.responses.create(params, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortFromRequest);
  }
}

function getReasoningOptions(
  model: string,
): Pick<ResponseCreateParamsNonStreaming, "reasoning"> | Record<never, never> {
  if (!/^(?:gpt-5(?:[.-]|$)|o[134](?:[.-]|$))/iu.test(model)) {
    return {};
  }

  return { reasoning: { effort: "low" } };
}

function logOpenAiFailure(
  model: string,
  stage: "image-extraction" | "translation",
  error: unknown,
) {
  console.error("[image-text-translate] OpenAI request failed", {
    model,
    stage,
    error: error instanceof Error ? error.message : String(error),
  });
}

function jsonError(errorCode: string, status: number) {
  return Response.json(
    { errorCode },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
