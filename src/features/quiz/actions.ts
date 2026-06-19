"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChestTier } from "@/features/quiz/chest-rewards";
import { getChestRewardPoints } from "@/features/quiz/chest-rewards";

const VALID_TIERS = new Set<ChestTier>([
  "wood",
  "iron",
  "bronze",
  "silver",
  "gold",
  "diamond",
  "legendary",
]);

export interface AwardChestResult {
  success: boolean;
  points?: number;
  error?: string;
}

export async function awardChestPoints(tier: ChestTier): Promise<AwardChestResult> {
  if (!VALID_TIERS.has(tier)) {
    return { success: false, error: "invalid_tier" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "unauthorized" };
  }

  const points = getChestRewardPoints(tier);

  if (points <= 0) {
    return { success: false, error: "invalid_points" };
  }

  const [{ error: rewardError }, { error: incrementError }] = await Promise.all([
    supabase.from("chest_rewards").insert({
      user_id: user.id,
      tier,
      points,
    }),
    supabase.rpc("increment_chest_points", {
      p_user_id: user.id,
      p_points: points,
    }),
  ]);

  if (rewardError || incrementError) {
    return { success: false, error: "database_error" };
  }

  revalidatePath("/my-cards");
  revalidatePath("/profile");

  return { success: true, points };
}
