import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/features/subscriptions/lemon-squeezy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUBSCRIPTION_EVENTS = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_expired",
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
];

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const signature = request.headers.get("x-signature") ?? "";
  const payload = await request.text();

  if (!verifyWebhookSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = parseWebhookPayload(payload);

  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const eventName = event.meta?.event_name;

  if (!eventName || !SUBSCRIPTION_EVENTS.includes(eventName)) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const userId = event.meta?.custom_data?.user_id;

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id in custom data" }, { status: 400 });
  }

  const update = mapSubscriptionUpdate(event);
  const adminClient = createSupabaseAdminClient();

  const { error } = await adminClient.from("user_subscriptions").upsert(
    {
      user_id: userId,
      plan: update.plan,
      status: update.status,
      lemon_squeezy_customer_id: update.customerId,
      lemon_squeezy_subscription_id: update.subscriptionId,
      lemon_squeezy_variant_id: update.variantId,
      lemon_squeezy_product_id: update.productId,
      customer_portal_url: update.customerPortalUrl,
      renews_at: update.renewsAt,
      ends_at: update.endsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

function parseWebhookPayload(payload: string): LemonSqueezyWebhookEvent | null {
  try {
    return JSON.parse(payload) as LemonSqueezyWebhookEvent;
  } catch {
    return null;
  }
}

function mapSubscriptionUpdate(event: LemonSqueezyWebhookEvent): SubscriptionUpdate {
  const attributes = event.data?.attributes ?? {};
  const urls = attributes.urls ?? {};
  const variantId = String(attributes.variant_id ?? "");

  return {
    plan: resolvePlanFromVariant(variantId),
    status: normalizeSubscriptionStatus(attributes.status),
    customerId: attributes.customer_id ? String(attributes.customer_id) : null,
    subscriptionId: event.data?.id ? String(event.data.id) : null,
    variantId: variantId || null,
    productId: attributes.product_id ? String(attributes.product_id) : null,
    customerPortalUrl: urls.customer_portal ?? null,
    renewsAt: attributes.renews_at ? String(attributes.renews_at) : null,
    endsAt: attributes.ends_at ? String(attributes.ends_at) : null,
  };
}

function resolvePlanFromVariant(variantId: string): SubscriptionPlan {
  if (
    variantId === process.env.LEMONSQUEEZY_PRO_VARIANT_ID ||
    variantId === process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID
  ) {
    return "pro";
  }

  if (
    variantId === process.env.LEMONSQUEEZY_BASIC_VARIANT_ID ||
    variantId === process.env.LEMONSQUEEZY_BASIC_YEARLY_VARIANT_ID
  ) {
    return "basic";
  }

  return "free";
}

function normalizeSubscriptionStatus(value: unknown): SubscriptionStatus {
  const valid: SubscriptionStatus[] = [
    "free",
    "on_trial",
    "active",
    "paused",
    "past_due",
    "unpaid",
    "cancelled",
    "expired",
  ];
  const normalized = typeof value === "string" ? value : "free";

  if (valid.includes(normalized as SubscriptionStatus)) {
    return normalized as SubscriptionStatus;
  }

  return "free";
}

interface SubscriptionUpdate {
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

interface LemonSqueezyWebhookEvent {
  meta?: {
    event_name?: string;
    custom_data?: {
      user_id?: string;
    };
  };
  data?: {
    id?: string | number;
    attributes?: {
      status?: string;
      variant_id?: string | number;
      product_id?: string | number;
      customer_id?: string | number;
      urls?: {
        customer_portal?: string;
      };
      renews_at?: string;
      ends_at?: string;
    };
  };
}
