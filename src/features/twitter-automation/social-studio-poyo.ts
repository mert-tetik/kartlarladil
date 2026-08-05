import "server-only";

import OpenAI from "openai";

const POYO_RESPONSES_BASE_URL = "https://api.poyo.ai/v1";

export const SOCIAL_CONTENT_TEXT_MODEL = "gpt-5-6-luna";
export const SOCIAL_CONTENT_CREATIVE_MODEL = "gpt-5-6-terra";
export const SOCIAL_CONTENT_FALLBACK_MODEL = "gpt-5.5";

export class PoyoResponsesError extends Error {
  constructor(public readonly code: "poyo_not_configured") {
    super(code);
  }
}

/** A PoYo Responses request can return HTTP 200 with an error object in its
 * generated text payload. Surface that provider failure instead of treating it
 * as malformed model output. */
export class PoyoResponsesProviderError extends Error {
  constructor(
    public readonly providerStatus: number,
    message: string,
  ) {
    super(message);
  }
}

export function assertPoyoResponsesOutput(source: string | unknown) {
  try {
    const payload = (typeof source === "string" ? JSON.parse(source) : source) as { code?: unknown; msg?: unknown; error?: { message?: unknown } };
    if (typeof payload.code === "number" && payload.code >= 400) {
      const message = typeof payload.error?.message === "string"
        ? payload.error.message
        : typeof payload.msg === "string"
          ? payload.msg
          : "PoYo Responses returned an unspecified provider error.";
      throw new PoyoResponsesProviderError(payload.code, message);
    }
  } catch (error) {
    if (error instanceof PoyoResponsesProviderError) throw error;
    // Normal model output is often JSON too. A parsing failure simply means it
    // is regular text and should be handled by each route's plan parser.
  }
}

function isRetryablePoyoResponsesFailure(error: unknown) {
  if (error instanceof PoyoResponsesProviderError) return error.providerStatus >= 500;
  const status = error && typeof error === "object" && "status" in error ? (error as { status?: unknown }).status : undefined;
  return typeof status === "number" && status >= 500;
}

/** Runs a PoYo Responses request on its intended model. Only a provider-side
 * 5xx failure is retried once on GPT-5.5; model-output validation failures do
 * not silently change models. */
export async function generateSocialStudioTextWithFallback<T>(
  primaryModel: string,
  generate: (model: string) => Promise<T>,
  extractOutput: (response: T) => string,
) {
  const run = async (model: string) => {
    const response = await generate(model);
    assertPoyoResponsesOutput(response);
    const output = extractOutput(response);
    assertPoyoResponsesOutput(output);
    return { output, model };
  };

  try {
    return await run(primaryModel);
  } catch (error) {
    if (!isRetryablePoyoResponsesFailure(error) || primaryModel === SOCIAL_CONTENT_FALLBACK_MODEL) throw error;
    return await run(SOCIAL_CONTENT_FALLBACK_MODEL);
  }
}

/** OpenAI-compatible client for Content Automation text and creative plans. */
export function createSocialStudioPoyoClient() {
  const apiKey = process.env.POYO_API_KEY?.trim();
  if (!apiKey) throw new PoyoResponsesError("poyo_not_configured");

  return new OpenAI({
    apiKey,
    baseURL: POYO_RESPONSES_BASE_URL,
    maxRetries: 0,
  });
}
