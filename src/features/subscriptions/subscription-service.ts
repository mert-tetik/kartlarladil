import "server-only";

import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  LimitErrorCode,
  SubscriptionPlan,
  SubscriptionStatus,
  UserEntitlements,
  UserSubscription,
} from "@/types/domain";

const PAID_STATUSES: SubscriptionStatus[] = ["active", "on_trial", "past_due"];

interface UserSubscriptionRow {
  plan: string;
  status: string;
  provider: string | null;
  display_name?: string | null;
  customer_portal_url: string | null;
  google_play_purchase_token: string | null;
  google_play_subscription_id: string | null;
  google_play_order_id: string | null;
  renews_at: string | null;
  ends_at: string | null;
}

export async function getUserEntitlements(userId: string): Promise<UserEntitlements> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select(
      [
        "plan",
        "status",
        "provider",
        "customer_portal_url",
        "google_play_purchase_token",
        "google_play_subscription_id",
        "google_play_order_id",
        "renews_at",
        "ends_at",
      ].join(", "),
    )
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
    provider: subscription.provider,
    limits: PLAN_LIMITS[effectivePlan],
    customerPortalUrl: subscription.customerPortalUrl,
  };
}

export function getEffectivePlan(subscription: UserSubscription): SubscriptionPlan {
  if (!hasUsableRemainingAccess(subscription.endsAt)) {
    return "free";
  }

  if (PAID_STATUSES.includes(subscription.status)) {
    return subscription.plan;
  }

  if (
    subscription.status === "cancelled" &&
    subscription.endsAt
  ) {
    return subscription.plan;
  }

  return "free";
}

function hasUsableRemainingAccess(endsAt: string | null): boolean {
  if (!endsAt) {
    return true;
  }

  const endTime = new Date(endsAt).getTime();
  return Number.isFinite(endTime) && endTime > Date.now();
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
  const isGooglePlaySubscription = row?.provider === "google_play";
  const plan = isGooglePlaySubscription ? normalizeSubscriptionPlan(row?.plan) : "free";
  const status = isGooglePlaySubscription ? normalizeSubscriptionStatus(row?.status) : "free";

  return {
    plan,
    status,
    provider: "google_play",
    displayName: row?.display_name ?? null,
    customerPortalUrl: row?.customer_portal_url ?? null,
    googlePlayPurchaseToken: row?.google_play_purchase_token ?? null,
    googlePlaySubscriptionId: row?.google_play_subscription_id ?? null,
    googlePlayOrderId: row?.google_play_order_id ?? null,
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
