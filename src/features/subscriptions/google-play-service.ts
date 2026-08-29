import "server-only";

import { google } from "googleapis";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan, SubscriptionProvider, SubscriptionStatus } from "@/types/domain";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME;
const SERVICE_ACCOUNT_KEY_JSON = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON;

const GOOGLE_PLAY_PLAN_BY_SKU: Record<string, Exclude<SubscriptionPlan, "free">> = {
  basic_monthly: "basic",
  basic_yearly: "basic",
  pro_monthly: "pro",
  pro_yearly: "pro",
  "basic-monthly-first-month-free": "basic",
  "pro-monthly-one-month-free": "pro",
};

interface GooglePlayLineItem {
  productId?: string | null;
  expiryTime?: string | null;
}

interface GooglePlaySubscriptionV2 {
  subscriptionState?: string | null;
  latestOrderId?: string | null;
  linkedPurchaseToken?: string | null;
  lineItems?: GooglePlayLineItem[] | null;
}

export interface GooglePlayPublisher {
  purchases: {
    subscriptionsv2: {
      get: (params: { packageName: string; token: string }) => Promise<{ data: GooglePlaySubscriptionV2 }>;
    };
    subscriptions: {
      acknowledge: (params: {
        packageName: string;
        subscriptionId: string;
        token: string;
      }) => Promise<unknown>;
    };
  };
}

export interface GooglePlaySubscriptionVerification {
  plan: Exclude<SubscriptionPlan, "free">;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  purchaseToken: string;
  subscriptionId: string;
  orderId: string | null;
  endsAt: string | null;
  linkedPurchaseToken: string | null;
}

interface GooglePlayRtdnEventRow {
  processed_at: string | null;
}

function getPackageName(): string {
  if (!PACKAGE_NAME) {
    throw new Error("GOOGLE_PLAY_PACKAGE_NAME is not configured.");
  }

  return PACKAGE_NAME;
}

function getAndroidPublisher(): GooglePlayPublisher {
  if (!SERVICE_ACCOUNT_KEY_JSON) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_JSON is not configured.");
  }

  const credentials = JSON.parse(SERVICE_ACCOUNT_KEY_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });

  return google.androidpublisher({ version: "v3", auth }) as unknown as GooglePlayPublisher;
}

function resolvePlanFromSku(sku: string): Exclude<SubscriptionPlan, "free"> | null {
  return GOOGLE_PLAY_PLAN_BY_SKU[sku] ?? null;
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function toSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  switch (value) {
    case "SUBSCRIPTION_STATE_ACTIVE":
      return "active";
    case "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
      return "past_due";
    case "SUBSCRIPTION_STATE_CANCELED":
      return "cancelled";
    case "SUBSCRIPTION_STATE_PAUSED":
      return "paused";
    case "SUBSCRIPTION_STATE_ON_HOLD":
    case "SUBSCRIPTION_STATE_PENDING":
      return "unpaid";
    case "SUBSCRIPTION_STATE_EXPIRED":
    case "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED":
      return "expired";
    default:
      throw new Error(`Unknown Google Play subscription state: ${value ?? "missing"}`);
  }
}

function resolveSubscriptionLine(
  subscription: GooglePlaySubscriptionV2,
  expectedSku?: string,
): { line: GooglePlayLineItem; plan: Exclude<SubscriptionPlan, "free"> } {
  const candidates = (subscription.lineItems ?? [])
    .flatMap((line) => {
      const productId = line.productId ?? "";
      const plan = resolvePlanFromSku(productId);
      return plan ? [{ line, plan }] : [];
    })
    .sort((left, right) => {
      const leftExpiry = new Date(left.line.expiryTime ?? 0).getTime();
      const rightExpiry = new Date(right.line.expiryTime ?? 0).getTime();
      return rightExpiry - leftExpiry;
    });

  const match = expectedSku
    ? candidates.find(({ line }) => line.productId === expectedSku)
    : candidates[0];

  if (!match || !match.line.productId) {
    throw new Error("Google Play subscription does not contain a supported product.");
  }

  return match;
}

async function readGooglePlaySubscription(
  purchaseToken: string,
  expectedSku?: string,
  publisher?: GooglePlayPublisher,
): Promise<GooglePlaySubscriptionVerification> {
  const androidpublisher = publisher ?? getAndroidPublisher();
  const { data } = await androidpublisher.purchases.subscriptionsv2.get({
    packageName: getPackageName(),
    token: purchaseToken,
  });

  const { line, plan } = resolveSubscriptionLine(data, expectedSku);
  const status = toSubscriptionStatus(data.subscriptionState);
  const subscriptionId = line.productId!;

  return {
    plan,
    status,
    provider: "google_play",
    purchaseToken,
    subscriptionId,
    orderId: data.latestOrderId ?? null,
    endsAt: toIsoDate(line.expiryTime),
    linkedPurchaseToken: data.linkedPurchaseToken ?? null,
  };
}

