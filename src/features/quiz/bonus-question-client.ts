import type { LanguageCode, LocaleCode, VocabularyCard } from "@/types/domain";
import {
  generatedCategoryBonusSchema,
  generatedSentenceBonusSchema,
  type GeneratedCategoryBonus,
  type GeneratedSentenceBonus,
} from "@/features/quiz/bonus-questions";

const API_ROUTE = "/api/quiz/bonus";
const REQUEST_TIMEOUT_MS = 8_000;

export async function requestSentenceBonusQuestion(input: {
  language: LanguageCode;
  locale: LocaleCode;
  cards: VocabularyCard[];
  sentence?: string;
}): Promise<GeneratedSentenceBonus | null> {
  return requestBonus(
    "sentence-order",
    input.language,
    input.cards,
    generatedSentenceBonusSchema,
    input.locale,
    input.sentence,
  );
}

export async function requestCategoryBonusQuestion(input: {
  language: LanguageCode;
  cards: VocabularyCard[];
}): Promise<GeneratedCategoryBonus | null> {
  return requestBonus("category-sort", input.language, input.cards, generatedCategoryBonusSchema);
}

async function requestBonus<T>(
  kind: "sentence-order" | "category-sort",
  language: LanguageCode,
  cards: VocabularyCard[],
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  locale?: LocaleCode,
  sentence?: string,
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        language,
        ...(locale ? { locale } : {}),
        ...(sentence ? { sentence } : {}),
        cards: cards.slice(0, 40).map((card) => ({
          id: card.id,
          term: card.term,
        })),
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const parsed = schema.safeParse(await response.json().catch(() => null));
    return parsed.success ? parsed.data ?? null : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
