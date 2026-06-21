export type LocaleCode =
  | "tr"
  | "en"
  | "de"
  | "ru"
  | "fr"
  | "es"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "ar"
  | "ja"
  | "ko"
  | "zh-CN";

export type LanguageCode = LocaleCode;

export type TextDirection = "ltr" | "rtl";

export type TermKind = "word" | "fixed_phrase";

export type Tier = "A1" | "A2" | "B1" | "B2" | "C1";
export type PreferredTier = Tier | "all";

export type CardStatus = "active" | "learned";

export type PracticeMode = "active" | "learned";

export type ExampleContext = "daily" | "question" | "negative" | "contextual" | "natural";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  accent: string;
  flagCode: string;
  dir: TextDirection;
}

export interface CardExample {
  id: string;
  context: ExampleContext;
  label: string;
  sentence: string;
  translation: string;
  translations: Record<LocaleCode, string>;
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
  englishKey: string;
  language: LanguageCode;
  tier: Tier;
  termKind: TermKind;
  term: string;
  translation: string;
  translations: Record<LocaleCode, string>;
  pronunciation: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  examples: CardExample[];
  grammar: GrammarGuide;
  grammarByLocale: Record<LocaleCode, GrammarGuide>;
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

export type TierPoints = Record<Tier, number>;

export type RankIconId =
  | "trophy"
  | "medal"
  | "book"
  | "compass"
  | "graduation"
  | "star"
  | "languages"
  | "gem"
  | "crown"
  | "flame";

export interface RankDefinition {
  id: string;
  label: string;
  minPoints: number;
  icon: RankIconId;
}

export interface TierProgressStat {
  tier: Tier;
  total: number;
  learned: number;
  points: number;
}

export interface LanguageProgressStat {
  language: LanguageCode;
  total: number;
  learned: number;
  points: number;
}

export interface ProgressStats {
  totalPoints: number;
  totalCards: number;
  activeCards: number;
  learnedCards: number;
  rank: RankDefinition;
  nextRank: RankDefinition | null;
  pointsToNextRank: number;
  rankProgressPercent: number;
  tierStats: TierProgressStat[];
  languageStats: LanguageProgressStat[];
}

export type SubscriptionPlan = "free" | "basic" | "pro";

export type SubscriptionStatus =
  | "free"
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

export type LimitErrorCode =
  | "free_active_card_limit"
  | "free_learned_card_limit"
  | "ai_daily_limit"
  | "ai_monthly_limit";

export type AiUsageEventType = "chat" | "translate" | "ask";

export interface PlanLimits {
  activeCards: number | null;
  learnedCards: number | null;
  aiDailyMessages: number;
  aiMonthlyMessages: number;
}

export interface UserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  customerPortalUrl: string | null;
  renewsAt: string | null;
  endsAt: string | null;
}

export interface UserEntitlements {
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan;
  status: SubscriptionStatus;
  limits: PlanLimits;
  customerPortalUrl: string | null;
}

export interface CardFilters {
  language?: LanguageCode | "all";
  tier?: Tier | "all";
  query?: string;
}

export interface CardRepository {
  list(filters?: CardFilters): VocabularyCard[];
  findById(cardId: string): VocabularyCard | undefined;
  draw(count: number, filters?: CardFilters, excludedIds?: string[]): VocabularyCard[];
}

export interface InventoryRepository {
  list(): InventoryCard[];
  add(cardId: string): InventoryCard[];
  has(cardId: string): boolean;
  recordAnswer(cardId: string, isCorrect: boolean, selectedAnswer: string): InventoryCard[];
}

export type AiPracticeChatRole = "user" | "assistant";

export interface AiPracticeMessage {
  role: AiPracticeChatRole;
  content: string;
}

export interface AiPracticeChatRequest {
  language: LanguageCode;
  characterId: string;
  messages: AiPracticeMessage[];
}

export interface AiPracticeCharacter {
  id: string;
  imageSrc: string;
  sourcePersonality: string;
  namesByLanguage: Record<LanguageCode, string>;
  summaryByLocale: Record<LocaleCode, string>;
  openingLinesByLanguage: Partial<Record<LanguageCode, string[]>>;
  promptProfile: string;
  conversationStyle: string[];
  promptProfileByLocale: Partial<Record<LocaleCode, string>>;
  conversationStyleByLocale: Partial<Record<LocaleCode, string[]>>;
}
