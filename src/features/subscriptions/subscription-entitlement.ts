import type { UserEntitlements } from "@/types/domain";

export function hasUsableRemainingAccess(
  endsAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (typeof endsAt !== "string" || endsAt.length === 0) return false;

  const endTime = new Date(endsAt).getTime();
  return Number.isFinite(endTime) && endTime > now;
}

export function isUsableEntitlementsSnapshot(
  value: unknown,
  now = Date.now(),
): value is UserEntitlements {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<UserEntitlements>;
  if (
    !isSubscriptionPlan(snapshot.plan)
    || !isSubscriptionPlan(snapshot.effectivePlan)
    || !isSubscriptionStatus(snapshot.status)
    || (snapshot.provider !== "google_play" && snapshot.provider !== "admin")
    || !snapshot.limits
    || typeof snapshot.limits !== "object"
    || !(snapshot.customerPortalUrl === null || typeof snapshot.customerPortalUrl === "string")
    || !(snapshot.endsAt === null || typeof snapshot.endsAt === "string")
  ) {
    return false;
  }

  const { activeCards, learnedCards, aiDailyMessages, aiMonthlyMessages } = snapshot.limits;
  if (
    !isNullableLimit(activeCards)
    || !isNullableLimit(learnedCards)
    || !isNullableLimit(aiDailyMessages)
    || !isNullableLimit(aiMonthlyMessages)
  ) {
    return false;
  }

  const effectivePlan = snapshot.effectivePlan;
  if (effectivePlan === "free") return true;

  return hasUsableRemainingAccess(snapshot.endsAt, now);
}

function isSubscriptionPlan(value: unknown): value is UserEntitlements["plan"] {
  return value === "free" || value === "basic" || value === "pro";
}

function isSubscriptionStatus(value: unknown): value is UserEntitlements["status"] {
  return value === "free"
    || value === "on_trial"
    || value === "active"
    || value === "paused"
    || value === "past_due"
    || value === "unpaid"
    || value === "cancelled"
    || value === "expired";
}

function isNullableLimit(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}
