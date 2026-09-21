"use client";

import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { GeneratedCardDraft } from "@/features/cards/custom-card-types";
import type { LanguageCode, TermKind, Tier, VocabularyCard } from "@/types/domain";

export interface CreateCustomCardInput {
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  draft: GeneratedCardDraft;
  optimisticCard: VocabularyCard;
}

type CreateCustomCard = (input: CreateCustomCardInput) => Promise<void>;

export function createCustomCardFromGenerated(
  generated: GeneratedCardResponse,
  createCustomCard: CreateCustomCard,
) {
  const optimisticSourceKey = createPendingCustomCardSourceKey();
  const optimisticCard = {
    ...buildPreviewVocabularyCard(generated),
    id: optimisticSourceKey,
    sourceKey: optimisticSourceKey,
  };

  return createCustomCard({
    language: generated.language,
    tier: generated.tier,
    termKind: generated.termKind,
    draft: toGeneratedCardDraft(generated),
    optimisticCard,
  });
}

function toGeneratedCardDraft(generated: GeneratedCardResponse): GeneratedCardDraft {
  return {
    term: generated.term,
    partOfSpeech: generated.partOfSpeech,
    pronunciation: generated.pronunciation,
    translations: generated.translations,
    example: generated.example,
    exampleTranslation: generated.exampleTranslation,
    definitions: generated.definitions,
    grammar: generated.grammar,
    termKind: generated.termKind,
  };
}

function createPendingCustomCardSourceKey() {
  return `pending-custom:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
