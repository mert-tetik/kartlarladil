import { normalizeGeneratedPronunciation } from "@/features/cards/card-pronunciation";

/**
 * Models occasionally add an accent mark despite the Turkish-style output
 * rule. Normalize only decomposable Latin accents for structured card output;
 * keep IPA and other unsupported symbols invalid.
 */
export function normalizeModelGeneratedPronunciation(value: unknown): string | null {
  const strict = normalizeGeneratedPronunciation(value);
  if (strict) return strict;

  const accentNormalized = String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("tr")
    .replace(/w/gu, "v")
    .replace(/\u00e7/gu, "ch")
    .replace(/\u015f/gu, "sh")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, " ");

  return normalizeGeneratedPronunciation(accentNormalized);
}
