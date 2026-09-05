"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getChestRewardPoints, type ChestTier } from "@/features/quiz/chest-rewards";
import { QUIZ_COUNT_OPTIONS } from "@/features/quiz/chest-rewards";
import { normalizeGemRewards, type ChestRewardOutcome, type GemBalances, type GemReward, type GemRewards, type GemType, type ProgressGemRewardSource } from "./gem-types";

const GEM_TYPES = new Set<GemType>(["blue", "green", "purple"]);
const CHEST_TIERS = new Set<ChestTier>(["wood", "iron", "gold", "diamond", "emerald", "ruby"]);
const KEY_PATTERN = /^[a-z0-9:_-]{1,160}$/i;
const SOURCE_KEY_PATTERN = /^[^\u0000-\u001f\u007f\s]{1,240}$/;
const PROGRESS_GEM_CLAIM_PATTERN = /^[a-z0-9:_-]{1,160}$/i;
const PROGRESS_GEM_SOURCES = new Set<ProgressGemRewardSource>(["game-level", "quiz-streak", "quiz-result"]);

function readBalances(row: { blue_gems?: number | null; green_gems?: number | null; purple_gems?: number | null }): GemBalances {
  return { blue: row.blue_gems ?? 0, green: row.green_gems ?? 0, purple: row.purple_gems ?? 0 };
}

export interface AwardProgressGemRewardInput {
  source: ProgressGemRewardSource;
  claimKey: string;
  level?: number;
  streak?: number;
  stars?: number;
  cardCount?: number;
}

export interface AwardProgressGemRewardResult {
  success: boolean;
  awarded?: boolean;
  rewards?: GemRewards;
  /** @deprecated Use rewards. Kept for callers that still display one reward. */
  reward?: GemReward;
  balances?: GemBalances;
  error?: string;
}

export async function awardProgressGemRewardAction(
  input: AwardProgressGemRewardInput,
): Promise<AwardProgressGemRewardResult> {
  const { source, claimKey, level, streak, stars, cardCount } = input;
  if (
    !PROGRESS_GEM_SOURCES.has(source) ||
    !PROGRESS_GEM_CLAIM_PATTERN.test(claimKey) ||
    (source === "game-level" && (!Number.isInteger(level) || level! < 1 || level! > 1000)) ||
    (source === "quiz-streak" && (!Number.isInteger(streak) || streak! < 5 || streak! > 10000)) ||
    (source === "quiz-result" && (
      !Number.isInteger(stars) ||
      stars! < 1 ||
      stars! > 5 ||
      !Number.isInteger(cardCount) ||
      !QUIZ_COUNT_OPTIONS.includes(cardCount as (typeof QUIZ_COUNT_OPTIONS)[number])
    ))
  ) {
    return { success: false, error: "invalid_gem_reward" };
  }

  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("award_progress_gem_rewards", {
      p_user_id: user.id,
      p_claim_key: claimKey,
      p_source: source,
      p_level: level ?? null,
      p_streak: streak ?? null,
      p_stars: stars ?? null,
      p_card_count: cardCount ?? null,
    }).maybeSingle<{
      awarded: boolean;
      rewards: unknown;
      blue_gems: number;
      green_gems: number;
      purple_gems: number;
    }>();

    if (error || !data) {
      return { success: false, error: error?.message ?? "database_error" };
    }

    const rewards = normalizeGemRewards(data.rewards);

    revalidatePath("/");
    revalidatePath("/games");
    revalidatePath("/learn");
    revalidatePath("/profile");

    return {
      success: true,
      awarded: data.awarded,
      rewards,
      reward: rewards[0],
      balances: readBalances(data),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "database_error" };
  }
}

