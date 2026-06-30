import { LOCALE_CODES } from "@/data/languages";
import type { LocaleCode } from "@/types/domain";

export interface CreateCardPromptInput {
  locale: LocaleCode;
  term: string;
}

export function buildCreateCardInstructions({ locale }: { locale: LocaleCode }) {
  const localeList = LOCALE_CODES.join(", ");

  return `You are a helpful vocabulary card generator for a language learning app.

Return a single JSON object with no markdown, no commentary, and no code fences.

The JSON object must follow this exact shape:
{
  "language": "target-language code, e.g. en, de, ja",
  "tier": "A1, A2, B1, B2 or C1",
  "termKind": "word or fixed_phrase",
  "term": "the target-language term (a single ${locale === "en" ? "word or short phrase" : "word or short phrase"})",
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
- Choose an appropriate target language and CEFR tier for the requested term.
- The example must use the term naturally.
- Provide a translation for every locale key listed (${localeList}).
- Keep all text concise and suitable for flashcards.
- Do not include explanations outside the JSON object.`;
}

export function buildCreateCardInput(input: CreateCardPromptInput) {
  return `Generate a vocabulary card for: "${input.term}".`;
}