async function claimGooglePlayPurchaseToken(
  verification: GooglePlaySubscriptionVerification,
  userId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error: insertError } = await supabase.from("google_play_purchase_tokens").insert({
    purchase_token: verification.purchaseToken,
    user_id: userId,
    subscription_id: verification.subscriptionId,
    order_id: verification.orderId,
    updated_at: new Date().toISOString(),
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  const { error: updateTokenError } = await supabase
    .from("google_play_purchase_tokens")
    .update({
      subscription_id: verification.subscriptionId,
      order_id: verification.orderId,
      updated_at: new Date().toISOString(),
    })
    .eq("purchase_token", verification.purchaseToken);

  if (updateTokenError) {
    throw updateTokenError;
  }

  const { error: accountError } = await supabase.from("google_play_purchase_accounts").upsert(
    {
      purchase_token: verification.purchaseToken,
      user_id: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "purchase_token,user_id" },
  );

  if (accountError) {
    throw accountError;
  }
}

async function persistGooglePlayEntitlement(
  verification: GooglePlaySubscriptionVerification,
  userId: string,
): Promise<void> {
  await claimGooglePlayPurchaseToken(verification, userId);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_subscriptions").upsert(
    {
      user_id: userId,
      plan: verification.plan,
      status: verification.status,
      provider: "google_play" as SubscriptionProvider,
      google_play_purchase_token: verification.purchaseToken,
      google_play_subscription_id: verification.subscriptionId,
      google_play_order_id: verification.orderId,
      renews_at: verification.endsAt,
      ends_at: verification.endsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}

async function acknowledgeGooglePlaySubscription(
  verification: GooglePlaySubscriptionVerification,
  publisher: GooglePlayPublisher,
): Promise<void> {
  if (!["active", "on_trial", "past_due"].includes(verification.status)) {
    return;
  }

  try {
    await publisher.purchases.subscriptions.acknowledge({
      packageName: getPackageName(),
      subscriptionId: verification.subscriptionId,
      token: verification.purchaseToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("already acknowledged")) {
      console.error("Failed to acknowledge Google Play purchase:", error);
    }
  }
}

/**
 * Verifies the purchase against Google's v2 subscription source of truth,
 * binds its globally unique token to the current FoxiesDeck account, and only
 * then persists the entitlement.
 */
export async function verifyGooglePlaySubscription(
  purchaseToken: string,
  subscriptionId: string,
  userId: string,
  publisher?: GooglePlayPublisher,
): Promise<GooglePlaySubscriptionVerification> {
  const expectedPlan = resolvePlanFromSku(subscriptionId);
  if (!expectedPlan) {
    throw new Error(`Unknown Google Play subscription SKU: ${subscriptionId}`);
  }

  const activePublisher = publisher ?? getAndroidPublisher();
  const verification = await readGooglePlaySubscription(purchaseToken, subscriptionId, activePublisher);

  if (verification.plan !== expectedPlan) {
    throw new Error("Google Play subscription plan does not match the requested product.");
  }

  await persistGooglePlayEntitlement(verification, userId);
  await acknowledgeGooglePlaySubscription(verification, activePublisher);

  return verification;
}

async function resolveGooglePlayPurchaseOwners(
  purchaseToken: string,
  linkedPurchaseToken: string | null,
): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const tokens = [purchaseToken, linkedPurchaseToken].filter((token): token is string => Boolean(token));
  const ownerIds = new Set<string>();

  for (const token of tokens) {
    const { data, error } = await supabase
      .from("google_play_purchase_accounts")
      .select("user_id")
      .eq("purchase_token", token);

    if (error) throw error;
    for (const row of data ?? []) {
      if (row.user_id) ownerIds.add(row.user_id);
    }
  }

  return [...ownerIds];
}

export async function syncGooglePlaySubscriptionFromRtdn(purchaseToken: string): Promise<string | null> {
  const publisher = getAndroidPublisher();
  const verification = await readGooglePlaySubscription(purchaseToken, undefined, publisher);
  const userIds = await resolveGooglePlayPurchaseOwners(
    verification.purchaseToken,
    verification.linkedPurchaseToken,
  );

  if (userIds.length === 0) {
    return null;
  }

  for (const userId of userIds) {
    await persistGooglePlayEntitlement(verification, userId);
  }
  await acknowledgeGooglePlaySubscription(verification, publisher);
  return userIds[0] ?? null;
}

export async function claimGooglePlayRtdnEvent(
  messageId: string,
  payload: unknown,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error: insertError } = await supabase.from("google_play_rtdn_events").insert({
    message_id: messageId,
    payload,
  });

  if (!insertError) {
    return true;
  }

  if (insertError.code !== "23505") {
    throw insertError;
  }

  const { data, error } = await supabase
    .from("google_play_rtdn_events")
    .select("processed_at")
    .eq("message_id", messageId)
    .maybeSingle<GooglePlayRtdnEventRow>();

  if (error) throw error;
  return !data?.processed_at;
}

export async function completeGooglePlayRtdnEvent(
  messageId: string,
  userId: string | null,
  errorMessage?: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("google_play_rtdn_events")
    .update({
      user_id: userId,
      processed_at: errorMessage ? null : new Date().toISOString(),
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("message_id", messageId);

  if (error) throw error;
}

export async function verifyGooglePlayRtdnToken(idToken: string): Promise<void> {
  const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE;
  const expectedEmail = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL;

  if (!audience || !expectedEmail) {
    throw new Error("Google Play RTDN environment variables are not configured.");
  }

  const ticket = await new google.auth.OAuth2().verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();

  if (!payload?.email_verified || payload.email !== expectedEmail) {
    throw new Error("Invalid Google Play RTDN identity.");
  }
}
