"use server";

import { requireAuthUser } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function addGamePointsAction(points: number): Promise<{ status: "success" | "error"; message?: string }> {
  try {
    if (!Number.isInteger(points) || points <= 0 || points > 100000) {
      return { status: "error", message: "invalid_points" };
    }
    const user = await requireAuthUser("/games");
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("increment_game_points", { p_user_id: user.id, p_points: points });
    if (error) return { status: "error", message: error.message };

    return { status: "success" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
  }
}
