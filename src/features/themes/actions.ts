"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { THEMES, isPaidPlan } from "@/lib/themes";

export type UpdateThemeResult =
  | { status: "success" }
  | { status: "error"; code: "unauthenticated" | "free_plan" | "invalid_theme" | "unknown" };

export async function updateThemeAction(themeId: string): Promise<UpdateThemeResult> {
  const user = await getCurrentAuthUser();

  if (!user) {
    return { status: "error", code: "unauthenticated" };
  }

  if (!THEMES.some((theme) => theme.id === themeId)) {
    return { status: "error", code: "invalid_theme" };
  }

  const entitlements = await getUserEntitlements(user.id);

  if (!isPaidPlan(entitlements.effectivePlan)) {
    return { status: "error", code: "free_plan" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ theme: themeId })
    .eq("user_id", user.id);

  if (error) {
    return { status: "error", code: "unknown" };
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/account/settings");

  return { status: "success" };
}
