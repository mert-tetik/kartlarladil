import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiUsageEventType, LimitErrorCode, SubscriptionPlan } from "@/types/domain";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";

export async function assertCanUseAi(
  userId: string,
  plan: SubscriptionPlan,
): Promise<LimitErrorCode | null> {
  const limits = PLAN_LIMITS[plan];
  const [dailyCount, monthlyCount] = await Promise.all([
    countAiUsage(userId, "day"),
    countAiUsage(userId, "month"),
  ]);

  if (dailyCount >= limits.aiDailyMessages) {
    return "ai_daily_limit";
  }

  if (monthlyCount >= limits.aiMonthlyMessages) {
    return "ai_monthly_limit";
  }

  return null;
}

export async function recordAiUsageEvent(
  userId: string,
  plan: SubscriptionPlan,
  eventType: AiUsageEventType,
): Promise<void> {
  const limits = PLAN_LIMITS[plan];
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("record_ai_usage_if_within_limit", {
    p_user_id: userId,
    p_event_type: eventType,
    p_plan: plan,
    p_daily_limit: limits.aiDailyMessages,
    p_monthly_limit: limits.aiMonthlyMessages,
  });

  if (error) {
    throw error;
  }

  if (data === "daily_limit") {
    throw new Error("AI daily limit exceeded");
  }

  if (data === "monthly_limit") {
    throw new Error("AI monthly limit exceeded");
  }
}

export async function assertAndRecordAiUsage(
  userId: string,
  plan: SubscriptionPlan,
  eventType: AiUsageEventType,
): Promise<LimitErrorCode | null> {
  const limits = PLAN_LIMITS[plan];
  const supabase = await createSupabaseServerClient();

  const { data: result, error } = await supabase.rpc("record_ai_usage_if_within_limit", {
    p_user_id: userId,
    p_event_type: eventType,
    p_plan: plan,
    p_daily_limit: limits.aiDailyMessages,
    p_monthly_limit: limits.aiMonthlyMessages,
  });

  if (error) {
    throw error;
  }

  if (result === "daily_limit") {
    return "ai_daily_limit";
  }

  if (result === "monthly_limit") {
    return "ai_monthly_limit";
  }

  return null;
}

async function countAiUsage(
  userId: string,
  period: "day" | "month",
): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const since = period === "day" ? getDayStartIso() : getMonthStartIso();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function getDayStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function getMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
