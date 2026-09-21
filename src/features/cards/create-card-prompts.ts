import { LOCALE_CODES } from "@/data/languages";
import {
  buildTransliterationHint,
  NATIVE_WRITING_SYSTEMS,
} from "@/features/cards/create-card-language";
import type { CreateCardDirection } from "@/features/cards/create-card-schema";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export interface CreateCardPromptInput {
  locale: LocaleCode;
  term: string;
  targetLanguage?: LanguageCode;
  direction?: CreateCardDirection;
}

export function buildCreateCardInstructions({
  locale,
  targetLanguage,
  direction = "native-to-learning",
}: {
  locale: LocaleCode;
  targetLanguage?: LanguageCode;
  direction?: CreateCardDirection;
}) {
  const localeList = LOCALE_CODES.join(", ");
  const directionRules = targetLanguage
    ? direction === "learning-to-native"
      ? `The user's input is intended to be written in the learning language ${targetLanguage}. It may be written in that language's native script OR as a Latin-script phonetic transliteration, including Turkish-style spellings and variants such as "slu\u015fat" and "slushat". Interpret the sound and meaning in ${targetLanguage}; do not treat a Latin transliteration as an English or ${locale} word. Set language to exactly "${targetLanguage}", restore the canonical target-language spelling in term, and translate/explain it into the user's native/UI language ${locale}.`
      : `The user's input is written in the native/UI language ${locale}. First understand the source meaning and any source-language inflection, then translate it into the learning language ${targetLanguage} and normalize the translated result to the target language's dictionary lemma. Never copy the source-language word into term. For example, Turkish "dinliyorum" becomes English lemma "listen" (not Turkish "dinlemek"), Turkish "ko\u015fuyorum" becomes English "run" (not Turkish "ko\u015fmak"), and Turkish "gidiyordum" becomes German "gehen" (not German "ging"). Set language to exactly "${targetLanguage}", and use the translated learning-language word or phrase as term.`
    : "Infer the input and target languages from the term and the request, while keeping language consistent with the generated card.";

  const lemmaRule = `The term field must always use the target language's standard dictionary lemma (citation form), not the user's surface form. If the input is an inflected, conjugated, declined, or polite form, normalize it to the language's normal dictionary form: verbs use the standard infinitive or dictionary citation form, nouns use the standard singular citation form where that language uses one, and adjectives use the base dictionary form. For every one-token input, termKind MUST be "word"; use "fixed_phrase" only when the input itself contains multiple words. Never classify a one-token inflected verb as a fixed phrase. Preserve a multi-word fixed phrase as a phrase. Examples: Russian "slu\u015fayu" or "slushayu" must produce "\u0441\u043b\u0443\u0448\u0430\u0442\u044c" (slushat, to listen), not "\u0441\u043b\u0443\u0448\u0430\u044e" (slushayu, I listen); Spanish "hablando" -> "hablar"; Portuguese "falando" -> "falar"; German "ging" -> "gehen"; French "mangeais" -> "manger"; English "running" -> "run"; Japanese "tabemashita" -> "\u98df\u3079\u308b"; Korean "meogeosseoyo" -> "\uba39\ub2e4"; Turkish "gidiyorum" -> "gitmek" and "ko\u015fuyorum" -> "ko\u015fmak".`;

  const writingSystemRule = targetLanguage && NATIVE_WRITING_SYSTEMS[targetLanguage]
    ? `The target language uses ${NATIVE_WRITING_SYSTEMS[targetLanguage]}. If the input is transliterated, term MUST contain the canonical ${NATIVE_WRITING_SYSTEMS[targetLanguage]} spelling, never the Latin transliteration. Keep the Latin reading only in pronunciation. These are semantic mappings, not loose sound suggestions: Russian "slu\u015fat", "slushat", and "slushat'" mean "\u0441\u043b\u0443\u0448\u0430\u0442\u044c" (to listen), never "\u0441\u043b\u044b\u0448\u0430\u0442\u044c" (to hear); inflected Russian "slu\u015fayu" or "slushayu" also maps to the lemma "\u0441\u043b\u0443\u0448\u0430\u0442\u044c", not "\u0441\u043b\u0443\u0448\u0430\u044e"; Russian "ya ne znayu" becomes "\u044f \u043d\u0435 \u0437\u043d\u0430\u044e"; Arabic "marhaban" becomes "\u0645\u0631\u062d\u0628\u0627" and "shukran" becomes "\u0634\u0643\u0631\u0627"; Japanese "arigatou" becomes the single word "\u3042\u308a\u304c\u3068\u3046" (use "\u3042\u308a\u304c\u3068\u3046\u3054\u3056\u3044\u307e\u3059" only for "arigatou gozaimasu"); Korean "annyeong" becomes "\uc548\ub155"; Simplified Chinese "ni hao" becomes "\u4f60\u597d".`
    : "Keep term in the target language's standard spelling.";

  const canonicalScriptRule = targetLanguage && NATIVE_WRITING_SYSTEMS[targetLanguage]
    ? `Never return a Latin-only term for ${targetLanguage}, even when the user typed a transliteration. Do not guess from the surface language of the Latin letters; use phonetic similarity, common romanization variants, and the requested target language.`
    : "";

  return `You are a helpful vocabulary card generator for a language learning app.

Return a single JSON object with no markdown, no commentary, and no code fences.

The JSON object must follow this exact shape:
{
  "language": "target-language code, e.g. en, de, ja",
  "tier": "A1, A2, B1, B2 or C1",
  "termKind": "word or fixed_phrase",
  "term": "the target-language dictionary lemma/citation form (a single word or short fixed phrase)",
  "partOfSpeech": "e.g. noun, verb, adjective, adverb",
  "pronunciation": "one Turkish-style phonetic respelling in lowercase Latin letters",
  "translations": {
${LOCALE_CODES.map((code) => `    "${code}": "translation in ${code}"`).join(",\n")}
  },
  "example": "one natural example sentence in the target language",
  "exampleTranslation": "English translation of the example sentence",
  "definitions": {
${LOCALE_CODES.map((code) => `    "${code}": "a short, clear definition of the target term written in ${code}"`).join(",\n")}
  },
  "grammar": ["1-2 short grammar or usage notes in English"]
}

Rules:
- ${directionRules}
- ${targetLanguage ? `Set language to exactly "${targetLanguage}". Do not choose another target language.` : "Choose an appropriate target language and CEFR tier for the requested term."}
- ${writingSystemRule}
- ${canonicalScriptRule}
- ${lemmaRule}
- Preserve the input's lexical granularity and register. A single-word input must produce one canonical target-language word, not a synonym, polite alternative, inflected variant, or longer phrase. A multi-word input must remain a phrase with the same meaning and boundaries.
- The example must use the canonical term naturally.
- Provide one short, clear, single-meaning definition for every locale key in definitions. Write each definition in that locale's language; explain the term rather than translating it.
- Definitions must not include examples, synonyms, numbering, labels, notes, or meta commentary.
- Always provide a pronunciation. It must show how a Turkish speaker should read the term in the selected target language, not in English unless that target language is English.
- Use lowercase Latin letters, Turkish dotless \u0131, spaces, apostrophes, and hyphens only. Always write w as v, write the \u00e7 sound as ch, and write the \u015f sound as sh. Never output w, \u00e7, or \u015f in pronunciation.
- Do not use IPA, slashes, brackets, stress marks, source-language scripts, accented letters, digits, or punctuation in pronunciation.
- This pronunciation is a Turkish-style sound guide, not a translation and not a copy of the term's spelling. For example, English "actually" becomes "eksh\u0131ll\u0131".
- Provide a translation for every locale key listed (${localeList}).
- Keep all text concise and suitable for flashcards.
- FINAL CHECK BEFORE RETURNING JSON: if the input has one token, output exactly one target-language dictionary headword and set termKind to "word". Never return the inflected input surface form. If the source/UI language is Turkish and the target language is not Turkish, term must be translated into the target language, never a Turkish word: "dinliyorum" -> English "listen", "ko\u015fuyorum" -> English "run", and "gidiyordum" -> German "gehen". If the target language uses a native script, term must use that script even when the input was transliterated.
- Do not include explanations outside the JSON object.`;
}

