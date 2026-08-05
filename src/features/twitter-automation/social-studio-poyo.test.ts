import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAiConstructor = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({ default: openAiConstructor }));

import {
  createSocialStudioPoyoClient,
  generateSocialStudioTextWithFallback,
  PoyoResponsesError,
  SOCIAL_CONTENT_FALLBACK_MODEL,
  SOCIAL_CONTENT_CREATIVE_MODEL,
  SOCIAL_CONTENT_TEXT_MODEL,
} from "@/features/twitter-automation/social-studio-poyo";

describe("Content Automation PoYo Responses client", () => {
  beforeEach(() => {
    vi.stubEnv("POYO_API_KEY", "test-poyo-key");
    openAiConstructor.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Luna only for short social text and Terra for creative plans", () => {
    expect(SOCIAL_CONTENT_TEXT_MODEL).toBe("gpt-5-6-luna");
    expect(SOCIAL_CONTENT_CREATIVE_MODEL).toBe("gpt-5-6-terra");
  });

  it("retries a provider 5xx once on GPT-5.5", async () => {
    const calls: string[] = [];
    const result = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      async (model) => {
        calls.push(model);
        return model === SOCIAL_CONTENT_CREATIVE_MODEL
          ? { code: 500, msg: "Server exception" }
          : { output: [{ type: "message", content: [{ type: "output_text", text: "healthy" }] }] };
      },
      (response) => Array.isArray((response as { output?: unknown }).output) ? "healthy" : "",
    );

    expect(calls).toEqual([SOCIAL_CONTENT_CREATIVE_MODEL, SOCIAL_CONTENT_FALLBACK_MODEL]);
    expect(result).toMatchObject({ model: SOCIAL_CONTENT_FALLBACK_MODEL, output: "healthy" });
  });

  it("creates an OpenAI-compatible client against PoYo Responses", () => {
    createSocialStudioPoyoClient();

    expect(openAiConstructor).toHaveBeenCalledWith({
      apiKey: "test-poyo-key",
      baseURL: "https://api.poyo.ai/v1",
      maxRetries: 0,
    });
  });

  it("returns a clear configuration error and never creates another provider client without a PoYo key", () => {
    vi.stubEnv("POYO_API_KEY", "");

    expect(() => createSocialStudioPoyoClient()).toThrow(PoyoResponsesError);
    expect(openAiConstructor).not.toHaveBeenCalled();
  });
});
