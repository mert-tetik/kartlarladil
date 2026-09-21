import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AiUsageEventType, LimitErrorCode, SubscriptionPlan } from "@/types/domain";
import { getAiFeatureLimit, PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";

export async function assertCanUseAi(
  userId: string,
  plan: SubscriptionPlan,
  eventType: AiUsageEventType = "chat",
): Promise<LimitErrorCode | null> {
  const limits = getAiFeatureLimit(plan, eventType);
  if (limits.daily === null && limits.monthly === null) return null;

  const [dailyCount, monthlyCount] = await Promise.all([
    countAiUsage(userId, "day", eventType),
    countAiUsage(userId, "month", eventType),
  ]);

  if (limits.daily !== null && dailyCount >= limits.daily) {
    return "ai_daily_limit";
  }

  if (limits.monthly !== null && monthlyCount >= limits.monthly) {
    return "ai_monthly_limit";
  }

  return null;
}

export async function recordAiUsageEvent(
  userId: string,
  _plan: SubscriptionPlan,
  eventType: AiUsageEventType,
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("record_ai_usage_if_within_limit", {
    p_user_id: userId,
    p_event_type: eventType,
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
  _plan: SubscriptionPlan,
  eventType: AiUsageEventType,
): Promise<LimitErrorCode | null> {
  const supabase = createSupabaseAdminClient();

  const { data: result, error } = await supabase.rpc("record_ai_usage_if_within_limit", {
    p_user_id: userId,
    p_event_type: eventType,
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

export async function consumeImageTextTranslation(userId: string): Promise<LimitErrorCode | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("record_image_text_translation_if_available", {
    p_user_id: userId,
  });

  if (error) throw error;
  return data === "feature_limit" ? "image_text_translate_limit" : null;
}

export async function getImageTextTranslationUsage(
  userId: string,
  plan: SubscriptionPlan,
): Promise<{ used: number; limit: number | null; remaining: number | null; canUse: boolean }> {
  const limit = PLAN_LIMITS[plan].imageTextTranslations ?? null;
  if (limit === null) {
    return { used: 0, limit: null, remaining: null, canUse: true };
  }

  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "image_text_translate");

  if (error) throw error;
  const used = count ?? 0;
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    canUse: used < limit,
  };
}

async function countAiUsage(
  userId: string,
  period: "day" | "month",
  eventType: AiUsageEventType,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const since = period === "day" ? getDayStartIso() : getMonthStartIso();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", eventType)
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
