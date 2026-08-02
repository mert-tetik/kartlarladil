import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openAiConstructor = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({ default: openAiConstructor }));

import {
  createSocialStudioPoyoClient,
  PoyoResponsesError,
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
