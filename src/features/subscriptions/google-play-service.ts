"use server";

import { google } from "googleapis";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan, SubscriptionProvider, SubscriptionStatus } from "@/types/domain";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME;
const SERVICE_ACCOUNT_KEY_JSON = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON;

function getAndroidPublisher() {
  if (!PACKAGE_NAME || !SERVICE_ACCOUNT_KEY_JSON) {
    throw new Error("Google Play Billing environment variables are not configured.");
  }

  const credentials = JSON.parse(SERVICE_ACCOUNT_KEY_JSON);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth });
}

const GOOGLE_PLAY_PLAN_BY_SKU: Record<string, SubscriptionPlan> = {
  "basic_monthly": "basic",
  "basic_yearly": "basic",
  "pro_monthly": "pro",
  "pro_yearly": "pro",
  "basic-monthly-first-month-free": "basic",
  "pro-monthly-one-month-free": "pro",
};

function resolvePlanFromSku(sku: string): SubscriptionPlan | null {
  return GOOGLE_PLAY_PLAN_BY_SKU[sku] ?? null;
}

function toIsoDate(millis: string | number | undefined | null): string | null {
  if (millis == null) return null;
  const value = typeof millis === "string" ? Number.parseInt(millis, 10) : millis;
  if (!Number.isFinite(value)) return null;
  return new Date(value).toISOString();
}

interface VerifyResult {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  purchaseToken: string;
  subscriptionId: string;
  orderId: string | null;
  endsAt: string | null;
}

interface AndroidPublisher {
  purchases: {
    subscriptions: {
      get: (params: { packageName: string | undefined; subscriptionId: string; token: string }) => Promise<{
        data: {
          paymentState?: number;
          expiryTimeMillis?: string | number;
          orderId?: string;
        };
      }>;
      acknowledge: (params: {
        packageName: string | undefined;
        subscriptionId: string;
        token: string;
      }) => Promise<unknown>;
    };
  };
}

/**
 * Verifies a Google Play subscription purchase token, acknowledges it, and
 * persists the entitlement in Supabase.
 *
 * Acknowledgement must happen within 3 days or Google automatically refunds.
 */
export async function verifyGooglePlaySubscription(
  purchaseToken: string,
  subscriptionId: string,
  userId: string,
  publisher?: AndroidPublisher,
): Promise<VerifyResult> {
  const androidpublisher = publisher ?? getAndroidPublisher();

  const plan = resolvePlanFromSku(subscriptionId);
  if (!plan) {
    throw new Error(`Unknown Google Play subscription SKU: ${subscriptionId}`);
  }

  const { data } = await androidpublisher.purchases.subscriptions.get({
    packageName: PACKAGE_NAME,
    subscriptionId,
    token: purchaseToken,
  });

  // paymentState: 0 = payment pending, 1 = paid, 2 = free trial, 3 = pending deferred upgrade
  if (data.paymentState !== 1 && data.paymentState !== 2) {
    throw new Error(`Google Play subscription is not active. paymentState=${data.paymentState}`);
  }

  const endsAt = toIsoDate(data.expiryTimeMillis);
  const status: SubscriptionStatus = data.paymentState === 2 ? "on_trial" : "active";
  const orderId = (data.orderId as string | undefined) ?? null;

  const supabase = await createSupabaseAdminClient();
  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      plan,
      status,
      provider: "google_play" as SubscriptionProvider,
      google_play_purchase_token: purchaseToken,
      google_play_subscription_id: subscriptionId,
      google_play_order_id: orderId,
      renews_at: endsAt,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
      display_name: null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  // Acknowledge the purchase so Google does not auto-refund it.
  // This is done after the entitlement is persisted so a DB failure does
  // not leave an acknowledged purchase without access.
  try {
    await androidpublisher.purchases.subscriptions.acknowledge({
      packageName: PACKAGE_NAME,
      subscriptionId,
      token: purchaseToken,
    });
  } catch (ackError) {
    // If the purchase was already acknowledged by a previous request, ignore.
    const message = ackError instanceof Error ? ackError.message : String(ackError);
    if (!message.toLowerCase().includes("already acknowledged")) {
      // eslint-disable-next-line no-console
      console.error("Failed to acknowledge Google Play purchase:", ackError);
    }
  }

  return {
    plan,
    status,
    provider: "google_play",
    purchaseToken,
    subscriptionId,
    orderId,
    endsAt,
  };
}
