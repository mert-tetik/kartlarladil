"use server";

import {
  createCheckoutUrl,
  fetchSubscription,
  getVariantIdForPlan,
} from "@/features/subscriptions/lemon-squeezy";
import { verifyGooglePlaySubscription } from "@/features/subscriptions/google-play-service";
import {
  getUserEntitlements,
  getUserSubscriptionManagementSource,
} from "@/features/subscriptions/subscription-service";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import { getRequestOrigin } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SubscriptionPlan, UserEntitlements } from "@/types/domain";

interface EntitlementsActionResult {
  status: "success" | "error";
  message: string;
  data?: UserEntitlements;
}

interface CheckoutActionResult {
  status: "idle" | "success" | "error";
  message: string;
  checkoutUrl?: string;
  customerPortalUrl?: string;
}

interface CustomerPortalActionResult {
  status: "idle" | "success" | "error";
  message: string;
  customerPortalUrl?: string;
}

async function getSubscriptionActionText() {
  return createTranslator(await getServerLocale());
}

export async function getUserEntitlementsAction(): Promise<EntitlementsActionResult> {
  try {
    const t = await getSubscriptionActionText();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        status: "error",
        message: t("pricing.error.authRequired"),
      };
    }

    const entitlements = await getUserEntitlements(user.id);

    return {
      status: "success",
      message: "",
      data: entitlements,
    };
  } catch {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.loadFailed"),
    };
  }
}

export async function createCheckoutAction(
  _state: CheckoutActionResult,
  formData: FormData,
): Promise<CheckoutActionResult> {
  try {
    const t = await getSubscriptionActionText();
    const plan = formData.get("plan") as SubscriptionPlan;
    const cycle = formData.get("cycle") as "monthly" | "yearly";

    if (plan !== "basic" && plan !== "pro") {
      return {
        status: "error",
        message: t("pricing.error.invalidPlan"),
      };
    }

    if (cycle !== "monthly" && cycle !== "yearly") {
      return {
        status: "error",
        message: t("pricing.error.invalidCycle"),
      };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return {
        status: "error",
        message: t("pricing.error.authRequired"),
      };
    }

    const entitlements = await getUserEntitlements(user.id);
    if (entitlements.effectivePlan !== "free") {
      let customerPortalUrl: string;

      try {
        customerPortalUrl = await getFreshCustomerPortalUrl(user.id);
      } catch {
        return {
          status: "error",
          message: t("pricing.error.customerPortalUnavailable"),
        };
      }

      return {
        status: "success",
        message: "",
        customerPortalUrl,
      };
    }

    const origin = await getRequestOrigin();
    const variantId = getVariantIdForPlan(plan, cycle);
    const checkoutUrl = await createCheckoutUrl({
      userId: user.id,
      email: user.email,
      variantId,
      returnUrl: `${origin}/pricing?checkout=success`,
    });

    return {
      status: "success",
      message: "",
      checkoutUrl,
    };
    } catch {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.checkoutFailed"),
    };
  }
}

export async function createCustomerPortalAction(
  _state: CustomerPortalActionResult,
  _formData?: FormData,
): Promise<CustomerPortalActionResult> {
  void _state;
  void _formData;

  try {
    const t = await getSubscriptionActionText();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        status: "error",
        message: t("pricing.error.authRequired"),
      };
    }

    const customerPortalUrl = await getFreshCustomerPortalUrl(user.id);

    return {
      status: "success",
      message: "",
      customerPortalUrl,
    };
  } catch {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.customerPortalUnavailable"),
    };
  }
}

interface GooglePlayPurchaseDetail {
  purchaseToken: string;
  productId: string;
}

export async function verifyGooglePlayPurchaseAction(
  purchaseToken: string,
  productId: string,
): Promise<EntitlementsActionResult> {
  try {
    const t = await getSubscriptionActionText();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        status: "error",
        message: t("pricing.error.authRequired"),
      };
    }

    await verifyGooglePlaySubscription(purchaseToken, productId, user.id);
    const entitlements = await getUserEntitlements(user.id);

    return {
      status: "success",
      message: "",
      data: entitlements,
    };
  } catch (error) {
    console.error("Google Play purchase verification failed:", error);
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: getGooglePlayErrorMessage(error, t("pricing.error.checkoutFailed")),
    };
  }
}

export async function syncGooglePlayPurchasesAction(
  purchases: GooglePlayPurchaseDetail[],
): Promise<EntitlementsActionResult> {
  try {
    const t = await getSubscriptionActionText();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        status: "error",
        message: t("pricing.error.authRequired"),
      };
    }

    let lastError: Error | null = null;

    for (const purchase of purchases) {
      try {
        await verifyGooglePlaySubscription(purchase.purchaseToken, purchase.productId, user.id);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue trying the rest; a stale/expired token should not block active ones.
      }
    }

    if (lastError && purchases.length > 0) {
      return {
        status: "error",
        message: lastError.message,
      };
    }

    const entitlements = await getUserEntitlements(user.id);

    return {
      status: "success",
      message: "",
      data: entitlements,
    };
  } catch {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.loadFailed"),
    };
  }
}

async function getFreshCustomerPortalUrl(userId: string): Promise<string> {
  const source = await getUserSubscriptionManagementSource(userId);

  if (source.effectivePlan === "free") {
    throw new Error("No active subscription is available for this user.");
  }

  if (source.provider === "google_play" && source.managementUrl) {
    return source.managementUrl;
  }

  if (!source.subscriptionId) {
    throw new Error("No active subscription is available for this user.");
  }

  const subscription = await fetchSubscription(source.subscriptionId);
  const customerPortalUrl = subscription?.attributes.urls?.customer_portal;

  if (!customerPortalUrl) {
    throw new Error("Lemon Squeezy subscription did not include a customer portal URL.");
  }

  return customerPortalUrl;
}
