"use server";

import { unstable_rethrow } from "next/navigation";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getUserEntitlementsOrNull } from "@/features/subscriptions/subscription-service";
import { throwSubscriptionGateUnavailable } from "@/features/subscriptions/subscription-gate-errors";
import { getPointsForLevel, isGameLevelLocked } from "@/features/games/game-levels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function addGamePointsAction(level: number): Promise<{ status: "success" | "error"; message?: string }> {
  try {
    if (!Number.isSafeInteger(level) || level < 1) {
      return { status: "error", message: "invalid_level" };
    }

    const user = await requireAuthUser("/games");
    if (isGameLevelLocked(level)) {
      const entitlements = await getUserEntitlementsOrNull(user.id);
      if (!entitlements) {
        return { status: "error", message: "subscription_unavailable" };
      }
      if (entitlements.effectivePlan !== "basic" && entitlements.effectivePlan !== "pro") {
        return { status: "error", message: "game_level_locked" };
      }
    }

    const points = getPointsForLevel(level);
    if (!Number.isInteger(points) || points <= 0 || points > 100_000) {
      return { status: "error", message: "invalid_points" };
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("increment_game_points", { p_user_id: user.id, p_points: points });
    if (error) {
      throwSubscriptionGateUnavailable("game_reward", error);
    }

    return { status: "success" };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", message: "game_reward_unavailable" };
  }
}
