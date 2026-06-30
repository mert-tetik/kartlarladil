import { LOCALE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode, Tier, TermKind } from "@/types/domain";

export interface CreateCardPromptInput {
  language: LanguageCode;
  locale: LocaleCode;
  tier: Tier;
  termKind: TermKind;
  topic?: string;
}

export function buildCreateCardInstructions({ locale }: { locale: LocaleCode }) {
  const localeList = LOCALE_CODES.join(", ");

  return `You are a helpful vocabulary card generator for a language learning app.

Return a single JSON object with no markdown, no commentary, and no code fences.

The JSON object must follow this exact shape:
{
  "term": "the target-language term (a single ${locale === "en" ? "word" : "word or short phrase"})",
  "partOfSpeech": "e.g. noun, verb, adjective, adverb",
  "pronunciation": "simple IPA or romanization if useful, otherwise empty string",
  "translations": {
${LOCALE_CODES.map((code) => `    "${code}": "translation in ${code}"`).join(",\n")}
  },
  "example": "one natural example sentence in the target language",
  "exampleTranslation": "English translation of the example sentence",
  "grammar": ["1-2 short grammar or usage notes in English"]
}

Rules:
- The term must be appropriate for the requested CEFR tier.
- The example must use the term naturally.
- Provide a translation for every locale key listed (${localeList}).
- Keep all text concise and suitable for flashcards.
- Do not include explanations outside the JSON object.`;
}

export function buildCreateCardInput(input: CreateCardPromptInput) {
  const kindLabel = input.termKind === "fixed_phrase" ? "fixed phrase" : "word";
  const parts = [
    `Generate a ${input.tier} level ${kindLabel} for ${input.language}.`,
    input.topic ? `Topic: ${input.topic}.` : null,
  ].filter(Boolean);

  return parts.join(" ");
}
