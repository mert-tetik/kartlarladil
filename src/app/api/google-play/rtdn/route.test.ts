import { vi } from "vitest";

const mockVerifyIdentity = vi.hoisted(() => vi.fn());
const mockClaimEvent = vi.hoisted(() => vi.fn());
const mockCompleteEvent = vi.hoisted(() => vi.fn());
const mockSyncSubscription = vi.hoisted(() => vi.fn());

vi.mock("@/features/subscriptions/google-play-service", () => ({
  verifyGooglePlayRtdnToken: mockVerifyIdentity,
  claimGooglePlayRtdnEvent: mockClaimEvent,
  completeGooglePlayRtdnEvent: mockCompleteEvent,
  syncGooglePlaySubscriptionFromRtdn: mockSyncSubscription,
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
});
