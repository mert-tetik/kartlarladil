export interface SelfExampleSentence {
  sentence: string;
  translation: string;
}

export interface SelfExampleSentencesContent {
  sentences: [SelfExampleSentence, SelfExampleSentence, SelfExampleSentence];
}

export function normalizeSelfExampleSentence(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

export function isSelfExampleSentencesContent(value: unknown): value is SelfExampleSentencesContent {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SelfExampleSentencesContent>;
  return Array.isArray(candidate.sentences)
    && candidate.sentences.length === 3
    && candidate.sentences.every((entry) => entry
      && typeof entry.sentence === "string"
      && entry.sentence.trim().length > 0
      && typeof entry.translation === "string"
      && entry.translation.trim().length > 0);
}