export function buildCreateCardInput(input: CreateCardPromptInput) {
  const trimmedTerm = input.term.trim();
  const inputShapeRule = trimmedTerm.split(/\s+/u).length === 1
    ? "The input is one lexical item. Analyze its morphology and return the target language's standard dictionary lemma only. Set termKind to word. Do not copy an inflected, conjugated, declined, or polite surface form into term; do not expand it into a synonym or longer phrase."
    : "The input is a multi-word phrase. Preserve its phrase meaning, word boundaries, and register; do not replace it with a shorter or more polite alternative.";

  if (input.targetLanguage && input.direction === "learning-to-native") {
    const transliterationHint = buildTransliterationHint(input.term, input.targetLanguage);
    return `Generate a ${input.targetLanguage} vocabulary card from this learning-language input exactly as typed: "${input.term}". The input is already intended to be in the target learning language. If it is Latin transliteration, decode it phonetically into the canonical ${input.targetLanguage} script before writing term. ${inputShapeRule} Preserve its meaning and provide the native-language translations and explanations required by the schema.${transliterationHint ? ` ${transliterationHint}` : ""}`;
  }

  return input.targetLanguage
    ? `Generate a ${input.targetLanguage} vocabulary card from this native-language input in ${input.locale}: "${input.term}". Translate the input into ${input.targetLanguage}; do not copy the native-language spelling into term. ${inputShapeRule}`
    : `Generate a vocabulary card for: "${input.term}".`;
}
