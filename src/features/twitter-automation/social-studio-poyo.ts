import "server-only";

import OpenAI from "openai";
import {
  acquireSocialStudioOpenAILease,
  isSocialStudioOpenAICircuitOpen,
  isSocialStudioPoyoCircuitOpen,
  recordSocialStudioOpenAIRetryableFailure,
  recordSocialStudioOpenAISuccess,
  recordSocialStudioPoyoRetryableFailure,
  recordSocialStudioPoyoSuccess,
  type SocialStudioProviderLease,
} from "@/features/twitter-automation/social-studio-provider-health";

const POYO_RESPONSES_BASE_URL = "https://api.poyo.ai/v1";

export const SOCIAL_CONTENT_TEXT_MODEL = "gpt-5-6-luna";
export const SOCIAL_CONTENT_CREATIVE_MODEL = "gpt-5-6-terra";
const POYO_PRIMARY_RESPONSE_TIMEOUT_MS = 45_000;
const OPENAI_FALLBACK_RESPONSE_TIMEOUT_MS = 150_000;
const OPENAI_FALLBACK_ATTEMPT_TIMEOUT_MS = 45_000;
const OPENAI_FALLBACK_MAX_ATTEMPTS = 3;
const OPENAI_FALLBACK_RETRY_DELAYS_MS = [750, 2_000] as const;
const OPENAI_LEASE_WAIT_TIMEOUT_MS = 90_000;
const OPENAI_LEASE_RETRY_DELAY_MS = 1_250;
const LOCAL_POYO_FAILURE_WINDOW_MS = 2 * 60_000;
const LOCAL_POYO_CIRCUIT_MS = 5 * 60_000;
const LOCAL_OPENAI_FAILURE_WINDOW_MS = 90_000;
const LOCAL_OPENAI_CIRCUIT_MS = 90_000;
const LOCAL_OPENAI_MAX_CONCURRENCY = 2;

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
  isOpenAICircuitOpen?: () => Promise<boolean>;
  recordOpenAIRetryableFailure?: () => Promise<void>;
  recordOpenAISuccess?: () => Promise<void>;
  acquireOpenAILease?: () => Promise<SocialStudioProviderLease | null>;
};

const defaultProviderHealth: SocialStudioProviderHealth = {
  isPoyoCircuitOpen: isSocialStudioPoyoCircuitOpen,
  recordPoyoRetryableFailure: recordSocialStudioPoyoRetryableFailure,
  recordPoyoSuccess: recordSocialStudioPoyoSuccess,
  isOpenAICircuitOpen: isSocialStudioOpenAICircuitOpen,
  recordOpenAIRetryableFailure: recordSocialStudioOpenAIRetryableFailure,
  recordOpenAISuccess: recordSocialStudioOpenAISuccess,
  acquireOpenAILease: acquireSocialStudioOpenAILease,
};

type LocalProviderCircuit = {
  consecutiveFailures: number;
  lastFailureAt: number | null;
  openUntil: number | null;
};

const localProviderCircuits: Record<SocialStudioResponsesProvider, LocalProviderCircuit> = {
  poyo: { consecutiveFailures: 0, lastFailureAt: null, openUntil: null },
  openai: { consecutiveFailures: 0, lastFailureAt: null, openUntil: null },
};
let localOpenAIActiveLeases = 0;

function isLocalProviderCircuitOpen(provider: SocialStudioResponsesProvider, now = Date.now()) {
  return (localProviderCircuits[provider].openUntil ?? 0) > now;
}

function recordLocalProviderFailure(provider: SocialStudioResponsesProvider, failureWindowMs: number, circuitMs: number) {
  const circuit = localProviderCircuits[provider];
  const now = Date.now();
  circuit.consecutiveFailures = circuit.lastFailureAt !== null && now - circuit.lastFailureAt <= failureWindowMs
    ? circuit.consecutiveFailures + 1
    : 1;
  circuit.lastFailureAt = now;
  if (circuit.consecutiveFailures >= 2) circuit.openUntil = now + circuitMs;
}

function recordLocalProviderSuccess(provider: SocialStudioResponsesProvider) {
  localProviderCircuits[provider] = { consecutiveFailures: 0, lastFailureAt: null, openUntil: null };
}

function acquireLocalOpenAILease(): SocialStudioProviderLease | null {
  if (localOpenAIActiveLeases >= LOCAL_OPENAI_MAX_CONCURRENCY) return null;
  localOpenAIActiveLeases += 1;
  let released = false;
  return {
    id: `local-openai-${crypto.randomUUID()}`,
    release: async () => {
      if (released) return;
      released = true;
      localOpenAIActiveLeases = Math.max(0, localOpenAIActiveLeases - 1);
    },
  };
}

/** Test-only reset for the process-local fallback guards. Production state is
 * intentionally retained for the lifetime of the server process. */
export function resetSocialStudioProviderFallbackGuardsForTests() {
  localProviderCircuits.poyo = { consecutiveFailures: 0, lastFailureAt: null, openUntil: null };
  localProviderCircuits.openai = { consecutiveFailures: 0, lastFailureAt: null, openUntil: null };
  localOpenAIActiveLeases = 0;
}

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

export class OpenAIResponsesCircuitOpenError extends Error {
  constructor() {
    super("OpenAI Responses fallback is temporarily paused after repeated transient failures.");
  }
}

export class OpenAIResponsesQueueTimeoutError extends Error {
  constructor() {
    super("OpenAI Responses fallback is busy. The generation will retry from its saved checkpoint.");
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
  if (error instanceof OpenAIResponsesCircuitOpenError || error instanceof OpenAIResponsesQueueTimeoutError) return true;
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
    // Durable health is preferred; a process-local breaker still prevents an
    // error storm while a migration or Supabase is temporarily unavailable.
    return isLocalProviderCircuitOpen("poyo");
  }
}

