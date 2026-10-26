import { vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.GOOGLE_PLAY_PACKAGE_NAME = "com.foxiesdeck.app";
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON = "{}";

  return {
    databaseInsert: vi.fn(),
    databaseOwnerLookup: vi.fn(),
    databaseEventLookup: vi.fn(),
    databaseSubscriptionLookup: vi.fn(),
    databaseUpdate: vi.fn(),
    databaseUpsert: vi.fn(),
    publisherGet: vi.fn(),
    publisherAcknowledge: vi.fn(),
    googleVerifyIdToken: vi.fn(),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => ({
      insert: (values: unknown) => mocks.databaseInsert(table, values),
      select: () => ({
        eq: (_column: string, value: string) => {
          if (table === "google_play_purchase_accounts") {
            return mocks.databaseOwnerLookup(value);
          }

          if (table === "user_subscriptions") {
            return { maybeSingle: () => mocks.databaseSubscriptionLookup(value) };
          }

          return {
            maybeSingle: () => mocks.databaseEventLookup(value),
          };
        },
      }),
      update: (values: unknown) => ({
        eq: (_column: string, value: string) => mocks.databaseUpdate(table, values, value),
      }),
      upsert: (values: unknown, options: unknown) => mocks.databaseUpsert(table, values, options),
    }),
  })),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: class {},
      OAuth2: class {
        verifyIdToken = mocks.googleVerifyIdToken;
      },
    },
    androidpublisher: vi.fn(() => ({
      purchases: {
        subscriptionsv2: {
          get: mocks.publisherGet,
          cancel: vi.fn(),
        },
        subscriptions: {
          acknowledge: mocks.publisherAcknowledge,
        },
      },
    })),
  },
}));

import {
  claimGooglePlayRtdnEvent,
  completeGooglePlayRtdnEvent,
  GOOGLE_PLAY_RTDN_MANUAL_REVIEW_REQUIRED,
  syncGooglePlaySubscriptionFromRtdn,
  syncGooglePlayVoidedSubscriptionFromRtdn,
  verifyGooglePlayRtdnToken,
} from "@/features/subscriptions/google-play-service";

