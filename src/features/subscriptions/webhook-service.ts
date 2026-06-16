import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/domain";

export interface WebhookEventRow {
  webhook_id: string;
  processed_at: string | null;
  error_message: string | null;
}

export interface LemonSqueezyWebhookEvent {
  meta?: {
    webhook_id?: string;
    event_name?: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string | number;
    type?: string;
    attributes?: {
      status?: string;
      variant_id?: string | number;
      product_id?: string | number;
      customer_id?: string | number;
      subscription_id?: string | number;
      urls?: {
        customer_portal?: string;
      };
      renews_at?: string;
      ends_at?: string;
    };
  };
}

export interface SubscriptionUpdate {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  customerId: string | null;
  subscriptionId: string | null;
  variantId: string | null;
  productId: string | null;
  customerPortalUrl: string | null;
  renewsAt: string | null;
  endsAt: string | null;
}

export type WebhookProcessResult =
  | { status: "duplicate" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function findWebhookEvent(
  client: SupabaseClient,
  webhookId: string,
): Promise<WebhookEventRow | null> {
  const { data, error } = await client
    .from("webhook_events")
    .select("webhook_id, processed_at, error_message")
    .eq("webhook_id", webhookId)
    .maybeSingle<WebhookEventRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

interface UpsertWebhookEventInput {
  webhookId: string;
  eventName: string;
  payload: unknown;
  userId: string;
}

export async function upsertWebhookEvent(
  client: SupabaseClient,
  input: UpsertWebhookEventInput,
  state: { processedAt?: string | null; errorMessage?: string | null } = {},
): Promise<void> {
  const { error } = await client.from("webhook_events").upsert(
    {
      webhook_id: input.webhookId,
      event_name: input.eventName,
      payload: input.payload,
      user_id: input.userId,
      processed_at: state.processedAt ?? null,
      error_message: state.errorMessage ?? null,
    },
    { onConflict: "webhook_id" },
  );

  if (error) {
    throw error;
  }
}

export async function processWebhookEvent(
  client: SupabaseClient,
  event: LemonSqueezyWebhookEvent,
  subscriptionUpdate: SubscriptionUpdate,
  userId: string,
): Promise<WebhookProcessResult> {
  const webhookId = event.meta?.webhook_id;
  const eventName = event.meta?.event_name;

  if (!webhookId || !eventName) {
    return { status: "error", message: "Missing event metadata" };
  }

  const existing = await findWebhookEvent(client, webhookId);
  if (existing?.processed_at) {
    return { status: "duplicate" };
  }

  await upsertWebhookEvent(
    client,
    { webhookId, eventName, payload: event, userId },
    { processedAt: null },
  );

  const { error } = await client.from("user_subscriptions").upsert(
    {
      user_id: userId,
      plan: subscriptionUpdate.plan,
      status: subscriptionUpdate.status,
      lemon_squeezy_customer_id: subscriptionUpdate.customerId,
      lemon_squeezy_subscription_id: subscriptionUpdate.subscriptionId,
      lemon_squeezy_variant_id: subscriptionUpdate.variantId,
      lemon_squeezy_product_id: subscriptionUpdate.productId,
      customer_portal_url: subscriptionUpdate.customerPortalUrl,
      renews_at: subscriptionUpdate.renewsAt,
      ends_at: subscriptionUpdate.endsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    await upsertWebhookEvent(
      client,
      { webhookId, eventName, payload: event, userId },
      { errorMessage: error.message },
    );
    return { status: "error", message: error.message };
  }

  await upsertWebhookEvent(
    client,
    { webhookId, eventName, payload: event, userId },
    { processedAt: new Date().toISOString() },
  );

  return { status: "success" };
}
