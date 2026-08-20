import "server-only";

import OpenAI from "openai";
import {
  isSocialStudioPoyoCircuitOpen,
  recordSocialStudioPoyoRetryableFailure,
  recordSocialStudioPoyoSuccess,
} from "@/features/twitter-automation/social-studio-provider-health";

const POYO_RESPONSES_BASE_URL = "https://api.poyo.ai/v1";

export const SOCIAL_CONTENT_TEXT_MODEL = "gpt-5-6-luna";
export const SOCIAL_CONTENT_CREATIVE_MODEL = "gpt-5-6-terra";
const POYO_PRIMARY_RESPONSE_TIMEOUT_MS = 45_000;
const OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS = 150_000;
const OPENAI_FALLBACK_ATTEMPT_TIMEOUT_MS = 45_000;
const OPENAI_FALLBACK_MAX_ATTEMPTS = 3;
const OPENAI_FALLBACK_RETRY_DELAYS_MS = [750, 2_000] as const;

const OPENAI_MODEL_BY_POYO_MODEL: Record<string, string> = {
  [SOCIAL_CONTENT_TEXT_MODEL]: "gpt-5.6-luna",
  [SOCIAL_CONTENT_CREATIVE_MODEL]: "gpt-5.6-terra",
};

type SocialStudioResponsesProvider = "poyo" | "openai";

type SocialStudioGeneration<T> = (
  client: OpenAI,
  model: string,
  signal: AbortSignal,
) => Promise<T>;

type SocialStudioFallbackOptions = {
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  providerHealth?: SocialStudioProviderHealth;
};

export type SocialStudioProviderHealth = {
  isPoyoCircuitOpen: () => Promise<boolean>;
  recordPoyoRetryableFailure: () => Promise<void>;
  recordPoyoSuccess: () => Promise<void>;
};

const defaultProviderHealth: SocialStudioProviderHealth = {
  isPoyoCircuitOpen: isSocialStudioPoyoCircuitOpen,
  recordPoyoRetryableFailure: recordSocialStudioPoyoRetryableFailure,
  recordPoyoSuccess: recordSocialStudioPoyoSuccess,
};

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
    public readonly attemptCount = 1,
    public readonly requestId?: string,
    public readonly retryAfterMs?: number,
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

function isRetryableNetworkFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;

  return /^(?:APIConnectionError|APIConnectionTimeoutError|AbortError|TimeoutError|FetchError)$/u.test(name)
    || typeof code === "string" && /^(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET)$/u.test(code)
    || error instanceof TypeError && /(?:fetch|network|socket|connect|timed?\s*out)/iu.test(message);
}

function isRetryablePoyoResponsesFailure(error: unknown) {
  const status = error instanceof PoyoResponsesProviderError ? error.providerStatus : getErrorStatus(error);
  if (typeof status === "number") return status === 408 || status === 429 || status >= 500;

  return isRetryableNetworkFailure(error);
}

function isRetryableOpenAIResponsesFailure(error: unknown) {
  const status = error instanceof OpenAIResponsesProviderError ? error.providerStatus : getErrorStatus(error);
  if (typeof status === "number") return status === 408 || status === 409 || status === 429 || status >= 500;

  return isRetryableNetworkFailure(error);
}

function providerError(
  provider: SocialStudioResponsesProvider,
  providerStatus: number,
  model: string,
  message: string,
  attemptCount = 1,
  requestId?: string,
  retryAfterMs?: number,
) {
  return provider === "poyo"
    ? new PoyoResponsesProviderError(providerStatus, message)
    : new OpenAIResponsesProviderError(providerStatus, model, message, attemptCount, requestId, retryAfterMs);
}

async function withResponseTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  provider: SocialStudioResponsesProvider,
  model: string,
  attemptCount = 1,
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
          () => {
            controller.abort();
            reject(providerError(provider, 504, model, `${model} did not respond within ${Math.ceil(timeoutMs / 1_000)} seconds.`, attemptCount));
          },
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
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
  return providerError(
    provider,
    providerStatus,
    model,
    message,
    1,
    getErrorRequestId(error),
    getRetryAfterMs(error),
  );
}

function getErrorRequestId(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { request_id?: unknown; _request_id?: unknown; requestId?: unknown };
  const requestId = candidate.request_id ?? candidate._request_id ?? candidate.requestId;
  return typeof requestId === "string" && requestId.length > 0 && requestId.length <= 200 ? requestId : undefined;
}

function withOpenAIAttempt(error: unknown, attemptCount: number) {
  if (!(error instanceof OpenAIResponsesProviderError)) return error;
  return new OpenAIResponsesProviderError(
    error.providerStatus,
    error.model,
    error.message,
    attemptCount,
    error.requestId,
    error.retryAfterMs,
  );
}

