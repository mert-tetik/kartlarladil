import { POST } from "@/app/api/lemon-squeezy/webhook/route";
import { vi } from "vitest";

const mockVerifyWebhookSignature = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockProcessWebhookEvent = vi.hoisted(() => vi.fn());
const mockRecordWebhookEventError = vi.hoisted(() => vi.fn());
const mockResolveWebhookUserId = vi.hoisted(() => vi.fn());

vi.mock("@/features/subscriptions/lemon-squeezy", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@/features/subscriptions/webhook-service", () => ({
  processWebhookEvent: mockProcessWebhookEvent,
  recordWebhookEventError: mockRecordWebhookEventError,
  resolveWebhookUserId: mockResolveWebhookUserId,
}));

const adminClient = { from: vi.fn() };

function makeSubscriptionEvent(variantId: string | number = "pro-monthly") {
  return {
    meta: {
      webhook_id: "evt_1",
      event_name: "subscription_updated",
      custom_data: { user_id: "user-1" },
    },
    data: {
      id: "sub_1",
      type: "subscriptions",
      attributes: {
        status: "active",
        variant_id: variantId,
        product_id: 10,
        customer_id: 20,
        urls: {
          customer_portal: "https://portal.example.com",
        },
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: null,
      },
    },
  };
}

function makeRequest(payload: unknown) {
  return new Request("http://localhost/api/lemon-squeezy/webhook", {
    method: "POST",
    headers: {
      "x-signature": "valid",
    },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/lemon-squeezy/webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "secret";
    process.env.LEMONSQUEEZY_PRO_VARIANT_ID = "pro-monthly";
    process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID = "pro-yearly";
    process.env.LEMONSQUEEZY_BASIC_VARIANT_ID = "basic-monthly";
    process.env.LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID = "basic-yearly";
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockCreateSupabaseAdminClient.mockReturnValue(adminClient);
    mockResolveWebhookUserId.mockResolvedValue("user-1");
    mockProcessWebhookEvent.mockResolvedValue({ status: "success" });
  });

  it("processes a valid subscription event", async () => {
    const event = makeSubscriptionEvent();
    const response = await POST(makeRequest(event));
    const payload = (await response.json()) as { received: boolean };

    expect(response.status).toBe(200);
    expect(payload.received).toBe(true);
    expect(mockProcessWebhookEvent).toHaveBeenCalledWith(
      adminClient,
      event,
      {
        plan: "pro",
        status: "active",
        customerId: "20",
        subscriptionId: "sub_1",
        variantId: "pro-monthly",
        productId: "10",
        customerPortalUrl: "https://portal.example.com",
        renewsAt: "2026-07-01T00:00:00Z",
        endsAt: null,
      },
      "user-1",
    );
  });

  it("does not mutate subscription state for an unknown variant", async () => {
    const event = makeSubscriptionEvent("unknown-variant");
    const response = await POST(makeRequest(event));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Unknown Lemon Squeezy subscription variant.");
    expect(mockProcessWebhookEvent).not.toHaveBeenCalled();
    expect(mockRecordWebhookEventError).toHaveBeenCalledWith(
      adminClient,
      event,
      "user-1",
      "Unknown Lemon Squeezy subscription variant.",
    );
  });

  it("logs unresolved user events without processing subscription state", async () => {
    const event = makeSubscriptionEvent();
    mockResolveWebhookUserId.mockResolvedValue(null);

    const response = await POST(makeRequest(event));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Unable to resolve user for Lemon Squeezy webhook event.");
    expect(mockProcessWebhookEvent).not.toHaveBeenCalled();
    expect(mockRecordWebhookEventError).toHaveBeenCalledWith(
      adminClient,
      event,
      null,
      "Unable to resolve user for Lemon Squeezy webhook event.",
    );
  });

  it("rejects invalid signatures", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);

    const response = await POST(makeRequest(makeSubscriptionEvent()));

    expect(response.status).toBe(401);
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
