import "server-only";

import OpenAI from "openai";

const POYO_RESPONSES_BASE_URL = "https://api.poyo.ai/v1";

export const SOCIAL_CONTENT_TEXT_MODEL = "gpt-5-6-luna";
export const SOCIAL_CONTENT_CREATIVE_MODEL = "gpt-5-6-terra";
const POYO_PRIMARY_RESPONSE_TIMEOUT_MS = 60_000;
const OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS = 150_000;

const OPENAI_MODEL_BY_POYO_MODEL: Record<string, string> = {
  [SOCIAL_CONTENT_TEXT_MODEL]: "gpt-5.6-luna",
  [SOCIAL_CONTENT_CREATIVE_MODEL]: "gpt-5.6-terra",
};

type SocialStudioResponsesProvider = "poyo" | "openai";

export class PoyoResponsesError extends Error {
  constructor(public readonly code: "poyo_not_configured") {
    super(code);
  }
}

export class OpenAIResponsesError extends Error {
  constructor(public readonly code: "openai_not_configured") {
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

export class OpenAIResponsesProviderError extends Error {
  constructor(
    public readonly providerStatus: number,
    public readonly model: string,
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

function getErrorStatus(error: unknown) {
  return error && typeof error === "object" && "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : undefined;
}

function isRetryablePoyoResponsesFailure(error: unknown) {
  const status = error instanceof PoyoResponsesProviderError ? error.providerStatus : getErrorStatus(error);
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  return /^(?:APIConnectionError|APIConnectionTimeoutError|AbortError|TimeoutError|FetchError)$/u.test(name)
    || error instanceof TypeError && /(?:fetch|network|socket|connect)/iu.test(message);
}

function providerError(
  provider: SocialStudioResponsesProvider,
  providerStatus: number,
  model: string,
  message: string,
) {
  return provider === "poyo"
    ? new PoyoResponsesProviderError(providerStatus, message)
    : new OpenAIResponsesProviderError(providerStatus, model, message);
}

async function withResponseTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  provider: SocialStudioResponsesProvider,
  model: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(providerError(provider, 504, model, `${model} did not respond within ${Math.ceil(timeoutMs / 1_000)} seconds.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function normalizeProviderFailure(
  provider: SocialStudioResponsesProvider,
  model: string,
  error: unknown,
) {
  if (
    error instanceof PoyoResponsesError
    || error instanceof OpenAIResponsesError
    || error instanceof PoyoResponsesProviderError
    || error instanceof OpenAIResponsesProviderError
  ) {
    return error;
  }

  const providerStatus = getErrorStatus(error) ?? 502;
  const message = error instanceof Error && error.message !== "Error"
    ? error.message
    : provider === "poyo"
      ? "PoYo Responses returned an unspecified provider error."
      : "OpenAI Responses returned an unspecified provider error.";
  return providerError(provider, providerStatus, model, message);
}

function resolveOpenAIModel(poyoModel: string) {
  const model = OPENAI_MODEL_BY_POYO_MODEL[poyoModel];
  if (!model) throw new Error(`No direct OpenAI model mapping exists for ${poyoModel}.`);
  return model;
}

/** Runs a PoYo Responses request first. Temporary PoYo failures make one
 * independent direct OpenAI Responses attempt on the matching Luna or Terra
 * model; malformed model output never switches providers. */
export async function generateSocialStudioTextWithFallback<T>(
  primaryModel: string,
  generate: (client: OpenAI, model: string) => Promise<T>,
  extractOutput: (response: T) => string,
) {
  const run = async (
    provider: SocialStudioResponsesProvider,
    client: OpenAI,
    model: string,
  ) => {
    try {
      const response = await generate(client, model);
      if (provider === "poyo") assertPoyoResponsesOutput(response);
      const output = extractOutput(response);
      if (provider === "poyo") assertPoyoResponsesOutput(output);
      return { output, model, provider };
    } catch (error) {
      throw normalizeProviderFailure(provider, model, error);
    }
  };

  try {
    const poyo = createSocialStudioPoyoClient();
    return await withResponseTimeout(run("poyo", poyo, primaryModel), POYO_PRIMARY_RESPONSE_TIMEOUT_MS, "poyo", primaryModel);
  } catch (error) {
    if (!isRetryablePoyoResponsesFailure(error)) throw error;
    const openai = createSocialStudioOpenAIClient();
    const openaiModel = resolveOpenAIModel(primaryModel);
    return await withResponseTimeout(
      run("openai", openai, openaiModel),
      OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS,
      "openai",
      openaiModel,
    );
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

/** Direct OpenAI fallback client. Its default base URL intentionally remains
 * untouched so it never routes back through PoYo. */
export function createSocialStudioOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAIResponsesError("openai_not_configured");

  return new OpenAI({
    apiKey,
    maxRetries: 0,
  });
}

export function getSocialStudioResponsesErrorCode(error: unknown) {
  if (error instanceof PoyoResponsesError) return error.code;
  if (error instanceof OpenAIResponsesError) return error.code;
  if (error instanceof PoyoResponsesProviderError) return "poyo_responses_provider_error";
  if (error instanceof OpenAIResponsesProviderError) return "openai_responses_provider_error";
  return null;
}

export function getSocialStudioResponsesProviderLabel(error: unknown, poyoFallback: string) {
  if (error instanceof OpenAIResponsesError) return "OpenAI Responses";
  if (error instanceof OpenAIResponsesProviderError) {
    return error.model.endsWith("-luna") ? "OpenAI Responses / Luna" : "OpenAI Responses / Terra";
  }
  return poyoFallback;
}
