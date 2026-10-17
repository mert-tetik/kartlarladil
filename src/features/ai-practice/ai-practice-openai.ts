import { createHash } from "node:crypto";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";

export const AI_PRACTICE_DEFAULT_MODEL = "gpt-5-nano";

export function createAiPracticeSafetyIdentifier(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 64);
}

export function extractResponseOutputText(response: OpenAIResponse) {
  // OpenAI-compatible providers can return an error-shaped JSON body with
  // HTTP 200, or use `text` instead of `output_text` for content parts. Keep
  // the extraction defensive so callers can inspect the provider response and
  // return a precise error instead of crashing here. Reading the raw parts
  // first is intentional: some providers put the beginning in a `text` part
  // and the rest in an `output_text` part. The SDK's top-level output_text can
  // then contain only the latter and would silently drop the prefix.
  const output = Array.isArray(response.output) ? response.output : [];

  const outputPartsText = output
    .flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const candidate = item as { content?: unknown; text?: unknown; type?: unknown };
      if (
        typeof candidate.text === "string" &&
        (candidate.type === "output_text" || candidate.type === "text" || candidate.type === undefined)
      ) {
        return [candidate.text];
      }

      if (!Array.isArray(candidate.content)) {
        return [];
      }

      return candidate.content.flatMap((content) => {
        if (!content || typeof content !== "object") {
          return [];
        }

        const part = content as { text?: unknown; type?: unknown };
        return typeof part.text === "string" && (part.type === "output_text" || part.type === "text")
          ? [part.text]
          : [];
      });
    })
    .join("");

  if (outputPartsText.length > 0) return outputPartsText;
  return typeof response.output_text === "string" ? response.output_text : "";
}
