import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AiUsageEventType, LimitErrorCode, SubscriptionPlan } from "@/types/domain";
import { getAiFeatureLimit, PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { throwSubscriptionGateUnavailable } from "@/features/subscriptions/subscription-gate-errors";

const SHARED_AI_USAGE_EVENT_TYPES = ["chat", "translate", "ask"] as const;

export async function assertCanUseAi(
  userId: string,
  plan: SubscriptionPlan,
  eventType: AiUsageEventType = "chat",
): Promise<LimitErrorCode | null> {
  const limits = getAiFeatureLimit(plan, eventType);
  if (limits.daily === null && limits.monthly === null) return null;

  const countedEventTypes = SHARED_AI_USAGE_EVENT_TYPES.includes(
    eventType as (typeof SHARED_AI_USAGE_EVENT_TYPES)[number],
  )
    ? SHARED_AI_USAGE_EVENT_TYPES
    : [eventType];

  const [dailyCount, monthlyCount] = await Promise.all([
    countAiUsage(userId, "day", countedEventTypes),
    countAiUsage(userId, "month", countedEventTypes),
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
    throwSubscriptionGateUnavailable("ai_usage", error);
  }

  if (data === "daily_limit") {
    throw new Error("AI daily limit exceeded");
  }

  if (data === "monthly_limit") {
    throw new Error("AI monthly limit exceeded");
  }

  if (data !== "ok") {
    throw new Error("unexpected_ai_usage_result");
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
    throwSubscriptionGateUnavailable("ai_usage", error);
  }

  if (result === "daily_limit") {
    return "ai_daily_limit";
  }

  if (result === "monthly_limit") {
    return "ai_monthly_limit";
  }

  if (result === "ok") return null;
  throw new Error("unexpected_ai_usage_result");
}

export type ImageTextTranslationReservation =
  | { status: "reserved"; reservationId: string }
  | { status: "limit" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function reserveImageTextTranslation(
  userId: string,
): Promise<ImageTextTranslationReservation> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("reserve_image_text_translation", {
    p_user_id: userId,
  });

  if (error) throwSubscriptionGateUnavailable("image_translation_quota", error);
  if (data === "feature_limit") return { status: "limit" };
  if (typeof data !== "string" || !UUID_PATTERN.test(data)) {
    throw new Error("unexpected_image_text_translation_reservation_result");
  }
  return { status: "reserved", reservationId: data };
}

export async function completeImageTextTranslation(
  userId: string,
  reservationId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("complete_image_text_translation", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });

  if (error) throwSubscriptionGateUnavailable("image_translation_quota", error);
  if (data !== "ok") throw new Error("unexpected_image_text_translation_completion_result");
}

export async function releaseImageTextTranslation(
  userId: string,
  reservationId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("release_image_text_translation", {
    p_user_id: userId,
    p_reservation_id: reservationId,
  });

  if (error) throwSubscriptionGateUnavailable("image_translation_quota", error);
  if (data !== "ok") throw new Error("unexpected_image_text_translation_release_result");
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

  if (error) throwSubscriptionGateUnavailable("image_translation_quota", error);
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
  eventTypes: readonly AiUsageEventType[],
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const since = period === "day" ? getDayStartIso() : getMonthStartIso();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("event_type", [...eventTypes])
    .gte("created_at", since);

  if (error) {
    throwSubscriptionGateUnavailable("ai_usage", error);
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
