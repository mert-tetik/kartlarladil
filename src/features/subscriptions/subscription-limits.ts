import type { PlanLimits, SubscriptionPlan } from "@/types/domain";

const LIMITED_AI_FEATURES = {
  chat: { daily: 10, monthly: 200 },
  translate: { daily: 10, monthly: 200 },
  ask: { daily: 10, monthly: 200 },
} as const;

const BASIC_LIMITED_AI_FEATURES = {
  chat: { daily: 30, monthly: 900 },
  translate: { daily: 30, monthly: 900 },
  ask: { daily: 30, monthly: 900 },
} as const;

const UNLIMITED_AI_FEATURES = {
  chat: { daily: null, monthly: null },
  translate: { daily: null, monthly: null },
  ask: { daily: null, monthly: null },
  create_card: { daily: null, monthly: null },
  quiz_validate: { daily: null, monthly: null },
  image_text_translate: { daily: null, monthly: null },
} as const;

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    activeCards: 20,
    learnedCards: 100,
    aiDailyMessages: 10,
    aiMonthlyMessages: 200,
    aiFeatureLimits: {
      ...LIMITED_AI_FEATURES,
      create_card: { daily: null, monthly: null },
      quiz_validate: { daily: null, monthly: null },
      image_text_translate: { daily: null, monthly: null },
    },
    imageTextTranslations: 2,
  },
  basic: {
    activeCards: null,
    learnedCards: null,
    aiDailyMessages: 30,
    aiMonthlyMessages: 900,
    aiFeatureLimits: {
      ...BASIC_LIMITED_AI_FEATURES,
      create_card: { daily: null, monthly: null },
      quiz_validate: { daily: null, monthly: null },
      image_text_translate: { daily: null, monthly: null },
    },
    imageTextTranslations: 2,
  },
  pro: {
    activeCards: null,
    learnedCards: null,
    aiDailyMessages: null,
    aiMonthlyMessages: null,
    aiFeatureLimits: UNLIMITED_AI_FEATURES,
    imageTextTranslations: null,
  },
};

export function getAiFeatureLimit(
  plan: SubscriptionPlan,
  eventType: keyof NonNullable<PlanLimits["aiFeatureLimits"]>,
) {
  const limits = PLAN_LIMITS[plan].aiFeatureLimits?.[eventType];
  return limits ?? {
    daily: PLAN_LIMITS[plan].aiDailyMessages,
    monthly: PLAN_LIMITS[plan].aiMonthlyMessages,
  };
}
