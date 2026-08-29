"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChestTier } from "@/features/quiz/chest-rewards";
import { getChestRewardPoints } from "@/features/quiz/chest-rewards";
import { getQuizStreakRewardPoints, getRewardableQuizStreak } from "@/features/quiz/streak-rewards";

const VALID_TIERS = new Set<ChestTier>([
  "wood",
  "iron",
  "gold",
  "diamond",
  "emerald",
  "ruby",
]);

export interface AwardChestResult {
  success: boolean;
  points?: number;
  error?: string;
}

export interface AwardQuizStreakResult {
  success: boolean;
  awarded?: boolean;
  points?: number;
  streak?: number;
  error?: string;
}

export interface AwardQuizResultPointsResult {
  success: boolean;
  awarded?: boolean;
  points?: number;
  error?: string;
}

const QUIZ_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function awardQuizStreakPoints(sessionId: string, rawStreak: number): Promise<AwardQuizStreakResult> {
  const streak = getRewardableQuizStreak(rawStreak);
  const points = getQuizStreakRewardPoints(rawStreak);

  if (!QUIZ_SESSION_ID_PATTERN.test(sessionId)) {
    return { success: false, error: "invalid_session" };
  }

  if (streak <= 0 || points <= 0) {
    return { success: false, error: "invalid_points" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "unauthorized" };
  }

  const { data, error } = await supabase.rpc("award_quiz_streak_points", {
    p_user_id: user.id,
    p_session_id: sessionId,
    p_streak: streak,
    p_points: points,
  });

  if (error) {
    return { success: false, error: "database_error" };
  }

  revalidatePath("/learn");
  revalidatePath("/profile");

  return { success: true, awarded: Boolean(data), points, streak };
}

export async function awardQuizResultPoints(
  sessionId: string,
  rawStars: number,
): Promise<AwardQuizResultPointsResult> {
  if (!QUIZ_SESSION_ID_PATTERN.test(sessionId)) {
    return { success: false, error: "invalid_session" };
  }

  const stars = Math.round(rawStars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { success: false, error: "invalid_points" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "unauthorized" };
  }

  const { data, error } = await supabase.rpc("award_quiz_result_points", {
    p_user_id: user.id,
    p_session_id: sessionId,
    p_stars: stars,
  });

  if (error) {
    return { success: false, error: "database_error" };
  }

  revalidatePath("/learn");
  revalidatePath("/profile");

  return { success: true, awarded: Boolean(data), points: stars };
}
