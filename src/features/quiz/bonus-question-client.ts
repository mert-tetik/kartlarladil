import type { LanguageCode, VocabularyCard } from "@/types/domain";
import {
  generatedCategoryBonusSchema,
  generatedSentenceBonusSchema,
  type GeneratedCategoryBonus,
  type GeneratedSentenceBonus,
} from "@/features/quiz/bonus-questions";

const API_ROUTE = "/api/quiz/bonus";
const REQUEST_TIMEOUT_MS = 4_500;

export async function requestSentenceBonusQuestion(input: {
  language: LanguageCode;
  cards: VocabularyCard[];
}): Promise<GeneratedSentenceBonus | null> {
  return requestBonus("sentence-order", input.language, input.cards, generatedSentenceBonusSchema);
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
