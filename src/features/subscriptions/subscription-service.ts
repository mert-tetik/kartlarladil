import "server-only";

import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  customer_portal_url: string | null;
  lemon_squeezy_customer_id?: string | null;
  lemon_squeezy_subscription_id?: string | null;
  renews_at: string | null;
  ends_at: string | null;
}

export interface UserSubscriptionManagementSource {
  effectivePlan: SubscriptionPlan;
  customerId: string | null;
  subscriptionId: string | null;
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

export async function getUserSubscriptionManagementSource(
  userId: string,
): Promise<UserSubscriptionManagementSource> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select(
      [
        "plan",
        "status",
        "customer_portal_url",
        "lemon_squeezy_customer_id",
        "lemon_squeezy_subscription_id",
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

  return {
    effectivePlan: getEffectivePlan(subscription),
    customerId: data?.lemon_squeezy_customer_id ?? null,
    subscriptionId: data?.lemon_squeezy_subscription_id ?? null,
  };
}

export function getEffectivePlan(subscription: UserSubscription): SubscriptionPlan {
  if (PAID_STATUSES.includes(subscription.status)) {
    return subscription.plan;
  }

  if (
    subscription.status === "cancelled" &&
    subscription.endsAt &&
    new Date(subscription.endsAt) > new Date()
  ) {
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
