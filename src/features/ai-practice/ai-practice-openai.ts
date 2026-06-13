import { createHash } from "node:crypto";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

export const AI_PRACTICE_DEFAULT_MODEL = "gpt-5-nano";

export function createAiPracticeSafetyIdentifier(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 64);
}

export function extractResponseOutputText(response: OpenAIResponse) {
  return response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}
