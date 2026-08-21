import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAiConstructor = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({ default: openAiConstructor }));

import {
  createSocialStudioOpenAIClient,
  createSocialStudioPoyoClient,
  generateSocialStudioTextWithFallback,
  getSocialStudioResponsesErrorCode,
  getSocialStudioResponsesProviderLabel,
  OpenAIResponsesError,
  OpenAIResponsesProviderError,
  PoyoResponsesError,
  resetSocialStudioProviderFallbackGuardsForTests,
  SOCIAL_CONTENT_CREATIVE_MODEL,
  SOCIAL_CONTENT_TEXT_MODEL,
} from "@/features/twitter-automation/social-studio-poyo";

describe("Content Automation Responses fallback", () => {
  beforeEach(() => {
    vi.stubEnv("POYO_API_KEY", "test-poyo-key");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAiConstructor.mockImplementation(function (options: { baseURL?: string }) {
      return { provider: options.baseURL ? "poyo" : "openai" };
    });
    openAiConstructor.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    resetSocialStudioProviderFallbackGuardsForTests();
  });

  it("uses Luna only for short social text and Terra for creative plans", () => {
    expect(SOCIAL_CONTENT_TEXT_MODEL).toBe("gpt-5-6-luna");
    expect(SOCIAL_CONTENT_CREATIVE_MODEL).toBe("gpt-5-6-terra");
  });

  it("keeps a healthy PoYo response on PoYo and never creates an OpenAI fallback client", async () => {
    const calls: Array<{ provider: string; model: string }> = [];

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client, model) => {
        calls.push({ provider: (client as unknown as { provider: string }).provider, model });
        return { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      () => "healthy",
    );

    expect(calls).toEqual([{ provider: "poyo", model: "gpt-5-6-luna" }]);
    expect(result).toMatchObject({ provider: "poyo", model: "gpt-5-6-luna", output: "healthy" });
    expect(openAiConstructor).toHaveBeenCalledTimes(1);
  });

  it("retries a transient PoYo failure once through direct OpenAI with the matching Terra model", async () => {
    const calls: Array<{ provider: string; model: string }> = [];

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      async (client, model) => {
        const provider = (client as unknown as { provider: string }).provider;
        calls.push({ provider, model });
        return provider === "poyo"
          ? { code: 500, msg: "Server exception" }
          : { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      (response) => Array.isArray((response as { output?: unknown }).output) ? "healthy" : "",
    );

    expect(calls).toEqual([
      { provider: "poyo", model: "gpt-5-6-terra" },
      { provider: "openai", model: "gpt-5.6-terra" },
    ]);
    expect(result).toMatchObject({ provider: "openai", model: "gpt-5.6-terra", output: "healthy" });
  });

  it("retries transient direct OpenAI failures inside the same fallback window", async () => {
    const calls: Array<{ provider: string; model: string }> = [];
    const delays: number[] = [];

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client, model) => {
        const provider = (client as unknown as { provider: string }).provider;
        calls.push({ provider, model });
        if (provider === "poyo") return { code: 503, msg: "PoYo unavailable" };
        if (calls.filter((call) => call.provider === "openai").length < 3) {
          throw Object.assign(new Error("OpenAI service unavailable"), { status: 503 });
        }
        return { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      () => "healthy",
      {
        sleep: async (delayMs) => { delays.push(delayMs); },
        random: () => 0.5,
      },
    );

    expect(calls).toEqual([
      { provider: "poyo", model: "gpt-5-6-luna" },
      { provider: "openai", model: "gpt-5.6-luna" },
      { provider: "openai", model: "gpt-5.6-luna" },
      { provider: "openai", model: "gpt-5.6-luna" },
    ]);
    expect(delays).toEqual([750, 2_000]);
    expect(result).toMatchObject({ provider: "openai", model: "gpt-5.6-luna", output: "healthy" });
  });

  it("uses a bounded Retry-After backoff for direct OpenAI rate limits", async () => {
    const delays: number[] = [];
    let openAIAttempts = 0;

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        const provider = (client as unknown as { provider: string }).provider;
        if (provider === "poyo") return { code: 503, msg: "PoYo unavailable" };
        openAIAttempts += 1;
        if (openAIAttempts === 1) {
          throw Object.assign(new Error("Rate limited"), {
            status: 429,
            headers: { get: (name: string) => name === "retry-after" ? "3" : null },
          });
        }
        return { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      () => "healthy",
      {
        sleep: async (delayMs) => { delays.push(delayMs); },
        random: () => 0.5,
      },
    );

    expect(delays).toEqual([3_000]);
    expect(result).toMatchObject({ provider: "openai", output: "healthy" });
  });

  it("opens the PoYo circuit after two transient failures and bypasses PoYo for the next request", async () => {
    let poyoFailureCount = 0;
    let circuitOpen = false;
    const providerHealth = {
      isPoyoCircuitOpen: vi.fn(async () => circuitOpen),
      recordPoyoRetryableFailure: vi.fn(async () => {
        poyoFailureCount += 1;
        if (poyoFailureCount >= 2) circuitOpen = true;
      }),
      recordPoyoSuccess: vi.fn(async () => undefined),
    };
    const providers: string[] = [];

    const generate = async (client: unknown) => {
      const provider = (client as { provider: string }).provider;
      providers.push(provider);
      return provider === "poyo"
        ? { code: 503, msg: "PoYo unavailable" }
        : { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
    };

    await generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "healthy", { providerHealth });
    await generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "healthy", { providerHealth });
    await generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "healthy", { providerHealth });

    expect(providers).toEqual(["poyo", "openai", "poyo", "openai", "openai"]);
    expect(providerHealth.recordPoyoRetryableFailure).toHaveBeenCalledTimes(2);
    expect(providerHealth.isPoyoCircuitOpen).toHaveBeenCalledTimes(3);
  });

  it("opens the direct OpenAI circuit after repeated transient fallback failures", async () => {
    let openAIFailureCount = 0;
    let openAICircuitOpen = false;
    const providerHealth = {
      isPoyoCircuitOpen: vi.fn(async () => true),
      recordPoyoRetryableFailure: vi.fn(async () => undefined),
      recordPoyoSuccess: vi.fn(async () => undefined),
      isOpenAICircuitOpen: vi.fn(async () => openAICircuitOpen),
      recordOpenAIRetryableFailure: vi.fn(async () => {
        openAIFailureCount += 1;
        if (openAIFailureCount >= 2) openAICircuitOpen = true;
      }),
      recordOpenAISuccess: vi.fn(async () => undefined),
    };
    const providers: string[] = [];
    const generate = async (client: unknown) => {
      const provider = (client as { provider: string }).provider;
      providers.push(provider);
      throw Object.assign(new Error("OpenAI temporarily unavailable"), { status: 503 });
    };

    await expect(generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "", { providerHealth, sleep: async () => undefined })).rejects.toMatchObject({ providerStatus: 503 });
    await expect(generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "", { providerHealth, sleep: async () => undefined })).rejects.toMatchObject({ providerStatus: 503 });
    await expect(generateSocialStudioTextWithFallback(SOCIAL_CONTENT_TEXT_MODEL, generate, () => "", { providerHealth, sleep: async () => undefined })).rejects.toMatchObject({ message: /temporarily paused/i });

    expect(providers).toEqual(["openai", "openai", "openai", "openai", "openai", "openai"]);
    expect(providerHealth.recordOpenAIRetryableFailure).toHaveBeenCalledTimes(2);
    expect(providerHealth.isOpenAICircuitOpen).toHaveBeenCalledTimes(3);
  });

  it("waits for the shared OpenAI capacity lease instead of starting another fallback request", async () => {
    const delays: number[] = [];
    const release = vi.fn(async () => undefined);
    const acquireOpenAILease = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "lease-1", release });
    const providerHealth = {
      isPoyoCircuitOpen: vi.fn(async () => true),
      recordPoyoRetryableFailure: vi.fn(async () => undefined),
      recordPoyoSuccess: vi.fn(async () => undefined),
      isOpenAICircuitOpen: vi.fn(async () => false),
      recordOpenAIRetryableFailure: vi.fn(async () => undefined),
      recordOpenAISuccess: vi.fn(async () => undefined),
      acquireOpenAILease,
    };

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async () => ({ output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] }),
      () => "healthy",
      { providerHealth, sleep: async (delayMs) => { delays.push(delayMs); }, random: () => 0.5 },
    );

    expect(result).toMatchObject({ provider: "openai", output: "healthy" });
    expect(acquireOpenAILease).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1_250, 1_250]);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("fails open when provider-health storage is unavailable", async () => {
    const providerHealth = {
      isPoyoCircuitOpen: vi.fn(async () => { throw new Error("Supabase unavailable"); }),
      recordPoyoRetryableFailure: vi.fn(async () => { throw new Error("Supabase unavailable"); }),
      recordPoyoSuccess: vi.fn(async () => { throw new Error("Supabase unavailable"); }),
    };
    const providers: string[] = [];

    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        providers.push((client as unknown as { provider: string }).provider);
        return { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      () => "healthy",
      { providerHealth },
    );

    expect(providers).toEqual(["poyo"]);
    expect(result).toMatchObject({ provider: "poyo", output: "healthy" });
  });

  it("gives every direct OpenAI attempt its own 45-second timeout", async () => {
    vi.useFakeTimers();
    let openAIAttempts = 0;
    const delays: number[] = [];
    const providerHealth = {
      isPoyoCircuitOpen: vi.fn(async () => false),
      recordPoyoRetryableFailure: vi.fn(async () => undefined),
      recordPoyoSuccess: vi.fn(async () => undefined),
    };
    const generation = generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        if ((client as unknown as { provider: string }).provider === "poyo") {
          return { code: 503, msg: "PoYo unavailable" };
        }
        openAIAttempts += 1;
        return await new Promise<never>(() => undefined);
      },
      () => "",
      {
        sleep: async (delayMs) => { delays.push(delayMs); },
        random: () => 0.5,
        providerHealth,
      },
    );
    const result = generation.then(
      () => null,
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(45_000);
    await vi.advanceTimersByTimeAsync(45_000);
    await vi.advanceTimersByTimeAsync(45_000);

    await expect(result).resolves.toMatchObject({ providerStatus: 504, attemptCount: 3 });
    expect(openAIAttempts).toBe(3);
    expect(delays).toEqual([750, 2_000]);
  });

  it("does not retry a non-retryable direct OpenAI fallback failure", async () => {
    const providers: string[] = [];
    const sleep = vi.fn(async () => undefined);

    await expect(generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        const provider = (client as unknown as { provider: string }).provider;
        providers.push(provider);
        if (provider === "poyo") return { code: 503, msg: "PoYo unavailable" };
        throw Object.assign(new Error("Unsupported request"), { status: 400 });
      },
      () => "",
      { sleep },
    )).rejects.toMatchObject({ providerStatus: 400 });

    expect(providers).toEqual(["poyo", "openai"]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not switch providers for a non-retryable PoYo 4xx failure", async () => {
    const calls: string[] = [];

    await expect(generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        calls.push((client as unknown as { provider: string }).provider);
        return { code: 400, msg: "Invalid request" };
      },
      () => "",
    )).rejects.toMatchObject({ providerStatus: 400 });

    expect(calls).toEqual(["poyo"]);
    expect(openAiConstructor).toHaveBeenCalledTimes(1);
  });

  it("surfaces a failed direct fallback as OpenAI, with safe provider metadata", async () => {
    const error = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async (client) => {
        if ((client as unknown as { provider: string }).provider === "poyo") return { code: 503, msg: "PoYo unavailable" };
        throw Object.assign(new Error("OpenAI service unavailable"), { status: 503 });
      },
      () => "",
    ).then(
      () => null,
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(OpenAIResponsesProviderError);
    expect(getSocialStudioResponsesErrorCode(error)).toBe("openai_responses_provider_error");
    expect(getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Luna")).toBe("OpenAI Responses / Luna");
  });

  it("reports a missing OpenAI key after a retryable PoYo failure", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const error = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_TEXT_MODEL,
      async () => ({ code: 503, msg: "PoYo unavailable" }),
      () => "",
    ).then(
      () => null,
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(OpenAIResponsesError);
    expect(getSocialStudioResponsesErrorCode(error)).toBe("openai_not_configured");
    expect(getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Luna")).toBe("OpenAI Responses");
  });

  it("creates isolated OpenAI-compatible clients for PoYo and direct OpenAI", () => {
    createSocialStudioPoyoClient();
    createSocialStudioOpenAIClient();

    expect(openAiConstructor).toHaveBeenNthCalledWith(1, {
      apiKey: "test-poyo-key",
      baseURL: "https://api.poyo.ai/v1",
      maxRetries: 0,
    });
    expect(openAiConstructor).toHaveBeenNthCalledWith(2, {
      apiKey: "test-openai-key",
      maxRetries: 0,
    });
  });

  it("reports missing provider keys without creating a client", () => {
    vi.stubEnv("POYO_API_KEY", "");
    expect(() => createSocialStudioPoyoClient()).toThrow(PoyoResponsesError);

    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => createSocialStudioOpenAIClient()).toThrow(OpenAIResponsesError);
    expect(openAiConstructor).not.toHaveBeenCalled();
  });
});
