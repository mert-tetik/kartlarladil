import { vi } from "vitest";

vi.hoisted(() => {
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.LigidTools.Glidecore";
});

import {
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

function makePublisher(overrides: {
  state?: string;
  productId?: string;
  expiryTime?: string;
  acknowledgeError?: Error;
} = {}): GooglePlayPublisher {
  const get = vi.fn().mockResolvedValue({
    data: {
      subscriptionState: overrides.state ?? "SUBSCRIPTION_STATE_ACTIVE",
      latestOrderId: "GPA.1234",
      lineItems: [
        {
          productId: overrides.productId ?? "basic_monthly",
          expiryTime: overrides.expiryTime ?? "2030-07-01T00:00:00Z",
        },
      ],
    },
  });
  const acknowledge = overrides.acknowledgeError
    ? vi.fn().mockRejectedValue(overrides.acknowledgeError)
    : vi.fn().mockResolvedValue({});

  return {
    purchases: {
      subscriptionsv2: { get },
      subscriptions: { acknowledge },
    },
  };
}

describe("verifyGooglePlaySubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: { user_id: "user-1" }, error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })) });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("uses Google Play's v2 subscription state as the source of truth", async () => {
    const publisher = makePublisher();

    const result = await verifyGooglePlaySubscription("token-1", "basic_monthly", "user-1", publisher);

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
    const publisher = makePublisher({ state: "SUBSCRIPTION_STATE_CANCELED", productId: "pro_yearly" });

    const result = await verifyGooglePlaySubscription("token-2", "pro_yearly", "user-1", publisher);

    expect(result).toMatchObject({ plan: "pro", status: "cancelled" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro", status: "cancelled" }),
      { onConflict: "user_id" },
    );
  });

  it("allows a verified Play purchase to be restored by another FoxiesDeck account", async () => {
    mockInsert.mockResolvedValue({ error: { code: "23505" } });

    await expect(
      verifyGooglePlaySubscription("token-3", "basic_monthly", "user-1", makePublisher()),
    ).resolves.toMatchObject({ plan: "basic", status: "active" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ purchase_token: "token-3", user_id: "user-1" }),
      { onConflict: "purchase_token,user_id" },
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", google_play_purchase_token: "token-3" }),
      { onConflict: "user_id" },
    );
  });

  it("does not acknowledge an expired subscription", async () => {
    const publisher = makePublisher({ state: "SUBSCRIPTION_STATE_EXPIRED" });

    const result = await verifyGooglePlaySubscription("token-4", "basic_monthly", "user-1", publisher);

    expect(result.status).toBe("expired");
    expect(publisher.purchases.subscriptions.acknowledge).not.toHaveBeenCalled();
  });

});
