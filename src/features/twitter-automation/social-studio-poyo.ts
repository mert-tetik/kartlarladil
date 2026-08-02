import "server-only";

import OpenAI from "openai";

const POYO_RESPONSES_BASE_URL = "https://api.poyo.ai/v1";

export const SOCIAL_CONTENT_TEXT_MODEL = "gpt-5-6-luna";
export const SOCIAL_CONTENT_CREATIVE_MODEL = "gpt-5-6-terra";

export class PoyoResponsesError extends Error {
  constructor(public readonly code: "poyo_not_configured") {
    super(code);
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
