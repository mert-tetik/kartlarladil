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
    vi.unstubAllEnvs();
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