async function safelyReadOpenAICircuit(providerHealth: SocialStudioProviderHealth) {
  if (!providerHealth.isOpenAICircuitOpen) return false;
  try {
    return await providerHealth.isOpenAICircuitOpen();
  } catch {
    return isLocalProviderCircuitOpen("openai");
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

async function recordPoyoFailure(providerHealth: SocialStudioProviderHealth) {
  try {
    await providerHealth.recordPoyoRetryableFailure();
  } catch {
    recordLocalProviderFailure("poyo", LOCAL_POYO_FAILURE_WINDOW_MS, LOCAL_POYO_CIRCUIT_MS);
  }
}

async function recordPoyoSuccess(providerHealth: SocialStudioProviderHealth) {
  try {
    await providerHealth.recordPoyoSuccess();
  } catch {
    recordLocalProviderSuccess("poyo");
  }
}

async function recordOpenAIFailure(providerHealth: SocialStudioProviderHealth) {
  if (!providerHealth.recordOpenAIRetryableFailure) return;
  try {
    await providerHealth.recordOpenAIRetryableFailure();
  } catch {
    recordLocalProviderFailure("openai", LOCAL_OPENAI_FAILURE_WINDOW_MS, LOCAL_OPENAI_CIRCUIT_MS);
  }
}

async function recordOpenAISuccess(providerHealth: SocialStudioProviderHealth) {
  if (!providerHealth.recordOpenAISuccess) return;
  try {
    await providerHealth.recordOpenAISuccess();
  } catch {
    recordLocalProviderSuccess("openai");
  }
}

async function acquireOpenAILease(
  providerHealth: SocialStudioProviderHealth,
  wait: (delayMs: number) => Promise<void>,
  random: () => number,
) {
  if (!providerHealth.acquireOpenAILease) return undefined;

  const deadline = Date.now() + OPENAI_LEASE_WAIT_TIMEOUT_MS;
  try {
    while (Date.now() < deadline) {
      const lease = await providerHealth.acquireOpenAILease();
      if (lease) return lease;
      const jitter = 0.8 + Math.max(0, Math.min(1, random())) * 0.4;
      await wait(Math.round(OPENAI_LEASE_RETRY_DELAY_MS * jitter));
    }
  } catch {
    // The database lease is global. When it is temporarily unavailable, keep
    // a per-process semaphore as a safety net rather than unleashing an
    // unbounded fallback burst.
    return acquireLocalOpenAILease();
  }

  throw new OpenAIResponsesQueueTimeoutError();
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
    if (await safelyReadOpenAICircuit(providerHealth)) throw new OpenAIResponsesCircuitOpenError();
    const openai = createSocialStudioOpenAIClient();
    const openaiModel = resolveOpenAIModel(primaryModel);
    const lease = await acquireOpenAILease(providerHealth, wait, random);
    try {
      const result = await runOpenAIFallbackWithRetry(
        openaiModel,
        (signal) => run("openai", openai, openaiModel, signal),
        wait,
        random,
      );
      await recordOpenAISuccess(providerHealth);
      return result;
    } catch (error) {
      if (isRetryableOpenAIResponsesFailure(error)) await recordOpenAIFailure(providerHealth);
      throw error;
    } finally {
      if (lease) await safelyRecordProviderHealth(lease.release);
    }
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
    await recordPoyoSuccess(providerHealth);
    return result;
  } catch (error) {
    if (!isRetryablePoyoResponsesFailure(error)) throw error;
    await recordPoyoFailure(providerHealth);
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
  if (error instanceof OpenAIResponsesCircuitOpenError) return "openai_responses_circuit_open";
  if (error instanceof OpenAIResponsesQueueTimeoutError) return "openai_responses_queue_timeout";
  return null;
}

export function getSocialStudioResponsesProviderLabel(error: unknown, poyoFallback: string) {
  if (error instanceof OpenAIResponsesError || error instanceof OpenAIResponsesCircuitOpenError || error instanceof OpenAIResponsesQueueTimeoutError) return "OpenAI Responses";
  if (error instanceof OpenAIResponsesProviderError) {
    return error.model.endsWith("-luna") ? "OpenAI Responses / Luna" : "OpenAI Responses / Terra";
  }
  return poyoFallback;
}

function safeProviderFailureDetail(message: string) {
  return message
    .replace(/(?:bearer|api[_ -]?key|token)\s+[^\s,;]+/giu, "[credential redacted]")
    .replace(/https?:\/\/[^\s,;]+/giu, "[url omitted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 320);
}

/** A deliberately small, redacted diagnostic payload persisted by automation
 * recovery. It never contains prompts, request bodies, URLs, or API keys. */
export function getSocialStudioProviderFailureDetails(error: unknown) {
  if (error instanceof PoyoResponsesProviderError) {
    return { provider: "poyo" as const, status: error.providerStatus, detail: safeProviderFailureDetail(error.message) };
  }
  if (error instanceof OpenAIResponsesProviderError) {
    return {
      provider: "openai" as const,
      status: error.providerStatus,
      attemptCount: error.attemptCount,
      requestId: error.requestId,
      detail: safeProviderFailureDetail(error.message),
    };
  }
  if (error instanceof OpenAIResponsesCircuitOpenError || error instanceof OpenAIResponsesQueueTimeoutError) {
    return { provider: "openai" as const, detail: error.message };
  }
  return null;
}
