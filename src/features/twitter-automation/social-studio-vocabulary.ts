import "server-only";

import { VOCABULARY_CARDS } from "@/data/cards";
import { LOCALE_CODES } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { buildCreateCardInput, buildCreateCardInstructions } from "@/features/cards/create-card-prompts";
import { generatedCardSchema, matchesRequestedTargetLanguage, type GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { createSocialStudioPoyoClient, generateSocialStudioTextWithFallback, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import type { LanguageCode, LocaleCode, Tier, VocabularyCard } from "@/types/domain";

export class SocialStudioVocabularyError extends Error {
  constructor(public readonly code: "vocabulary_selection_failed" | "custom_card_generation_failed") {
    super(code);
  }
}

export function normalizeSocialStudioVocabularyTerm(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function extractJsonObject(value: string) {
  const trimmed = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
}

function parseTerms(value: string, count: number) {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as { terms?: unknown };
    if (!Array.isArray(parsed.terms) || parsed.terms.length !== count) return null;
    const terms = parsed.terms.map((term) => typeof term === "string" ? term.trim().slice(0, 120) : "");
    if (terms.some((term) => !term || /\n/u.test(term))) return null;
    return new Set(terms.map(normalizeSocialStudioVocabularyTerm)).size === terms.length ? terms : null;
  } catch {
    return null;
  }
}

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function selectFromCatalog(language: LanguageCode, tier: Tier, count: number) {
  const candidates = VOCABULARY_CARDS.filter((card) => card.language === language && card.termKind === "word" && card.tier === tier);
  if (candidates.length < count) return null;
  return shuffle(candidates).slice(0, count).map((card) => card.term);
}

export async function selectSocialStudioVocabularyTerms({
  language,
  nativeLanguage,
  tier,
  count,
  generator,
}: {
  language: LanguageCode;
  nativeLanguage: LocaleCode;
  tier: Tier;
  count: number;
  generator: string;
}) {
  const catalogTerms = selectFromCatalog(language, tier, count);
  if (catalogTerms) return catalogTerms;

  const poyo = createSocialStudioPoyoClient();
  const { output } = await generateSocialStudioTextWithFallback(
    SOCIAL_CONTENT_CREATIVE_MODEL,
    (model) => poyo.responses.create({
      model,
      instructions: [
        "Select vocabulary for a FoxiesDeck social post. Return one JSON object only: { terms: [string] }.",
        `Select exactly ${count} real, useful, distinct ${language} vocabulary ${count === 1 ? "term" : "terms"} at CEFR ${tier}. You choose the terms yourself; do not select from any catalogue and do not use any example list.`,
        "The selection must be completely random. Do not repeat any term that could plausibly have appeared in the previous few generations for this language and tier. Even if this request runs immediately after a previous one, never produce the same term again.",
        "Use standard spelling, no explanations, no translations, and no invented words.",
      ].join("\n"),
      input: JSON.stringify({ learningLanguage: language, nativeLanguage, requestedTier: tier, generator }),
      max_output_tokens: 300,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    }),
    extractResponseOutputText,
  );
  const terms = parseTerms(output, count);
  if (!terms) throw new SocialStudioVocabularyError("vocabulary_selection_failed");
  return terms;
}

function toStudioCustomCard(generated: GeneratedCardResponse): VocabularyCard {
  const sourceKey = `social-studio:${generated.language}:${encodeURIComponent(generated.term).replace(/%/gu, "-")}`;
  const translations = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, generated.translations[locale]!])) as VocabularyCard["translations"];
  const grammar = { summary: "", rules: generated.grammar, details: [] };
  const grammarByLocale = Object.fromEntries(LOCALE_CODES.map((locale) => [locale, grammar])) as unknown as VocabularyCard["grammarByLocale"];
  return {
    id: sourceKey, sourceKey, englishKey: translations.en, language: generated.language, tier: generated.tier, termKind: generated.termKind,
    term: generated.term, translation: translations.en, translations,
    translationMeaningsByLocale: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, [translations[locale]]])) as VocabularyCard["translationMeaningsByLocale"],
    pronunciation: generated.pronunciation, partOfSpeech: generated.partOfSpeech, example: generated.example, exampleTranslation: generated.exampleTranslation,
    examples: [{
      id: `${sourceKey}:example:0`, context: "natural", label: "Natural", sentence: generated.example, translation: generated.exampleTranslation,
      translations: Object.fromEntries(LOCALE_CODES.map((locale) => [locale, generated.exampleTranslation])) as VocabularyCard["examples"][number]["translations"],
    }],
    grammar, grammarByLocale,
  };
}

export function findSocialStudioCatalogCard(language: LanguageCode, term: string) {
  const normalizedTerm = normalizeSocialStudioVocabularyTerm(term);
  return VOCABULARY_CARDS.find((card) => card.language === language && card.termKind === "word" && normalizeSocialStudioVocabularyTerm(card.term) === normalizedTerm) ?? null;
}

export async function createSocialStudioCustomCard(term: string, language: LanguageCode, nativeLanguage: LocaleCode) {
  const poyo = createSocialStudioPoyoClient();
  const { output } = await generateSocialStudioTextWithFallback(
    SOCIAL_CONTENT_CREATIVE_MODEL,
    (model) => poyo.responses.create({
      model,
      instructions: buildCreateCardInstructions({ locale: nativeLanguage, targetLanguage: language }),
      input: buildCreateCardInput({ locale: nativeLanguage, term, targetLanguage: language }),
      max_output_tokens: 700,
      reasoning: { effort: "minimal" },
      store: false,
      text: { format: { type: "text" }, verbosity: "low" },
    }),
    extractResponseOutputText,
  );
  let raw: unknown;
  try {
    raw = JSON.parse(extractJsonObject(output));
  } catch {
    throw new SocialStudioVocabularyError("custom_card_generation_failed");
  }
  const generated = generatedCardSchema.safeParse(raw);
  if (!generated.success || !matchesRequestedTargetLanguage(generated.data, language)) throw new SocialStudioVocabularyError("custom_card_generation_failed");
  return toStudioCustomCard(generated.data);
}

export async function resolveSocialStudioVocabularyCard(term: string, language: LanguageCode, nativeLanguage: LocaleCode) {
  return findSocialStudioCatalogCard(language, term) ?? await createSocialStudioCustomCard(term, language, nativeLanguage);
}
