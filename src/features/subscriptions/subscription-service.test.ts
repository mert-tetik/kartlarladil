import { vi } from "vitest";
import {
  PLAN_LIMITS,
  checkLimit,
  getEffectivePlan,
  getUserEntitlements,
} from "@/features/subscriptions/subscription-service";
import type { SubscriptionStatus, UserSubscription } from "@/types/domain";

const mockSingle = vi.fn();
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mockSingle,
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    }),
  ),
}));

function makeSubscription(plan: string, status: SubscriptionStatus): UserSubscription {
  return {
    plan: plan as UserSubscription["plan"],
    status,
    customerPortalUrl: null,
    renewsAt: null,
    endsAt: null,
  };
}

describe("PLAN_LIMITS", () => {
  it("free plan has the advertised limits", () => {
    expect(PLAN_LIMITS.free).toEqual({
      activeCards: 20,
      learnedCards: 50,
      aiDailyMessages: 10,
      aiMonthlyMessages: 200,
    });
  });

  it("paid plans have unlimited cards and higher ai caps", () => {
    expect(PLAN_LIMITS.basic.activeCards).toBeNull();
    expect(PLAN_LIMITS.basic.learnedCards).toBeNull();
    expect(PLAN_LIMITS.basic.aiDailyMessages).toBe(30);
    expect(PLAN_LIMITS.basic.aiMonthlyMessages).toBe(900);

    expect(PLAN_LIMITS.pro.activeCards).toBeNull();
    expect(PLAN_LIMITS.pro.learnedCards).toBeNull();
    expect(PLAN_LIMITS.pro.aiDailyMessages).toBe(150);
    expect(PLAN_LIMITS.pro.aiMonthlyMessages).toBe(4500);
  });
});

describe("getEffectivePlan", () => {
  it.each([
    ["free", "active", "free"],
    ["basic", "active", "basic"],
    ["pro", "active", "pro"],
    ["pro", "cancelled", "free"],
    ["basic", "expired", "free"],
    ["pro", "on_trial", "pro"],
    ["basic", "past_due", "basic"],
  ] as const)("for plan %s with status %s returns %s", (plan, status, expected) => {
    expect(getEffectivePlan(makeSubscription(plan, status))).toBe(expected);
  });
});

describe("checkLimit", () => {
  it("returns the error code when the numeric limit is reached", () => {
    expect(checkLimit(20, 20, "free_active_card_limit")).toBe("free_active_card_limit");
  });

  it("returns null when under the limit", () => {
    expect(checkLimit(19, 20, "free_active_card_limit")).toBeNull();
  });

  it("returns null when the limit is unlimited", () => {
    expect(checkLimit(9999, null, "free_active_card_limit")).toBeNull();
  });
});

describe("getUserEntitlements", () => {
  it("returns free defaults when there is no subscription row", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getUserEntitlements("user-1");

    expect(result.plan).toBe("free");
    expect(result.effectivePlan).toBe("free");
    expect(result.status).toBe("free");
    expect(result.limits).toEqual(PLAN_LIMITS.free);
  });

  it("returns the paid plan when the subscription is active", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        plan: "pro",
        status: "active",
        customer_portal_url: "https://portal.example.com",
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: null,
      },
      error: null,
    });

    const result = await getUserEntitlements("user-2");

    expect(result.plan).toBe("pro");
    expect(result.effectivePlan).toBe("pro");
    expect(result.limits).toEqual(PLAN_LIMITS.pro);
    expect(result.customerPortalUrl).toBe("https://portal.example.com");
  });

  it("falls back to free limits for a cancelled paid plan", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        plan: "basic",
        status: "cancelled",
        customer_portal_url: null,
        renews_at: null,
        ends_at: "2026-06-01T00:00:00Z",
      },
      error: null,
    });

    const result = await getUserEntitlements("user-3");

    expect(result.plan).toBe("basic");
    expect(result.effectivePlan).toBe("free");
    expect(result.limits).toEqual(PLAN_LIMITS.free);
  });
});
