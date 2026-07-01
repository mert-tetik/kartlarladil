"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/features/auth/auth-session";

export async function addGamePointsAction(points: number): Promise<{ status: "success" | "error"; message?: string }> {
  try {
    const user = await requireAuthUser("/games");
    const supabase = await createSupabaseServerClient();

    const { data: profile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("ai_practice_points")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      return { status: "error", message: fetchError.message };
    }

    const current = profile?.ai_practice_points ?? 0;
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ ai_practice_points: current + points })
      .eq("user_id", user.id);

    if (updateError) {
      return { status: "error", message: updateError.message };
    }

    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
  }
}
