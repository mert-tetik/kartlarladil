import type { TermKind } from "@/types/domain";

export interface DbCustomCard {
  id: string;
  user_id: string;
  source_key: string;
  language: string;
  tier: string;
  term: string;
  term_kind: string;
  translations: Record<string, string>;
  translation_meanings: Record<string, string[]>;
  part_of_speech: string;
  pronunciation: string;
  examples: unknown;
  grammar: unknown;
  created_at: string;
}

export interface GeneratedCardDraft {
  term: string;
  partOfSpeech: string;
  pronunciation: string;
  translations: Record<string, string>;
  example: string;
  exampleTranslation: string;
  grammar: string[];
  termKind: TermKind;
}
