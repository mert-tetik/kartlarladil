import {
  createCheckoutAction,
  createCustomerPortalAction,
} from "@/features/subscriptions/subscription-actions";
import { vi } from "vitest";

const mockCreateCheckoutUrl = vi.hoisted(() => vi.fn());
const mockFetchSubscription = vi.hoisted(() => vi.fn());
const mockGetVariantIdForPlan = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const mockGetUserSubscriptionManagementSource = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockGetRequestOrigin = vi.hoisted(() => vi.fn());

vi.mock("@/features/subscriptions/lemon-squeezy", () => ({
  createCheckoutUrl: mockCreateCheckoutUrl,
  fetchSubscription: mockFetchSubscription,
  getVariantIdForPlan: mockGetVariantIdForPlan,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
  getUserSubscriptionManagementSource: mockGetUserSubscriptionManagementSource,
}));

vi.mock("@/features/auth/auth-session", () => ({
  getRequestOrigin: mockGetRequestOrigin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    }),
  ),
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(() => Promise.resolve("en")),
}));

function makeFormData(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

describe("subscription actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null,
    });
    mockGetRequestOrigin.mockResolvedValue("https://foxiesdeck.test");
    mockGetVariantIdForPlan.mockReturnValue("variant-basic-monthly");
    mockCreateCheckoutUrl.mockResolvedValue("https://checkout.example.com");
  });

  it("creates a checkout URL for a free user", async () => {
    mockGetUserEntitlements.mockResolvedValue({
      plan: "free",
      effectivePlan: "free",
      status: "free",
      provider: "lemon_squeezy",
      limits: {
        activeCards: 20,
        learnedCards: 50,
        aiDailyMessages: 10,
        aiMonthlyMessages: 200,
      },
      customerPortalUrl: null,
    });

    const result = await createCheckoutAction(
      { status: "idle", message: "" },
      makeFormData({ plan: "basic", cycle: "monthly" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "",
      checkoutUrl: "https://checkout.example.com",
    });
    expect(mockCreateCheckoutUrl).toHaveBeenCalledWith({
      userId: "user-1",
      email: "test@example.com",
      variantId: "variant-basic-monthly",
      returnUrl: "https://foxiesdeck.test/pricing?checkout=success",
    });
  });

  it("returns a fresh customer portal URL for an existing paid user instead of creating checkout", async () => {
    mockGetUserEntitlements.mockResolvedValue({
      plan: "pro",
      effectivePlan: "pro",
      status: "active",
      provider: "lemon_squeezy",
      limits: {
        activeCards: null,
        learnedCards: null,
        aiDailyMessages: 150,
        aiMonthlyMessages: 4500,
      },
      customerPortalUrl: null,
    });
    mockGetUserSubscriptionManagementSource.mockResolvedValue({
      effectivePlan: "pro",
      provider: "lemon_squeezy",
      subscriptionId: "sub_1",
      customerId: "customer_1",
      managementUrl: null,
    });
    mockFetchSubscription.mockResolvedValue({
      id: "sub_1",
      attributes: {
        urls: {
          customer_portal: "https://fresh-portal.example.com",
        },
      },
    });

    const result = await createCheckoutAction(
      { status: "idle", message: "" },
      makeFormData({ plan: "pro", cycle: "yearly" }),
    );

    expect(result).toEqual({
      status: "success",
      message: "",
      customerPortalUrl: "https://fresh-portal.example.com",
    });
    expect(mockCreateCheckoutUrl).not.toHaveBeenCalled();
  });

  it("creates a fresh customer portal URL on demand", async () => {
    mockGetUserSubscriptionManagementSource.mockResolvedValue({
      effectivePlan: "basic",
      provider: "lemon_squeezy",
      subscriptionId: "sub_2",
      customerId: "customer_2",
      managementUrl: null,
    });
    mockFetchSubscription.mockResolvedValue({
      id: "sub_2",
      attributes: {
        urls: {
          customer_portal: "https://fresh-portal.example.com",
        },
      },
    });

    const result = await createCustomerPortalAction({ status: "idle", message: "" });

    expect(result).toEqual({
      status: "success",
      message: "",
      customerPortalUrl: "https://fresh-portal.example.com",
    });
  });

  it("returns the Google Play subscriptions page on demand", async () => {
    mockGetUserSubscriptionManagementSource.mockResolvedValue({
      effectivePlan: "basic",
      provider: "google_play",
      subscriptionId: null,
      customerId: null,
      managementUrl: "https://play.google.com/store/account/subscriptions",
    });

    const result = await createCustomerPortalAction({ status: "idle", message: "" });

    expect(result).toEqual({
      status: "success",
      message: "",
      customerPortalUrl: "https://play.google.com/store/account/subscriptions",
    });
    expect(mockFetchSubscription).not.toHaveBeenCalled();
  });

  it("returns an error when a paid portal URL cannot be refreshed", async () => {
    mockGetUserSubscriptionManagementSource.mockResolvedValue({
      effectivePlan: "pro",
      provider: "lemon_squeezy",
      subscriptionId: null,
      customerId: "customer_1",
      managementUrl: null,
    });

    const result = await createCustomerPortalAction({ status: "idle", message: "" });

    expect(result.status).toBe("error");
    expect(mockFetchSubscription).not.toHaveBeenCalled();
  });
});
