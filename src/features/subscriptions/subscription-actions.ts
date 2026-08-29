"use server";

import { verifyGooglePlaySubscription } from "@/features/subscriptions/google-play-service";
import { GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@/features/subscriptions/google-play-links";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserEntitlements } from "@/types/domain";

interface EntitlementsActionResult {
  status: "success" | "error";
  message: string;
  data?: UserEntitlements;
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

/** Google Play is the only subscription provider for new purchases. */
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

    const entitlements = await getUserEntitlements(user.id);
    if (entitlements.effectivePlan === "free") {
      return {
        status: "error",
        message: t("pricing.error.customerPortalUnavailable"),
      };
    }

    return {
      status: "success",
      message: "",
      customerPortalUrl: GOOGLE_PLAY_SUBSCRIPTIONS_URL,
    };
  } catch {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.customerPortalUnavailable"),
    };
  }
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

    if (!isValidPurchaseValue(purchaseToken) || !isValidPurchaseValue(productId)) {
      return {
        status: "error",
        message: t("pricing.error.checkoutFailed"),
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
      message: getGooglePlayErrorMessage(
        error,
        t("pricing.error.checkoutFailed"),
        t("pricing.error.clientAppUnavailable"),
      ),
    };
  }
}

interface GooglePlayPurchaseDetail {
  purchaseToken: string;
  productId: string;
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

    const validPurchases = purchases.filter(
      (purchase) =>
        isValidPurchaseValue(purchase.purchaseToken) && isValidPurchaseValue(purchase.productId),
    );

    let lastError: Error | null = null;
    let verificationCount = 0;

    for (const purchase of validPurchases) {
      try {
        await verifyGooglePlaySubscription(purchase.purchaseToken, purchase.productId, user.id);
        verificationCount += 1;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue trying the rest; a stale/expired token should not block active ones.
      }
    }

    if (lastError && verificationCount === 0) {
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

function isValidPurchaseValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 4096;
}
