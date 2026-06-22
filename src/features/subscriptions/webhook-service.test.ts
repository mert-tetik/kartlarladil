import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findWebhookEvent,
  processWebhookEvent,
  recordWebhookEventError,
  resolveWebhookUserId,
  type LemonSqueezyWebhookEvent,
  type SubscriptionUpdate,
} from "@/features/subscriptions/webhook-service";

interface MockCall {
  table: string;
  method: string;
  column?: string;
  value?: unknown;
}

interface MockResponse {
  table: string;
  method: string;
  data?: unknown;
  error?: { message: string } | null;
}

function createMockClient(responses: MockResponse[]) {
  let index = 0;
  const calls: MockCall[] = [];

  const client = {
    from(table: string) {
      const response = responses[index++];
      calls.push({ table, method: response?.method ?? "unknown" });

      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => {
              calls[calls.length - 1] = {
                ...calls[calls.length - 1],
                column,
                value,
              };
              return {
                data: response?.data ?? null,
                error: response?.error ?? null,
              };
            },
          }),
        }),
        upsert: async () => ({
          data: response?.data ?? null,
          error: response?.error ?? null,
        }),
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

function createRecordingMockClient(responses: MockResponse[]) {
  let index = 0;
  const calls: Array<MockCall & { payload?: unknown }> = [];

  const client = {
    from(table: string) {
      const response = responses[index++];

      return {
        select: () => ({
          eq: (column: string, value: unknown) => ({
            maybeSingle: async () => {
              void column;
              void value;

              return {
                data: response?.data ?? null,
                error: response?.error ?? null,
              };
            },
          }),
        }),
        upsert: async (payload: unknown) => {
          calls.push({ table, method: "upsert", payload });
          return {
            data: response?.data ?? null,
            error: response?.error ?? null,
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

function makeEvent(overrides: Partial<LemonSqueezyWebhookEvent["meta"]> = {}): LemonSqueezyWebhookEvent {
  return {
    meta: {
      webhook_id: "evt_123",
      event_name: "subscription_created",
      custom_data: { user_id: "user-1" },
      ...overrides,
    },
    data: {
      id: "sub_1",
      type: "subscriptions",
      attributes: {
        status: "active",
        variant_id: 123,
        product_id: 456,
        customer_id: 789,
        urls: { customer_portal: "https://portal.example.com" },
        renews_at: "2026-07-01T00:00:00Z",
        ends_at: undefined,
      },
    },
  };
}

const subscriptionUpdate: SubscriptionUpdate = {
  plan: "pro",
  status: "active",
  customerId: "789",
  subscriptionId: "sub_1",
  variantId: "123",
  productId: "456",
  customerPortalUrl: "https://portal.example.com",
  renewsAt: "2026-07-01T00:00:00Z",
  endsAt: null,
};

describe("findWebhookEvent", () => {
  it("returns the existing row when found", async () => {
    const { client } = createMockClient([
      {
        table: "webhook_events",
        method: "select",
        data: { webhook_id: "evt_123", processed_at: "2026-06-16T00:00:00Z", error_message: null },
      },
    ]);

    const result = await findWebhookEvent(client, "evt_123");

    expect(result).toEqual({
      webhook_id: "evt_123",
      processed_at: "2026-06-16T00:00:00Z",
      error_message: null,
    });
  });

  it("returns null when no row exists", async () => {
    const { client } = createMockClient([
      { table: "webhook_events", method: "select", data: null },
    ]);

    const result = await findWebhookEvent(client, "evt_missing");

    expect(result).toBeNull();
  });
});

describe("resolveWebhookUserId", () => {
  it("uses custom_data.user_id when present", async () => {
    const { client, calls } = createMockClient([]);

    await expect(resolveWebhookUserId(client, makeEvent())).resolves.toBe("user-1");
    expect(calls).toHaveLength(0);
  });

  it("falls back to the subscription id", async () => {
    const { client, calls } = createMockClient([
      {
        table: "user_subscriptions",
        method: "select",
        data: { user_id: "user-from-subscription" },
      },
    ]);

    await expect(
      resolveWebhookUserId(client, makeEvent({ custom_data: undefined })),
    ).resolves.toBe("user-from-subscription");
    expect(calls).toEqual([
      {
        table: "user_subscriptions",
        method: "select",
        column: "lemon_squeezy_subscription_id",
        value: "sub_1",
      },
    ]);
  });

  it("falls back to the customer id when the subscription id is unknown", async () => {
    const { client, calls } = createMockClient([
      { table: "user_subscriptions", method: "select", data: null },
      {
        table: "user_subscriptions",
        method: "select",
        data: { user_id: "user-from-customer" },
      },
    ]);

    await expect(
      resolveWebhookUserId(client, makeEvent({ custom_data: undefined })),
    ).resolves.toBe("user-from-customer");
    expect(calls).toEqual([
      {
        table: "user_subscriptions",
        method: "select",
        column: "lemon_squeezy_subscription_id",
        value: "sub_1",
      },
      {
        table: "user_subscriptions",
        method: "select",
        column: "lemon_squeezy_customer_id",
        value: "789",
      },
    ]);
  });
});

describe("recordWebhookEventError", () => {
  it("logs an error without requiring a user id", async () => {
    const { client, calls } = createRecordingMockClient([
      { table: "webhook_events", method: "upsert" },
    ]);

    await recordWebhookEventError(client, makeEvent(), null, "unresolved user");

    expect(calls).toEqual([
      {
        table: "webhook_events",
        method: "upsert",
        payload: {
          webhook_id: "evt_123",
          event_name: "subscription_created",
          payload: makeEvent(),
          user_id: null,
          processed_at: null,
          error_message: "unresolved user",
        },
      },
    ]);
  });
});

describe("processWebhookEvent", () => {
  it("returns duplicate when the event was already processed", async () => {
    const { client, calls } = createMockClient([
      {
        table: "webhook_events",
        method: "select",
        data: { webhook_id: "evt_123", processed_at: "2026-06-16T00:00:00Z", error_message: null },
      },
    ]);

    const result = await processWebhookEvent(client, makeEvent(), subscriptionUpdate, "user-1");

    expect(result.status).toBe("duplicate");
    expect(calls).toHaveLength(1);
  });

  it("processes a new event and marks it processed", async () => {
    const { client, calls } = createMockClient([
      { table: "webhook_events", method: "select", data: null },
      { table: "webhook_events", method: "upsert" },
      { table: "user_subscriptions", method: "upsert" },
      { table: "webhook_events", method: "upsert" },
    ]);

    const result = await processWebhookEvent(client, makeEvent(), subscriptionUpdate, "user-1");

    expect(result.status).toBe("success");
    expect(calls).toEqual([
      { table: "webhook_events", method: "select", column: "webhook_id", value: "evt_123" },
      { table: "webhook_events", method: "upsert" },
      { table: "user_subscriptions", method: "upsert" },
      { table: "webhook_events", method: "upsert" },
    ]);
  });

  it("records an error when the subscription upsert fails", async () => {
    const { client, calls } = createMockClient([
      { table: "webhook_events", method: "select", data: null },
      { table: "webhook_events", method: "upsert" },
      { table: "user_subscriptions", method: "upsert", error: { message: "subscription conflict" } },
      { table: "webhook_events", method: "upsert" },
    ]);

    const result = await processWebhookEvent(client, makeEvent(), subscriptionUpdate, "user-1");

    expect(result.status).toBe("error");
    expect(result.status === "error" && result.message).toBe("subscription conflict");
    expect(calls).toHaveLength(4);
  });

  it("returns error when event metadata is missing", async () => {
    const { client, calls } = createMockClient([]);

    const result = await processWebhookEvent(client, { data: {} }, subscriptionUpdate, "user-1");

    expect(result.status).toBe("error");
    expect(calls).toHaveLength(0);
  });
});
