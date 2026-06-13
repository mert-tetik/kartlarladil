import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  LimitErrorCode,
  PlanLimits,
  SubscriptionPlan,
  SubscriptionStatus,
  UserEntitlements,
  UserSubscription,
} from "@/types/domain";

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

const PAID_STATUSES: SubscriptionStatus[] = ["active", "on_trial", "past_due"];

interface UserSubscriptionRow {
  plan: string;
  status: string;
  customer_portal_url: string | null;
  renews_at: string | null;
  ends_at: string | null;
}

export async function getUserEntitlements(userId: string): Promise<UserEntitlements> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("plan, status, customer_portal_url, renews_at, ends_at")
    .eq("user_id", userId)
    .maybeSingle<UserSubscriptionRow>();

  if (error) {
    throw error;
  }

  const subscription = normalizeSubscription(data);
  const effectivePlan = getEffectivePlan(subscription);

  return {
    plan: subscription.plan,
    effectivePlan,
    status: subscription.status,
    limits: PLAN_LIMITS[effectivePlan],
    customerPortalUrl: subscription.customerPortalUrl,
  };
}

export function getEffectivePlan(subscription: UserSubscription): SubscriptionPlan {
  if (PAID_STATUSES.includes(subscription.status)) {
    return subscription.plan;
  }

  return "free";
}

export function checkLimit(
  current: number,
  max: number | null,
  errorCode: LimitErrorCode,
): LimitErrorCode | null {
  if (max !== null && current >= max) {
    return errorCode;
  }

  return null;
}

function normalizeSubscription(row: UserSubscriptionRow | null): UserSubscription {
  const plan = normalizeSubscriptionPlan(row?.plan);
  const status = normalizeSubscriptionStatus(row?.status);

  return {
    plan,
    status,
    customerPortalUrl: row?.customer_portal_url ?? null,
    renewsAt: row?.renews_at ?? null,
    endsAt: row?.ends_at ?? null,
  };
}

function normalizeSubscriptionPlan(value: string | null | undefined): SubscriptionPlan {
  if (value === "basic" || value === "pro") {
    return value;
  }

  return "free";
}

function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  const valid: SubscriptionStatus[] = [
    "free",
    "on_trial",
    "active",
    "paused",
    "past_due",
    "unpaid",
    "cancelled",
    "expired",
  ];

  if (valid.includes(value as SubscriptionStatus)) {
    return value as SubscriptionStatus;
  }

  return "free";
}