export async function awardChestGemRewardAction(
  tier: ChestTier,
  claimKey: string,
): Promise<{ success: boolean; outcome?: ChestRewardOutcome; awarded?: boolean; error?: string }> {
  if (!CHEST_TIERS.has(tier) || !KEY_PATTERN.test(claimKey)) return { success: false, error: "invalid_chest_reward" };
  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("award_chest_gem_rewards", {
      p_user_id: user.id,
      p_claim_key: claimKey,
      p_tier: tier,
    }).maybeSingle<{ awarded: boolean; rewards: unknown; blue_gems: number; green_gems: number; purple_gems: number }>();
    if (error || !data) return { success: false, error: error?.message ?? "database_error" };
    const rewards = normalizeGemRewards(data.rewards);
    revalidatePath("/");
    revalidatePath("/profile");
    return {
      success: true,
      awarded: data.awarded,
      outcome: {
        points: getChestRewardPoints(tier),
        rewards,
        balances: readBalances(data),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "database_error" };
  }
}

export async function convertGemToPointsAction(type: GemType): Promise<{ success: boolean; points?: number; balances?: GemBalances; error?: string }> {
  if (!GEM_TYPES.has(type)) return { success: false, error: "invalid_gem" };
  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("convert_gem_to_points", {
      p_user_id: user.id, p_gem_type: type, p_idempotency_key: `convert:${randomUUID()}`,
    }).maybeSingle<{ success: boolean; points: number; blue_gems: number; green_gems: number; purple_gems: number }>();
    if (error || !data) return { success: false, error: error?.message ?? "database_error" };
    revalidatePath("/"); revalidatePath("/profile");
    return { success: data.success, points: data.points, balances: readBalances(data) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "database_error" }; }
}

export async function spendGemAction(type: GemType, amount: number, reason: string): Promise<{ success: boolean; balances?: GemBalances; error?: string }> {
  if (!GEM_TYPES.has(type) || !Number.isInteger(amount) || amount <= 0 || !KEY_PATTERN.test(reason)) return { success: false, error: "invalid_gem_spend" };
  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("spend_gem", { p_user_id: user.id, p_gem_type: type, p_amount: amount, p_reason: reason, p_idempotency_key: `spend:${randomUUID()}` }).maybeSingle<{ success: boolean; blue_gems: number; green_gems: number; purple_gems: number }>();
    if (error || !data) return { success: false, error: error?.message ?? "database_error" };
    revalidatePath("/");
    return { success: data.success, balances: readBalances(data) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "database_error" }; }
}

export async function removeCardWithGemAction(sourceKey: string): Promise<{ success: boolean; balances?: GemBalances; error?: string }> {
  if (!SOURCE_KEY_PATTERN.test(sourceKey)) return { success: false, error: "invalid_card" };
  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("spend_gem_and_remove_card", { p_user_id: user.id, p_source_key: sourceKey, p_cost: 10 }).maybeSingle<{ success: boolean; blue_gems: number; green_gems: number; purple_gems: number }>();
    if (error || !data) return { success: false, error: error?.message ?? "database_error" };
    revalidatePath("/"); revalidatePath("/my-cards");
    return { success: data.success, balances: readBalances(data) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "database_error" }; }
}

export async function markCardLearnedWithGemAction(sourceKey: string): Promise<{ success: boolean; balances?: GemBalances; error?: string }> {
  if (!SOURCE_KEY_PATTERN.test(sourceKey)) return { success: false, error: "invalid_card" };
  try {
    const user = await requireAuthUser("/");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("spend_gem_and_mark_card_learned", { p_user_id: user.id, p_source_key: sourceKey, p_cost: 2 }).maybeSingle<{ success: boolean; blue_gems: number; green_gems: number; purple_gems: number }>();
    if (error || !data) return { success: false, error: error?.message ?? "database_error" };
    revalidatePath("/"); revalidatePath("/my-cards"); revalidatePath("/learn");
    return { success: data.success, balances: readBalances(data) };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "database_error" }; }
}

export async function addGamePointsActionV2(points: number): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(points) || points <= 0 || points > 100000) return { success: false, error: "invalid_points" };
  try {
    const user = await requireAuthUser("/games");
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc("increment_game_points", { p_user_id: user.id, p_points: points });
    return error ? { success: false, error: error.message } : { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "database_error" }; }
}
