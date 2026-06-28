import { vi } from "vitest";

vi.hoisted(() => {
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.LigidTools.Glidecore";
});

import { verifyGooglePlaySubscription } from "@/features/subscriptions/google-play-service";

const mockUpsert = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        upsert: mockUpsert,
      })),
    }),
  ),
);

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

function makeMockPublisher(overrides?: {
  paymentState?: number;
  expiryTimeMillis?: string;
  orderId?: string;
  acknowledgeError?: Error;
}) {
  const get = vi.fn().mockResolvedValue({
    data: {
      paymentState: overrides?.paymentState ?? 1,
      expiryTimeMillis: overrides?.expiryTimeMillis ?? "1751328000000",
      orderId: overrides?.orderId ?? "GPA.1234",
    },
  });
  const acknowledge = overrides?.acknowledgeError
    ? vi.fn().mockRejectedValue(overrides.acknowledgeError)
    : vi.fn().mockResolvedValue({ data: {} });

  return {
    purchases: {
      subscriptions: {
        get,
        acknowledge,
      },
    },
  };
}

describe("verifyGooglePlaySubscription", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("resolves basic plan from basic_monthly sku", async () => {
    const publisher = makeMockPublisher();

    const result = await verifyGooglePlaySubscription("token-1", "basic_monthly", "user-1", publisher as never);

    expect(result.plan).toBe("basic");
    expect(result.status).toBe("active");
    expect(result.provider).toBe("google_play");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        plan: "basic",
        status: "active",
        provider: "google_play",
        google_play_purchase_token: "token-1",
        google_play_subscription_id: "basic_monthly",
        google_play_order_id: "GPA.1234",
      }),
      { onConflict: "user_id" },
    );
    expect(publisher.purchases.subscriptions.acknowledge).toHaveBeenCalledWith({
      packageName: "com.LigidTools.Glidecore",
      subscriptionId: "basic_monthly",
      token: "token-1",
    });
  });

  it("resolves pro plan from pro_yearly sku", async () => {
    const publisher = makeMockPublisher();

    const result = await verifyGooglePlaySubscription("token-2", "pro_yearly", "user-2", publisher as never);

    expect(result.plan).toBe("pro");
  });

  it("resolves basic plan from basic-monthly-first-month-free sku", async () => {
    const publisher = makeMockPublisher();

    const result = await verifyGooglePlaySubscription(
      "token-7",
      "basic-monthly-first-month-free",
      "user-7",
      publisher as never,
    );

    expect(result.plan).toBe("basic");
  });

  it("resolves pro plan from pro-monthly-one-month-free sku", async () => {
    const publisher = makeMockPublisher();

    const result = await verifyGooglePlaySubscription(
      "token-8",
      "pro-monthly-one-month-free",
      "user-8",
      publisher as never,
    );

    expect(result.plan).toBe("pro");
  });

  it("treats paymentState 2 as on_trial", async () => {
    const publisher = makeMockPublisher({ paymentState: 2 });

    const result = await verifyGooglePlaySubscription("token-3", "pro_monthly", "user-3", publisher as never);

    expect(result.status).toBe("on_trial");
  });

  it("throws for an unknown sku", async () => {
    const publisher = makeMockPublisher();

    await expect(
      verifyGooglePlaySubscription("token-4", "unknown_sku", "user-4", publisher as never),
    ).rejects.toThrow("Unknown Google Play subscription SKU");
  });

  it("throws when paymentState is not active", async () => {
    const publisher = makeMockPublisher({ paymentState: 0 });

    await expect(
      verifyGooglePlaySubscription("token-5", "basic_monthly", "user-5", publisher as never),
    ).rejects.toThrow("Google Play subscription is not active");
  });

  it("ignores already-acknowledged errors", async () => {
    const publisher = makeMockPublisher({
      acknowledgeError: new Error("Purchase has already been acknowledged"),
    });

    const result = await verifyGooglePlaySubscription("token-6", "basic_yearly", "user-6", publisher as never);

    expect(result.plan).toBe("basic");
  });
});
