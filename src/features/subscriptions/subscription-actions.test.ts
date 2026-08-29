import { vi } from "vitest";
import {
  createCustomerPortalAction,
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
        aiDailyMessages: 150,
        aiMonthlyMessages: 4500,
      },
      customerPortalUrl: null,
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
});
