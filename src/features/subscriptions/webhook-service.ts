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
  userId: string | null;
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

  let isDuplicate = false;
  try {
    const existing = await findWebhookEvent(client, webhookId);
    if (existing?.processed_at) {
      isDuplicate = true;
    } else {
      await upsertWebhookEvent(
        client,
        { webhookId, eventName, payload: event, userId },
        { processedAt: null },
      );
    }
  } catch (logError) {
    console.error("Webhook event logging failed:", logError);
  }

  if (isDuplicate) {
    return { status: "duplicate" };
  }

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
      display_name: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    try {
      await upsertWebhookEvent(
        client,
        { webhookId, eventName, payload: event, userId },
        { errorMessage: error.message },
      );
    } catch (logError) {
      console.error("Webhook event logging failed:", logError);
    }
    return { status: "error", message: error.message };
  }

  try {
    await upsertWebhookEvent(
      client,
      { webhookId, eventName, payload: event, userId },
      { processedAt: new Date().toISOString() },
    );
  } catch (logError) {
    console.error("Webhook event logging failed:", logError);
  }

  return { status: "success" };
}

export async function resolveWebhookUserId(
  client: SupabaseClient,
  event: LemonSqueezyWebhookEvent,
): Promise<string | null> {
  const customUserId = event.meta?.custom_data?.user_id;

  if (customUserId) {
    return customUserId;
  }

  const subscriptionId = getEventSubscriptionId(event);
  if (subscriptionId) {
    const userId = await findUserIdBySubscriptionId(client, subscriptionId);
    if (userId) {
      return userId;
    }
  }

  const customerId = event.data?.attributes?.customer_id;
  if (customerId) {
    return findUserIdByCustomerId(client, String(customerId));
  }

  return null;
}

export async function recordWebhookEventError(
  client: SupabaseClient,
  event: LemonSqueezyWebhookEvent,
  userId: string | null,
  message: string,
): Promise<void> {
  const webhookId = event.meta?.webhook_id;
  const eventName = event.meta?.event_name;

  if (!webhookId || !eventName) {
    return;
  }

  await upsertWebhookEvent(
    client,
    { webhookId, eventName, payload: event, userId },
    { errorMessage: message },
  );
}

function getEventSubscriptionId(event: LemonSqueezyWebhookEvent): string | null {
  if (event.data?.type === "subscriptions" && event.data.id) {
    return String(event.data.id);
  }

  const subscriptionId = event.data?.attributes?.subscription_id;
  return subscriptionId ? String(subscriptionId) : null;
}

async function findUserIdBySubscriptionId(
  client: SupabaseClient,
  subscriptionId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("user_subscriptions")
    .select("user_id")
    .eq("lemon_squeezy_subscription_id", subscriptionId)
    .maybeSingle<{ user_id: string }>();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}

async function findUserIdByCustomerId(
  client: SupabaseClient,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("user_subscriptions")
    .select("user_id")
    .eq("lemon_squeezy_customer_id", customerId)
    .maybeSingle<{ user_id: string }>();

  if (error) {
    throw error;
  }

  return data?.user_id ?? null;
}
