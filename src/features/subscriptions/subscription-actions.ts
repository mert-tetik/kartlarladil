"use server";

import {
  createCheckoutUrl,
  getVariantIdForPlan,
} from "@/features/subscriptions/lemon-squeezy";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { getRequestOrigin } from "@/features/auth/auth-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SubscriptionPlan, UserEntitlements } from "@/types/domain";

interface EntitlementsActionResult {
  status: "success" | "error";
  message: string;
  data?: UserEntitlements;
}

interface CheckoutActionResult {
  status: "success" | "error";
  message: string;
  checkoutUrl?: string;
}

export async function getUserEntitlementsAction(): Promise<EntitlementsActionResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        status: "error",
        message: "Oturum bulunamadı.",
      };
    }

    const entitlements = await getUserEntitlements(user.id);

    return {
      status: "success",
      message: "",
      data: entitlements,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Abonelik bilgisi alınamadı.",
    };
  }
}

export async function createCheckoutAction(
  _state: CheckoutActionResult,
  formData: FormData,
): Promise<CheckoutActionResult> {
  try {
    const plan = formData.get("plan") as SubscriptionPlan;

    if (plan !== "basic" && plan !== "pro") {
      return {
        status: "error",
        message: "Geçersiz plan seçildi.",
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
        message: "Ödeme için giriş yapmalısın.",
      };
    }

    const origin = await getRequestOrigin();
    const variantId = getVariantIdForPlan(plan);
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
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Ödeme bağlantısı oluşturulamadı.",
    };
  }
}
