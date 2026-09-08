export interface DeveloperBudgetItem {
  id: string;
  serviceName: string;
  monthlyCostTry: number;
  serviceUrl: string;
  notes: string;
  billingDay: number | null;
  isActive: boolean;
  updatedAt: string;
}

export interface DeveloperDashboardStats {
  totalUsers: number;
  freeSubscribers: number;
  basicSubscribers: number;
  proSubscribers: number;
  activeCards: number;
  learnedCards: number;
  totalCards: number;
  monthlyRevenueTry: number;
  revenuePricedSubscribers: number;
  revenueUnpricedSubscribers: number;
}

export interface DeveloperUserSummary {
  id: string;
  email: string;
  displayName: string | null;
  preferredLanguage: string | null;
  preferredTier: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  phoneConfirmedAt: string | null;
  providers: string[];
  preferredUiLocale: string | null;
  theme: string | null;
  profilePictureIndex: number | null;
  leaderboardVisible: boolean;
  pushMarketingEnabled: boolean;
  plan: "free" | "basic" | "pro";
  status: string;
  provider: "google_play" | "admin" | null;
  endsAt: string | null;
  activeCards: number;
  learnedCards: number;
  totalCards: number;
  totalCorrectAnswers: number;
  totalAttempts: number;
  totalPoints: number;
  aiPracticePoints: number;
  chestPoints: number;
  streakPoints: number;
  missionPoints: number;
  quizResultPoints: number;
  gamePoints: number;
  gemPoints: number;
  blueGems: number;
  greenGems: number;
  purpleGems: number;
  billingCycle: string | null;
  recurringMonthlyTry: number | null;
  recurringPriceAmount: number | null;
  recurringPriceCurrency: string | null;
  subscriptionUpdatedAt: string | null;
  autoRenewEnabled: boolean;
  renewsAt: string | null;
  firstCardAddedAt: string | null;
  lastCardProgressAt: string | null;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
}

export interface DeveloperPointSource {
  key:
    | "learned_cards"
    | "ai_practice"
    | "chests"
    | "quiz_streaks"
    | "missions"
    | "quiz_results"
    | "games"
    | "gem_conversion";
  label: string;
  points: number;
  eventCount: number | null;
  lastEarnedAt: string | null;
}

export interface DeveloperUserDetail extends DeveloperUserSummary {
  auth: {
    emailConfirmedAt: string | null;
    phoneConfirmedAt: string | null;
    providers: string[];
  };
  profile: {
    preferredUiLocale: string | null;
    theme: string | null;
    profilePictureIndex: number | null;
    leaderboardVisible: boolean;
    pushMarketingEnabled: boolean;
    blueGems: number;
    greenGems: number;
    purpleGems: number;
  };
  subscription: {
    plan: string;
    status: string;
    provider: string | null;
    billingCycle: string | null;
    recurringPriceAmount: number | null;
    recurringPriceCurrency: string | null;
    recurringMonthlyTry: number | null;
    autoRenewEnabled: boolean;
    renewsAt: string | null;
    endsAt: string | null;
    updatedAt: string | null;
  } | null;
  cards: {
    total: number;
    active: number;
    learned: number;
    totalCorrect: number;
    firstAddedAt: string | null;
    lastProgressAt: string | null;
    byTier: Array<{ tier: string; total: number; learned: number; points: number }>;
  };
  activity: {
    totalAttempts: number;
    correctAttempts: number;
    incorrectAttempts: number;
    firstAttemptAt: string | null;
    lastAttemptAt: string | null;
  };
  pointSources: DeveloperPointSource[];
  totalPoints: number;
  rank: { id: string; label: string; minPoints: number };
}

export interface DeveloperUserPage {
  users: DeveloperUserSummary[];
  page: number;
  perPage: number;
  total: number;
}

export interface DeveloperCatalogCardMatch {
  sourceKey: string;
  term: string;
  translation: string;
  language: string;
  tier: string;
}

export interface DeveloperAuditLog {
  id: string;
  actorEmail: string;
  action: string;
  targetUserId: string | null;
  createdAt: string;
}

export interface DeveloperActionResult {
  ok: boolean;
  message: string;
}