describe("Google Play RTDN service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_PLAY_RTDN_AUDIENCE = "https://foxiesdeck.com/api/google-play/rtdn";
    process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL = "pubsub@foxiesdeck.iam.gserviceaccount.com";

    mocks.databaseInsert.mockResolvedValue({ error: null });
    mocks.databaseOwnerLookup.mockResolvedValue({ data: [], error: null });
    mocks.databaseEventLookup.mockResolvedValue({ data: null, error: null });
    mocks.databaseSubscriptionLookup.mockResolvedValue({ data: null, error: null });
    mocks.databaseUpdate.mockResolvedValue({ error: null });
    mocks.databaseUpsert.mockResolvedValue({ error: null });
    mocks.publisherGet.mockResolvedValue({
      data: {
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        latestOrderId: "GPA.1234",
        linkedPurchaseToken: "old-token",
        lineItems: [{
          productId: "basic_monthly",
          expiryTime: "2030-07-01T00:00:00Z",
          autoRenewingPlan: { autoRenewEnabled: true },
        }],
      },
    });
    mocks.publisherAcknowledge.mockResolvedValue({});
    mocks.googleVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email_verified: true,
        email: "pubsub@foxiesdeck.iam.gserviceaccount.com",
      }),
    });
  });

  it("verifies the Pub/Sub OIDC audience and service-account identity", async () => {
    await expect(verifyGooglePlayRtdnToken("signed-id-token")).resolves.toBeUndefined();

    expect(mocks.googleVerifyIdToken).toHaveBeenCalledWith({
      idToken: "signed-id-token",
      audience: "https://foxiesdeck.com/api/google-play/rtdn",
    });
  });

  it("rejects missing RTDN configuration and an unexpected service account", async () => {
    delete process.env.GOOGLE_PLAY_RTDN_AUDIENCE;
    await expect(verifyGooglePlayRtdnToken("signed-id-token")).rejects.toThrow(
      "environment variables are not configured",
    );

    process.env.GOOGLE_PLAY_RTDN_AUDIENCE = "https://foxiesdeck.com/api/google-play/rtdn";
    mocks.googleVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email_verified: true,
        email: "attacker@example.com",
      }),
    });
    const identityLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(verifyGooglePlayRtdnToken("signed-id-token")).rejects.toThrow(
        "Invalid Google Play RTDN identity",
      );
      expect(identityLog).toHaveBeenCalledWith(
        "Google Play RTDN identity claims rejected.",
        { receivedEmail: "attacker@example.com", emailVerified: true },
      );
    } finally {
      identityLog.mockRestore();
    }
  });

  it("syncs a verified renewal to every account mapped to the current or linked purchase token", async () => {
    mocks.databaseOwnerLookup.mockImplementation(async (token: string) => ({
      data: token === "new-token"
        ? [{ user_id: "user-1" }]
        : [{ user_id: "user-1" }, { user_id: "user-2" }],
      error: null,
    }));

    await expect(syncGooglePlaySubscriptionFromRtdn("new-token")).resolves.toBe("user-1");

    expect(mocks.publisherGet).toHaveBeenCalledWith({
      packageName: "com.foxiesdeck.app",
      token: "new-token",
    });
    const persistedEntitlements = mocks.databaseUpsert.mock.calls
      .filter(([table]) => table === "user_subscriptions")
      .map(([, row]) => row as { user_id: string; ends_at: string; status: string });
    expect(persistedEntitlements).toHaveLength(2);
    expect(persistedEntitlements.map(({ user_id }) => user_id)).toEqual(["user-1", "user-2"]);
    expect(persistedEntitlements.every(({ status, ends_at }) =>
      status === "active" && ends_at === "2030-07-01T00:00:00.000Z",
    )).toBe(true);
    expect(mocks.publisherAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("does not grant or acknowledge a purchase token with no linked FoxiesDeck account", async () => {
    await expect(syncGooglePlaySubscriptionFromRtdn("unlinked-token")).resolves.toBeNull();

    expect(mocks.databaseUpsert).not.toHaveBeenCalledWith(
      "user_subscriptions",
      expect.anything(),
      expect.anything(),
    );
    expect(mocks.publisherAcknowledge).not.toHaveBeenCalled();
  });

  it("revokes the current entitlement when its exact latest subscription order is fully voided", async () => {
    mocks.databaseOwnerLookup.mockResolvedValue({
      data: [{ user_id: "user-1" }],
      error: null,
    });
    mocks.databaseSubscriptionLookup.mockResolvedValue({
      data: {
        plan: "basic",
        status: "active",
        provider: "google_play",
        google_play_purchase_token: "voided-token",
        ends_at: "2030-07-01T00:00:00.000Z",
      },
      error: null,
    });

    const before = Date.now();
    await expect(
      syncGooglePlayVoidedSubscriptionFromRtdn("voided-token", "GPA.1234", 1),
    ).resolves.toBe("user-1");
    const after = Date.now();

    const [, savedEntitlement] = mocks.databaseUpsert.mock.calls.find(
      ([table]) => table === "user_subscriptions",
    ) ?? [];
    const entitlement = savedEntitlement as {
      status: string;
      ends_at: string;
      renews_at: string;
    };
    expect(entitlement.status).toBe("expired");
    expect(Date.parse(entitlement.ends_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(entitlement.ends_at)).toBeLessThanOrEqual(after);
    expect(entitlement.renews_at).toBe("2030-07-01T00:00:00.000Z");
    expect(mocks.publisherAcknowledge).not.toHaveBeenCalled();
  });

  it("does not revoke a newer subscription order for a historical void", async () => {
    mocks.databaseOwnerLookup.mockResolvedValue({
      data: [{ user_id: "user-1" }],
      error: null,
    });

    await expect(
      syncGooglePlayVoidedSubscriptionFromRtdn("voided-token", "GPA.OLDER", 1),
    ).resolves.toBe("user-1");

    const [, savedEntitlement] = mocks.databaseUpsert.mock.calls.find(
      ([table]) => table === "user_subscriptions",
    ) ?? [];
    expect(savedEntitlement).toMatchObject({ status: "active", ends_at: "2030-07-01T00:00:00.000Z" });
    expect(mocks.publisherAcknowledge).toHaveBeenCalledTimes(1);
  });

  it("claims new messages and retries duplicates that have not completed", async () => {
    await expect(claimGooglePlayRtdnEvent("message-new", {})).resolves.toBe(true);

    mocks.databaseInsert.mockResolvedValueOnce({ error: { code: "23505" } });
    mocks.databaseEventLookup.mockResolvedValueOnce({
      data: { processed_at: null },
      error: null,
    });
    await expect(claimGooglePlayRtdnEvent("message-retry", {})).resolves.toBe(true);

    mocks.databaseInsert.mockResolvedValueOnce({ error: { code: "23505" } });
    mocks.databaseEventLookup.mockResolvedValueOnce({
      data: { processed_at: "2030-07-01T00:00:00.000Z" },
      error: null,
    });
    await expect(claimGooglePlayRtdnEvent("message-done", {})).resolves.toBe(false);
  });

  it("keeps pending manual refund reviews queued without reprocessing duplicate deliveries", async () => {
    mocks.databaseInsert.mockResolvedValueOnce({ error: { code: "23505" } });
    mocks.databaseEventLookup.mockResolvedValue({
      data: {
        processed_at: null,
        error_message: GOOGLE_PLAY_RTDN_MANUAL_REVIEW_REQUIRED,
      },
      error: null,
    });

    await expect(claimGooglePlayRtdnEvent("refund-review-pending", {})).resolves.toBe(false);
  });

  it("marks successful events processed but leaves failed events retryable", async () => {
    await completeGooglePlayRtdnEvent("message-success", "user-1");
    const successUpdate = mocks.databaseUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(successUpdate).toMatchObject({ user_id: "user-1", error_message: null });
    expect(typeof successUpdate.processed_at).toBe("string");

    await completeGooglePlayRtdnEvent("message-failed", null, "temporary provider failure");
    const failedUpdate = mocks.databaseUpdate.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(failedUpdate).toMatchObject({
      user_id: null,
      processed_at: null,
      error_message: "temporary provider failure",
    });
  });
});
