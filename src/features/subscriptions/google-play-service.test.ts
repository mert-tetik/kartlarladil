import { vi } from "vitest";

vi.hoisted(() => {
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.LigidTools.Glidecore";
});

import {
  cancelGooglePlaySubscription,
  verifyGooglePlaySubscription,
  type GooglePlayPublisher,
} from "@/features/subscriptions/google-play-service";

const mockInsert = vi.hoisted(() => vi.fn());
const mockMaybeSingle = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockUpsert = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
      update: mockUpdate,
      upsert: mockUpsert,
    })),
  })),
}));

function makePublisher(
  overrides: {
    state?: string;
    productId?: string;
    expiryTime?: string;
    autoRenewEnabled?: boolean;
    recurringPrice?: { currencyCode: string; units: string; nanos?: number };
    acknowledgeError?: Error;
  } = {},
): GooglePlayPublisher {
  const get = vi.fn().mockResolvedValue({
    data: {
      subscriptionState: overrides.state ?? "SUBSCRIPTION_STATE_ACTIVE",
      latestOrderId: "GPA.1234",
      lineItems: [
        {
          productId: overrides.productId ?? "basic_monthly",
          expiryTime: overrides.expiryTime ?? "2030-07-01T00:00:00Z",
          autoRenewingPlan: {
            autoRenewEnabled: overrides.autoRenewEnabled ?? true,
            recurringPrice: overrides.recurringPrice,
          },
        },
      ],
    },
  });
  const acknowledge = overrides.acknowledgeError
    ? vi.fn().mockRejectedValue(overrides.acknowledgeError)
    : vi.fn().mockResolvedValue({});
  const cancel = vi.fn().mockResolvedValue({});

  return {
    purchases: {
      subscriptionsv2: { get, cancel },
      subscriptions: { acknowledge },
    },
  };
}

describe("verifyGooglePlaySubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({
      data: { user_id: "user-1" },
      error: null,
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("uses Google Play's v2 subscription state as the source of truth", async () => {
    const publisher = makePublisher();

    const result = await verifyGooglePlaySubscription(
      "token-1",
      "basic_monthly",
      "user-1",
      publisher,
    );

    expect(result).toMatchObject({
      plan: "basic",
      status: "active",
      provider: "google_play",
      endsAt: "2030-07-01T00:00:00.000Z",
    });
    expect(publisher.purchases.subscriptionsv2.get).toHaveBeenCalledWith({
      packageName: "com.LigidTools.Glidecore",
      token: "token-1",
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        google_play_purchase_token: "token-1",
        status: "active",
      }),
      { onConflict: "user_id" },
    );
  });

  it("persists a cancelled subscription with its remaining access date", async () => {
    const publisher = makePublisher({
      state: "SUBSCRIPTION_STATE_CANCELED",
      productId: "pro_yearly",
    });

    const result = await verifyGooglePlaySubscription(
      "token-2",
      "pro_yearly",
      "user-1",
      publisher,
    );

    expect(result).toMatchObject({ plan: "pro", status: "cancelled" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", status: "cancelled" }),
      { onConflict: "user_id" },
    );
  });

  it("stores the verified recurring price as monthly TRY revenue", async () => {
    const publisher = makePublisher({
      productId: "pro_yearly",
      recurringPrice: { currencyCode: "TRY", units: "1440" },
    });

    const result = await verifyGooglePlaySubscription(
      "token-revenue",
      "pro_yearly",
      "user-1",
      publisher,
    );

    expect(result).toMatchObject({
      billingCycle: "yearly",
      autoRenewEnabled: true,
      recurringPrice: { amount: 1440, currencyCode: "TRY" },
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        billing_cycle: "yearly",
        recurring_price_amount: 1440,
        recurring_price_currency: "TRY",
        recurring_monthly_try: 120,
        auto_renew_enabled: true,
      }),
      { onConflict: "user_id" },
    );
  });

  it("converts a non-TRY recurring price with the server-side rate", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ quote: "TRY", rate: 40 }]), {
        status: 200,
      }),
    );

    try {
      await verifyGooglePlaySubscription(
        "token-usd-revenue",
        "basic_monthly",
        "user-1",
        makePublisher({
          recurringPrice: { currencyCode: "USD", units: "3" },
        }),
      );

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.frankfurter.dev/v2/rates?base=USD&quotes=TRY",
        expect.any(Object),
      );
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ recurring_monthly_try: 120 }),
        { onConflict: "user_id" },
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("allows a verified Play purchase to be restored by another FoxiesDeck account", async () => {
    mockInsert.mockResolvedValue({ error: { code: "23505" } });

    await expect(
      verifyGooglePlaySubscription(
        "token-3",
        "basic_monthly",
        "user-1",
        makePublisher(),
      ),
    ).resolves.toMatchObject({ plan: "basic", status: "active" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_token: "token-3", user_id: "user-1" }),
      { onConflict: "purchase_token,user_id" },
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        google_play_purchase_token: "token-3",
      }),
      { onConflict: "user_id" },
    );
  });

  it("does not acknowledge an expired subscription", async () => {
    const publisher = makePublisher({ state: "SUBSCRIPTION_STATE_EXPIRED" });

    const result = await verifyGooglePlaySubscription(
      "token-4",
      "basic_monthly",
      "user-1",
      publisher,
    );

    expect(result.status).toBe("expired");
    expect(
      publisher.purchases.subscriptions.acknowledge,
    ).not.toHaveBeenCalled();
  });
});

describe("cancelGooglePlaySubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: {
        provider: "google_play",
        google_play_purchase_token: "purchase-token",
      },
      error: null,
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("cancels the store renewal and preserves the record for its remaining paid period", async () => {
    const publisher = makePublisher();

    await expect(
      cancelGooglePlaySubscription("user-1", publisher),
    ).resolves.toBe(true);

    expect(publisher.purchases.subscriptionsv2.cancel).toHaveBeenCalledWith({
      packageName: "com.LigidTools.Glidecore",
      token: "purchase-token",
      requestBody: {
        cancellationContext: {
          cancellationType: "USER_REQUESTED_STOP_RENEWALS",
        },
      },
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        auto_renew_enabled: false,
      }),
    );
  });

  it("does not treat a malformed Google Play record as a manual subscription", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { provider: "google_play", google_play_purchase_token: null },
      error: null,
    });

    await expect(
      cancelGooglePlaySubscription("user-1", makePublisher()),
    ).rejects.toThrow("missing its purchase token");
  });
});
