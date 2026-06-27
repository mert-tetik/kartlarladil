import { vi } from "vitest";
import {
  checkLimit,
  getEffectivePlan,
  getUserEntitlements,
  getUserSubscriptionManagementSource,
} from "@/features/subscriptions/subscription-service";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
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

function makeSubscription(
  plan: string,
  status: SubscriptionStatus,
  endsAt: string | null = null,
): UserSubscription {
  return {
    plan: plan as UserSubscription["plan"],
    status,
    provider: "lemon_squeezy",
    customerPortalUrl: null,
    googlePlayPurchaseToken: null,
    googlePlaySubscriptionId: null,
    googlePlayOrderId: null,
    renewsAt: null,
    endsAt,
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
    ["free", "active", null, "free"],
    ["basic", "active", null, "basic"],
    ["pro", "active", null, "pro"],
    ["pro", "cancelled", null, "free"],
    ["pro", "cancelled", "2000-01-01T00:00:00Z", "free"],
    ["basic", "cancelled", "2099-12-31T23:59:59Z", "basic"],
    ["basic", "expired", null, "free"],
    ["pro", "on_trial", null, "pro"],
    ["basic", "past_due", null, "basic"],
  ] as const)("for plan %s with status %s and endsAt %s returns %s", (plan, status, endsAt, expected) => {
    expect(getEffectivePlan(makeSubscription(plan, status, endsAt))).toBe(expected);
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

describe("getUserSubscriptionManagementSource", () => {
  it("returns the effective plan and Lemon identifiers for a paid subscription", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        plan: "pro",
        status: "active",
        customer_portal_url: "https://stale.example.com",
        lemon_squeezy_customer_id: "customer-1",
        lemon_squeezy_subscription_id: "subscription-1",
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: null,
      },
      error: null,
    });

    const result = await getUserSubscriptionManagementSource("user-4");

    expect(result).toEqual({
      effectivePlan: "pro",
      provider: "lemon_squeezy",
      customerId: "customer-1",
      subscriptionId: "subscription-1",
      managementUrl: null,
    });
  });

  it("returns the Google Play subscriptions page for an active Google Play subscription", async () => {
    process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.LigidTools.Glidecore";
    mockSingle.mockResolvedValueOnce({
      data: {
        plan: "basic",
        status: "active",
        provider: "google_play",
        customer_portal_url: null,
        google_play_subscription_id: "basic_monthly",
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: null,
      },
      error: null,
    });

    const result = await getUserSubscriptionManagementSource("user-5");

    expect(result).toEqual({
      effectivePlan: "basic",
      provider: "google_play",
      customerId: null,
      subscriptionId: "basic_monthly",
      managementUrl: "https://play.google.com/store/account/subscriptions",
    });
  });

  it("returns the Google Play subscriptions page even when no product id was stored", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        plan: "basic",
        status: "active",
        provider: "google_play",
        customer_portal_url: null,
        google_play_subscription_id: null,
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: null,
      },
      error: null,
    });

    const result = await getUserSubscriptionManagementSource("user-5");

    expect(result).toEqual({
      effectivePlan: "basic",
      provider: "google_play",
      customerId: null,
      subscriptionId: null,
      managementUrl: "https://play.google.com/store/account/subscriptions",
    });
  });
});
