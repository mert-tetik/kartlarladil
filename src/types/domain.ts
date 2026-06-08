export type LanguageCode = "en" | "de" | "ru";

export type Tier = "A1" | "A2" | "B1" | "B2" | "C1";

export type CardStatus = "active" | "learned";

export type PracticeMode = "active" | "learned";

export type ExampleContext = "daily" | "question" | "negative" | "contextual" | "natural";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  accent: string;
}

export interface CardExample {
  id: string;
  context: ExampleContext;
  label: string;
  sentence: string;
  translation: string;
}

export interface GrammarTable {
  title: string;
  columns: string[];
  rows: string[][];
}

export interface GrammarGuide {
  summary: string;
  rules: string[];
  details: string[];
  tables?: GrammarTable[];
}

export interface VocabularyCard {
  id: string;
  sourceKey: string;
  language: LanguageCode;
  tier: Tier;
  term: string;
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  examples: CardExample[];
  grammar: GrammarGuide;
}

export interface InventoryCard {
  cardId: string;
  status: CardStatus;
  correctCount: number;
  addedAt: string;
  learnedAt?: string;
}

export interface PracticeAttempt {
  id: string;
  cardId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  mode: PracticeMode;
  createdAt: string;
}

export interface QuizQuestion {
  card: VocabularyCard;
  options: string[];
  correctAnswer: string;
}

export interface CardFilters {
  language?: LanguageCode | "all";
  tier?: Tier | "all";
  query?: string;
}

export interface CardRepository {
  list(filters?: CardFilters): VocabularyCard[];
  findById(cardId: string): VocabularyCard | undefined;
  draw(count: 5 | 10, filters?: CardFilters, excludedIds?: string[]): VocabularyCard[];
}

export interface InventoryRepository {
  list(): InventoryCard[];
  add(cardId: string): InventoryCard[];
  has(cardId: string): boolean;
  recordAnswer(cardId: string, isCorrect: boolean, selectedAnswer: string): InventoryCard[];
}
