import type { Tier } from "@/types/domain";

export interface SelfVocabularyProgressionContent {
  beginnerTerm: string;
  intermediateTerm: string;
  advancedTerm: string;
  beginnerTier: Tier;
  intermediateTier: Tier;
  advancedTier: Tier;
  beginnerExplanation: string;
  intermediateExplanation: string;
  advancedExplanation: string;
}

const PROGRESSION_TIERS = { beginner: "A1", intermediate: "B2", advanced: "C1" } as const;

export function normalizeSelfVocabularyProgressionTerm(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

export function isSelfVocabularyProgressionContent(value: unknown): value is SelfVocabularyProgressionContent {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SelfVocabularyProgressionContent>;
  return [
    candidate.beginnerTerm,
    candidate.intermediateTerm,
    candidate.advancedTerm,
    candidate.beginnerExplanation,
    candidate.intermediateExplanation,
    candidate.advancedExplanation,
  ].every((field) => typeof field === "string" && field.trim().length > 0)
    && candidate.beginnerTier === PROGRESSION_TIERS.beginner
    && candidate.intermediateTier === PROGRESSION_TIERS.intermediate
    && candidate.advancedTier === PROGRESSION_TIERS.advanced;
}
