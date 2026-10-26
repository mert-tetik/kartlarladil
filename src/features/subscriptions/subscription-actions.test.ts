import { vi } from "vitest";
import {
  createCustomerPortalAction,
  syncGooglePlayPurchasesAction,
  verifyGooglePlayPurchaseAction,
} from "@/features/subscriptions/subscription-actions";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const mockVerifyGooglePlaySubscription = vi.hoisted(() => vi.fn());

vi.mock("@/features/subscriptions/google-play-service", () => ({
  verifyGooglePlaySubscription: mockVerifyGooglePlaySubscription,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(() => Promise.resolve("en")),
}));

vi.mock("@/i18n/dictionaries", () => ({
  createTranslator: vi.fn(() => (key: string) => key),
}));

describe("Google Play subscription actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetUserEntitlements.mockResolvedValue({
      plan: "pro",
      effectivePlan: "pro",
      status: "active",
      provider: "google_play",
      limits: {
        activeCards: null,
        learnedCards: null,
        aiDailyMessages: null,
        aiMonthlyMessages: null,
      },
      customerPortalUrl: null,
    });
    mockVerifyGooglePlaySubscription.mockResolvedValue({
      plan: "basic",
      status: "active",
      endsAt: "2030-07-01T00:00:00.000Z",
    });
  });

  it("returns the Google Play subscriptions page for paid users", async () => {
    const result = await createCustomerPortalAction({ status: "idle", message: "" });

    expect(result).toEqual({
      status: "success",
      message: "",
      customerPortalUrl: "https://play.google.com/store/account/subscriptions",
    });
  });

  it("does not expose a management link for free users", async () => {
    mockGetUserEntitlements.mockResolvedValueOnce({
      ...await mockGetUserEntitlements(),
      effectivePlan: "free",
    });

    const result = await createCustomerPortalAction({ status: "idle", message: "" });

    expect(result.status).toBe("error");
    expect(result.message).toBe("pricing.error.customerPortalUnavailable");
  });

  it("verifies a purchase for the authenticated FoxiesDeck account", async () => {
    const result = await verifyGooglePlayPurchaseAction("purchase-token", "basic_monthly");

    expect(mockVerifyGooglePlaySubscription).toHaveBeenCalledWith(
      "purchase-token",
      "basic_monthly",
      "user-1",
    );
    expect(result.status).toBe("success");
    expect(result.data?.provider).toBe("google_play");
  });

  it("does not report an inactive Play purchase as a successful checkout", async () => {
    mockVerifyGooglePlaySubscription.mockResolvedValueOnce({
      plan: "basic",
      status: "unpaid",
      endsAt: "2030-07-01T00:00:00.000Z",
    });
    const freeEntitlements = {
      plan: "free",
      effectivePlan: "free",
      status: "unpaid",
      provider: "google_play",
      limits: {
        activeCards: 20,
        learnedCards: 100,
        aiDailyMessages: 10,
        aiMonthlyMessages: 200,
      },
      customerPortalUrl: null,
      endsAt: "2030-07-01T00:00:00.000Z",
    };
    mockGetUserEntitlements.mockResolvedValueOnce(freeEntitlements);

    const result = await verifyGooglePlayPurchaseAction("pending-token", "basic_monthly");

    expect(result).toEqual({
      status: "inactive",
      message: "pricing.error.purchaseNotActive",
      data: freeEntitlements,
    });
    expect(mockGetUserEntitlements).toHaveBeenCalledOnce();
  });

  it("rejects oversized purchase-restore batches before calling Google", async () => {
    const purchases = Array.from({ length: 21 }, (_, index) => ({
      purchaseToken: `purchase-token-${index}`,
      productId: "basic_monthly",
    }));

    const result = await syncGooglePlayPurchasesAction(purchases);

    expect(result.status).toBe("error");
    expect(mockVerifyGooglePlaySubscription).not.toHaveBeenCalled();
    expect(mockGetUserEntitlements).not.toHaveBeenCalled();
  });

  it("verifies duplicate restore tokens only once", async () => {
    const result = await syncGooglePlayPurchasesAction([
      { purchaseToken: "purchase-token", productId: "basic_monthly" },
      { purchaseToken: "purchase-token", productId: "basic_monthly" },
    ]);

    expect(result.status).toBe("success");
    expect(mockVerifyGooglePlaySubscription).toHaveBeenCalledOnce();
    expect(mockVerifyGooglePlaySubscription).toHaveBeenCalledWith(
      "purchase-token",
      "basic_monthly",
      "user-1",
    );
  });

  it("rejects one token claimed for conflicting products", async () => {
    const result = await syncGooglePlayPurchasesAction([
      { purchaseToken: "purchase-token", productId: "basic_monthly" },
      { purchaseToken: "purchase-token", productId: "pro_yearly" },
    ]);

    expect(result.status).toBe("error");
    expect(mockVerifyGooglePlaySubscription).not.toHaveBeenCalled();
  });
});
