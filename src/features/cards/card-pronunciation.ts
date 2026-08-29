import { z } from "zod";

export const cardPronunciationRequestSchema = z
  .object({
    sourceKey: z.string().trim().min(1).max(320),
    preview: z.boolean().optional(),
  })
  .strict();

export type CardPronunciationStatus = "pending" | "ready" | "failed";

export interface CardPronunciationResult {
  status: CardPronunciationStatus;
  pronunciation?: string;
}

export function normalizeGeneratedPronunciation(value: unknown): string | null {
  const normalized = String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("tr")
    .replace(/w/gu, "v")
    .replace(/\u00e7/gu, "ch")
    .replace(/\u015f/gu, "sh")
    .replace(/\s+/gu, " ");

  // Turkish-style phonetic respelling: no IPA, source-language scripts, or
  // specialist phonetic symbols. The dotless ı is retained because it is a
  // basic, familiar Turkish sound marker. Turkish ç/ş and source-language w
  // are normalized to ch/sh and v before validation.
  return /^[a-zı]+(?:[ '\-][a-zı]+)*$/u.test(normalized) ? normalized : null;
}
