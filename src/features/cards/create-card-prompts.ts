import { LOCALE_CODES } from "@/data/languages";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export interface CreateCardPromptInput {
  locale: LocaleCode;
  term: string;
  targetLanguage?: LanguageCode;
}

const NATIVE_WRITING_SYSTEMS: Partial<Record<LanguageCode, string>> = {
  ru: "Cyrillic",
  ar: "Arabic",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Simplified Chinese",
};

export function buildCreateCardInstructions({ locale, targetLanguage }: { locale: LocaleCode; targetLanguage?: LanguageCode }) {
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
- ${targetLanguage ? `Set language to exactly "${targetLanguage}". Do not choose another target language.` : "Choose an appropriate target language and CEFR tier for the requested term."}
- ${targetLanguage && NATIVE_WRITING_SYSTEMS[targetLanguage] ? `When the requested term is written as a Latin-script transliteration, convert term to its canonical ${NATIVE_WRITING_SYSTEMS[targetLanguage]} spelling. Preserve the original meaning; keep the romanization only in pronunciation when useful. For example, Russian "ya ne znayu" becomes term "я не знаю".` : "Keep term in the target language's standard spelling."}
- The example must use the term naturally.
- Provide a translation for every locale key listed (${localeList}).
- Keep all text concise and suitable for flashcards.
- Do not include explanations outside the JSON object.`;
}

export function buildCreateCardInput(input: CreateCardPromptInput) {
  return input.targetLanguage
    ? `Generate a ${input.targetLanguage} vocabulary card for: "${input.term}".`
    : `Generate a vocabulary card for: "${input.term}".`;
}
