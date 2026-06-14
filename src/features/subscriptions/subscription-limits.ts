import type { PlanLimits, SubscriptionPlan } from "@/types/domain";

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    activeCards: 20,
    learnedCards: 50,
    aiDailyMessages: 10,
    aiMonthlyMessages: 200,
  },
  basic: {
    activeCards: null,
    learnedCards: null,
    aiDailyMessages: 30,
    aiMonthlyMessages: 900,
  },
  pro: {
    activeCards: null,
    learnedCards: null,
    aiDailyMessages: 150,
    aiMonthlyMessages: 4500,
  },
};
