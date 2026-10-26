import { vi } from "vitest";

const mockVerifyIdentity = vi.hoisted(() => vi.fn());
const mockClaimEvent = vi.hoisted(() => vi.fn());
const mockCompleteEvent = vi.hoisted(() => vi.fn());
const mockSyncSubscription = vi.hoisted(() => vi.fn());
const mockSyncVoidedSubscription = vi.hoisted(() => vi.fn());
const manualReviewMarker = vi.hoisted(
  () => "manual_review_required: ReviewRefund decision required within 24 hours.",
);

vi.mock("@/features/subscriptions/google-play-service", () => ({
  verifyGooglePlayRtdnToken: mockVerifyIdentity,
  claimGooglePlayRtdnEvent: mockClaimEvent,
  completeGooglePlayRtdnEvent: mockCompleteEvent,
  GOOGLE_PLAY_RTDN_MANUAL_REVIEW_REQUIRED: manualReviewMarker,
  syncGooglePlaySubscriptionFromRtdn: mockSyncSubscription,
  syncGooglePlayVoidedSubscriptionFromRtdn: mockSyncVoidedSubscription,
}));

import { POST } from "@/app/api/google-play/rtdn/route";

function makeRequest(payload: unknown, token = "signed-token") {
  return new Request("https://foxiesdeck.test/api/google-play/rtdn", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

describe("Google Play RTDN route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerifyIdentity.mockResolvedValue(undefined);
    mockClaimEvent.mockResolvedValue(true);
    mockCompleteEvent.mockResolvedValue(undefined);
    mockSyncSubscription.mockResolvedValue("user-1");
    mockSyncVoidedSubscription.mockResolvedValue("user-1");
  });

  it("rejects unauthenticated Pub/Sub deliveries", async () => {
    const response = await POST(new Request("https://foxiesdeck.test/api/google-play/rtdn", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(mockClaimEvent).not.toHaveBeenCalled();
  });

  it("deduplicates and refreshes a subscription from the notification token", async () => {
    const notification = { subscriptionNotification: { purchaseToken: "purchase-token-1" } };
    const response = await POST(
      makeRequest({
        message: {
          messageId: "message-1",
          data: Buffer.from(JSON.stringify(notification)).toString("base64"),
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockVerifyIdentity).toHaveBeenCalledWith("signed-token");
    expect(mockClaimEvent).toHaveBeenCalledWith("message-1", notification);
    expect(mockSyncSubscription).toHaveBeenCalledWith("purchase-token-1");
    expect(mockCompleteEvent).toHaveBeenCalledWith("message-1", "user-1", undefined);
  });

  it("does not process an already handled Pub/Sub message again", async () => {
    mockClaimEvent.mockResolvedValue(false);
    const response = await POST(
      makeRequest({
        message: {
          messageId: "message-2",
          data: Buffer.from(JSON.stringify({ subscriptionNotification: { purchaseToken: "token" } })).toString("base64"),
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockSyncSubscription).not.toHaveBeenCalled();
  });

  it("refreshes a voided subscription using its purchase token and order details", async () => {
    const notification = {
      voidedPurchaseNotification: {
        purchaseToken: "voided-token",
        orderId: "GPA.1234-5678-9012-34567..0",
        productType: 1,
        refundType: 1,
      },
    };
    const response = await POST(
      makeRequest({
        message: {
          messageId: "voided-message-1",
          data: Buffer.from(JSON.stringify(notification)).toString("base64"),
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockClaimEvent).toHaveBeenCalledWith("voided-message-1", notification);
    expect(mockSyncVoidedSubscription).toHaveBeenCalledWith(
      "voided-token",
      "GPA.1234-5678-9012-34567..0",
      1,
    );
    expect(mockSyncSubscription).not.toHaveBeenCalled();
    expect(mockCompleteEvent).toHaveBeenCalledWith("voided-message-1", "user-1", undefined);
  });

  it("durably records pending chargeback reviews without logging their review token", async () => {
    const pendingRefundToken = "pending-refund-secret";
    const notification = {
      pendingRefundReviewNotification: {
        pendingRefundToken,
        orderId: "GPA.1234-5678-9012-34567",
        refundReason: 7,
      },
    };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await POST(
        makeRequest({
          message: {
            messageId: "refund-review-1",
            data: Buffer.from(JSON.stringify(notification)).toString("base64"),
          },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true, reviewRequired: true });
      expect(mockClaimEvent).toHaveBeenCalledWith("refund-review-1", notification);
      expect(mockCompleteEvent).toHaveBeenCalledWith("refund-review-1", null, manualReviewMarker);
      expect(mockSyncSubscription).not.toHaveBeenCalled();
      expect(mockSyncVoidedSubscription).not.toHaveBeenCalled();
      expect(errorLog).toHaveBeenCalledWith(
        "Google Play RTDN refund review requires manual action within 24 hours.",
        { messageId: "refund-review-1", refundReason: 7 },
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(pendingRefundToken);
    } finally {
      errorLog.mockRestore();
    }
  });

  it("acknowledges unsupported one-time voids without treating them as subscriptions", async () => {
    const response = await POST(
      makeRequest({
        message: {
          messageId: "voided-one-time-1",
          data: Buffer.from(JSON.stringify({
            voidedPurchaseNotification: {
              purchaseToken: "one-time-token",
              orderId: "GPA.1234-5678-9012-34567",
              productType: 2,
              refundType: 1,
            },
          })).toString("base64"),
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, skipped: true });
    expect(mockClaimEvent).not.toHaveBeenCalled();
    expect(mockSyncVoidedSubscription).not.toHaveBeenCalled();
  });

  it("acknowledges Google's test notification without claiming a subscription event", async () => {
    const testNotification = { testNotification: { version: "1.0" } };
    const infoLog = vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      const response = await POST(
        makeRequest({
          message: {
            messageId: "test-notification-1",
            data: Buffer.from(JSON.stringify(testNotification)).toString("base64"),
          },
        }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ received: true, skipped: true });
      expect(mockVerifyIdentity).toHaveBeenCalledWith("signed-token");
      expect(mockClaimEvent).not.toHaveBeenCalled();
      expect(mockSyncSubscription).not.toHaveBeenCalled();
      expect(infoLog).toHaveBeenCalledWith("Google Play RTDN test notification acknowledged.");
      expect(JSON.stringify(infoLog.mock.calls)).not.toContain("signed-token");
    } finally {
      infoLog.mockRestore();
    }
  });

  it("redacts the purchase token from RTDN logs and persisted processing errors", async () => {
    const purchaseToken = "short-purchase-secret";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSyncSubscription.mockRejectedValueOnce(
      new Error(`Google request failed for ${purchaseToken}`),
    );

    try {
      const response = await POST(
        makeRequest({
          message: {
            messageId: "message-error",
            data: Buffer.from(
              JSON.stringify({ subscriptionNotification: { purchaseToken } }),
            ).toString("base64"),
          },
        }),
      );

      expect(response.status).toBe(500);
      expect(mockCompleteEvent).toHaveBeenCalledWith(
        "message-error",
        null,
        "Google request failed for [redacted]",
      );
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(purchaseToken);
    } finally {
      errorLog.mockRestore();
    }
  });
});
