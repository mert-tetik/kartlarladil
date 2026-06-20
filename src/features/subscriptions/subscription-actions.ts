"use server";

import {
  createCheckoutUrl,
  getVariantIdForPlan,
} from "@/features/subscriptions/lemon-squeezy";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
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
  } catch (error) {
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
  } catch (error) {
    const t = await getSubscriptionActionText();
    return {
      status: "error",
      message: t("pricing.error.checkoutFailed"),
    };
  }
}