function getRetryAfterMs(error: unknown) {
  if (!error || typeof error !== "object") return 0;
  const headers = (error as { headers?: unknown }).headers;
  const value = headers && typeof headers === "object" && "get" in headers && typeof (headers as { get?: unknown }).get === "function"
    ? (headers as { get: (name: string) => string | null }).get("retry-after")
    : null;
  const seconds = value === null ? Number.NaN : Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.round(seconds * 1_000), 5_000) : 0;
}

function retryAfterMs(error: unknown) {
  return error instanceof OpenAIResponsesProviderError
    ? error.retryAfterMs ?? 0
    : getRetryAfterMs(error);
}

function openAIRetryDelayMs(error: unknown, retryIndex: number, random: () => number) {
  const baseDelay = OPENAI_FALLBACK_RETRY_DELAYS_MS[retryIndex] ?? 0;
  const jitter = 0.75 + Math.max(0, Math.min(1, random())) * 0.5;
  return Math.max(Math.round(baseDelay * jitter), retryAfterMs(error));
}

async function runOpenAIFallbackWithRetry<T>(
  model: string,
  run: (signal: AbortSignal) => Promise<T>,
  wait: (delayMs: number) => Promise<void>,
  random: () => number,
) {
  const deadline = Date.now() + OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS;

  for (let attempt = 1; attempt <= OPENAI_FALLBACK_MAX_ATTEMPTS; attempt += 1) {
    const remainingMs = Math.min(OPENAI_FALLBACK_ATTEMPT_TIMEOUT_MS, deadline - Date.now());
    if (remainingMs <= 0) {
      throw providerError("openai", 504, model, `${model} did not respond within ${Math.ceil(OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS / 1_000)} seconds.`);
    }

    try {
      return await withResponseTimeout(run, remainingMs, "openai", model, attempt);
    } catch (caught) {
      const error = withOpenAIAttempt(caught, attempt);
      const retryDelayMs = openAIRetryDelayMs(error, attempt - 1, random);
      if (!isRetryableOpenAIResponsesFailure(error) || attempt === OPENAI_FALLBACK_MAX_ATTEMPTS) throw error;

      // Keep every direct OpenAI retry within the existing 150-second budget.
      if (Date.now() + retryDelayMs >= deadline) throw error;
      await wait(retryDelayMs);
    }
  }

  throw providerError("openai", 502, model, "OpenAI Responses exhausted its retry attempts.");
}

async function safelyReadPoyoCircuit(providerHealth: SocialStudioProviderHealth) {
  try {
    return await providerHealth.isPoyoCircuitOpen();
  } catch {
    // Provider-health persistence must never prevent a healthy provider call.
    return false;
  }
}

async function safelyRecordProviderHealth(task: () => Promise<void>) {
  try {
    await task();
  } catch {
    // Fail open when Supabase is unavailable; the request still has a provider
    // path and its actual outcome must remain authoritative.
  }
}

function resolveOpenAIModel(poyoModel: string) {
  const model = OPENAI_MODEL_BY_POYO_MODEL[poyoModel];
  if (!model) throw new Error(`No direct OpenAI model mapping exists for ${poyoModel}.`);
  return model;
}

/** Runs a PoYo Responses request first. Temporary PoYo failures make a
 * bounded direct OpenAI retry sequence on the matching Luna or Terra model;
 * malformed model output never switches providers. */
export async function generateSocialStudioTextWithFallback<T>(
  primaryModel: string,
  generate: SocialStudioGeneration<T>,
  extractOutput: (response: T) => string,
  { sleep: wait = sleep, random = Math.random, providerHealth = defaultProviderHealth }: SocialStudioFallbackOptions = {},
) {
  const run = async (
    provider: SocialStudioResponsesProvider,
    client: OpenAI,
    model: string,
    signal: AbortSignal,
  ) => {
    try {
      const response = await generate(client, model, signal);
      if (provider === "poyo") assertPoyoResponsesOutput(response);
      const output = extractOutput(response);
      if (provider === "poyo") assertPoyoResponsesOutput(output);
      return { output, model, provider };
    } catch (error) {
      throw normalizeProviderFailure(provider, model, error);
    }
  };

  const runOpenAIFallback = async () => {
    const openai = createSocialStudioOpenAIClient();
    const openaiModel = resolveOpenAIModel(primaryModel);
    return await runOpenAIFallbackWithRetry(
      openaiModel,
      (signal) => run("openai", openai, openaiModel, signal),
      wait,
      random,
    );
  };

  if (await safelyReadPoyoCircuit(providerHealth)) return await runOpenAIFallback();

  try {
    const poyo = createSocialStudioPoyoClient();
    const result = await withResponseTimeout(
      (signal) => run("poyo", poyo, primaryModel, signal),
      POYO_PRIMARY_RESPONSE_TIMEOUT_MS,
      "poyo",
      primaryModel,
    );
    await safelyRecordProviderHealth(providerHealth.recordPoyoSuccess);
    return result;
  } catch (error) {
    if (!isRetryablePoyoResponsesFailure(error)) throw error;
    await safelyRecordProviderHealth(providerHealth.recordPoyoRetryableFailure);
    return await runOpenAIFallback();
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
