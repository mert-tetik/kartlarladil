import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";

const mocks = vi.hoisted(() => ({
  verifyGooglePlayPurchaseAction: vi.fn(),
  syncGooglePlayPurchasesAction: vi.fn(),
  applyVerifiedEntitlements: vi.fn(),
  sendTwaSubscriptionPurchaseEvent: vi.fn(),
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock("@/features/subscriptions/subscription-actions", () => ({
  verifyGooglePlayPurchaseAction: mocks.verifyGooglePlayPurchaseAction,
  syncGooglePlayPurchasesAction: mocks.syncGooglePlayPurchasesAction,
}));

vi.mock("@/features/subscriptions/subscription-client", () => ({
  useSubscription: () => ({
    applyVerifiedEntitlements: mocks.applyVerifiedEntitlements,
  }),
}));

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaSubscriptionPurchaseEvent: mocks.sendTwaSubscriptionPurchaseEvent,
}));

vi.mock("@/lib/analytics-events", () => ({
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}));

describe("useGooglePlayBilling Meta purchase telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.FoxiesDeckNativeBilling = {
      getDetails: vi.fn(() => JSON.stringify([{
        itemId: "pro_yearly",
        title: "Pro yearly",
        price: { value: "90.00", currency: "USD" },
      }])),
      listPurchases: vi.fn(() => "[]"),
      purchase: vi.fn(() => JSON.stringify({
        status: "success",
        itemId: "pro_yearly",
        purchaseToken: "purchase-token-for-test",
      })),
    };
    mocks.verifyGooglePlayPurchaseAction.mockResolvedValue({
      status: "success",
      data: { plan: "pro", effectivePlan: "pro" },
    });
  });

  afterEach(() => {
    delete window.FoxiesDeckNativeBilling;
  });

  it("emits the Meta purchase event only after native purchase verification succeeds", async () => {
    const { result } = renderHook(() => useGooglePlayBilling());

    await act(async () => {
      await result.current.purchase("pro_yearly", { source: "pricing" });
    });

    expect(mocks.verifyGooglePlayPurchaseAction).toHaveBeenCalledWith(
      "purchase-token-for-test",
      "pro_yearly",
    );
    expect(mocks.applyVerifiedEntitlements).toHaveBeenCalledOnce();
    expect(mocks.sendTwaSubscriptionPurchaseEvent).toHaveBeenCalledWith(
      "pro_yearly",
      { value: "90.00", currency: "USD" },
    );
    expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith(
      "subscription_purchase_started",
      { sku: "pro_yearly", plan: "pro", billing_cycle: "yearly", source: "pricing" },
    );
    expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith(
      "subscription_purchase_succeeded",
      { sku: "pro_yearly", plan: "pro", billing_cycle: "yearly", source: "pricing", effective_plan: "pro" },
    );
  });

  it("does not emit a purchase event when verification fails", async () => {
    mocks.verifyGooglePlayPurchaseAction.mockResolvedValueOnce({
      status: "error",
      message: "verification failed",
    });
    const { result } = renderHook(() => useGooglePlayBilling());

    await expect(act(async () => {
      await result.current.purchase("pro_yearly");
    })).rejects.toThrow("verification failed");

    expect(mocks.sendTwaSubscriptionPurchaseEvent).not.toHaveBeenCalled();
    expect(mocks.trackAnalyticsEvent).toHaveBeenCalledWith(
      "subscription_purchase_failed",
      { sku: "pro_yearly", plan: "pro", billing_cycle: "yearly", error_code: "purchase_failed" },
    );
  });
});
