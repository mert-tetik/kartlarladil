import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiUsageEventType, LimitErrorCode, SubscriptionPlan } from "@/types/domain";
import { PLAN_LIMITS } from "./subscription-service";

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
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("ai_usage_events").insert({
    user_id: userId,
    event_type: eventType,
    plan,
  });

  if (error) {
    throw error;
  }
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
