"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getChestRewardPoints, type ChestTier } from "@/features/quiz/chest-rewards";
import { normalizeGemRewards, type GemBalances, type GemRewards, type GemType } from "@/features/gems/gem-types";
import { MISSIONS_BY_ID } from "./missions-data";
import { buildMissionViewModels } from "./mission-progress";
import type {
  MissionProgressSnapshot,
  MissionReward,
  MissionRewardOverrides,
  UserMission,
} from "./mission-types";

interface DbUserMission {
  mission_id: string;
  claimed_at: string | null;
}

interface DbMissionReward {
  mission_id: string;
  reward_type: "chest" | "points";
  chest_tier: ChestTier | null;
  points: number;
  created_at: string;
}

interface DbMissionClaimResult {
  claimed: boolean;
  mission_points: number | null;
  chest_points: number | null;
  gem_rewards: unknown;
  blue_gems: number | null;
  green_gems: number | null;
  purple_gems: number | null;
}

export interface ListMissionsResult {
  status: "success" | "error";
  missions: Array<UserMission & { definition: import("./mission-types").MissionDefinition; requirement: number }>;
  message?: string;
}

export interface ClaimMissionResult {
  status: "success" | "error";
  reward?: MissionReward;
  points?: number;
  chestTier?: ChestTier;
  missionPoints?: number;
  chestPoints?: number;
  gemType?: GemType;
  gemAmount?: number;
  gemRewards?: GemRewards;
  balances?: GemBalances;
  blueGems?: number;
  greenGems?: number;
  purpleGems?: number;
  message?: string;
}

function revalidateMissionPaths() {
  revalidatePath("/missions");
  revalidatePath("/profile");
  revalidatePath("/");
}

async function getAuthedSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user?.id || !session.user.email) {
    return null;
  }

  return { userId: session.user.id, supabase };
}

async function fetchClaimedMissionIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("mission_id")
    .eq("user_id", userId)
    .eq("status", "claimed")
    .returns<Pick<DbUserMission, "mission_id">[]>();

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.mission_id));
}

async function fetchMissionRewardOverrides(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  claimedMissionIds: Set<string>,
): Promise<MissionRewardOverrides> {
  if (claimedMissionIds.size === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("mission_rewards")
    .select("mission_id, reward_type, chest_tier, points, created_at")
    .eq("user_id", userId)
    .in("mission_id", Array.from(claimedMissionIds))
    .order("created_at", { ascending: false })
    .returns<DbMissionReward[]>();

  if (error) {
    throw error;
  }

  const overrides = new Map<string, MissionReward>();

  for (const row of data ?? []) {
    if (overrides.has(row.mission_id)) continue;

    if (row.reward_type === "points" && Number.isFinite(row.points) && row.points >= 0) {
      overrides.set(row.mission_id, { kind: "points", amount: row.points });
      continue;
    }

    if (row.reward_type === "chest" && row.chest_tier && getChestRewardPoints(row.chest_tier) > 0) {
      overrides.set(row.mission_id, { kind: "chest", tier: row.chest_tier });
    }
  }

  return overrides;
}

async function fetchCloudMissionSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  clientSnapshot: MissionProgressSnapshot,
): Promise<MissionProgressSnapshot> {
  const [{ count: totalCards }, { count: learnedCards }, { data: practicedCharacters }] = await Promise.all([
    supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_cards").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "learned"),
    supabase.from("ai_practice_scores").select("character_id").eq("user_id", userId),
  ]);

  return {
    totalCards: totalCards ?? clientSnapshot.totalCards,
    learnedCards: learnedCards ?? clientSnapshot.learnedCards,
    bestMemoryLevel: clientSnapshot.bestMemoryLevel,
    bestWordChallengeLevel: clientSnapshot.bestWordChallengeLevel,
    bestWordMatchLevel: clientSnapshot.bestWordMatchLevel,
    practicedCharacterIds: new Set((practicedCharacters ?? []).map((row) => row.character_id as string)),
  };
}

async function fetchMissionData(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  clientSnapshot: MissionProgressSnapshot,
): Promise<{
  snapshot: MissionProgressSnapshot;
  claimedIds: Set<string>;
  rewardOverrides: MissionRewardOverrides;
}> {
  const [snapshot, claimedIds] = await Promise.all([
    fetchCloudMissionSnapshot(supabase, userId, clientSnapshot),
    fetchClaimedMissionIds(supabase, userId),
  ]);
  const rewardOverrides = await fetchMissionRewardOverrides(supabase, userId, claimedIds);

  return { snapshot, claimedIds, rewardOverrides };
}

export async function listUserMissionsAction(
  clientSnapshot: MissionProgressSnapshot,
): Promise<ListMissionsResult> {
  try {
    const authed = await getAuthedSupabase();

    if (!authed) {
      return {
        status: "error",
        missions: [],
        message: "auth_required",
      };
    }

    const { userId, supabase } = authed;
    const { snapshot, claimedIds, rewardOverrides } = await fetchMissionData(
      supabase,
      userId,
      clientSnapshot,
    );

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, claimedIds, rewardOverrides),
    };
  } catch (error) {
    console.error("listUserMissionsAction failed:", error);
    return {
      status: "error",
      missions: [],
      message: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function claimMissionRewardAction(
  missionId: string,
  expectedUserId?: string,
): Promise<ClaimMissionResult> {
  try {
    const authed = await getAuthedSupabase();

    if (!authed) {
      return { status: "error", message: "auth_required" };
    }

    const { userId } = authed;
    if (expectedUserId && expectedUserId !== userId) {
      return { status: "error", message: "auth_required" };
    }
    const mission = MISSIONS_BY_ID.get(missionId);

    if (!mission) {
      return { status: "error", message: "invalid_mission" };
    }

    const reward = mission.reward;
    const points = reward.kind === "chest" ? getChestRewardPoints(reward.tier) : reward.amount;
    if (points <= 0) {
      return { status: "error", message: reward.kind === "chest" ? "invalid_chest_reward" : "invalid_points_reward" };
    }

    const adminSupabase = createSupabaseAdminClient();
    const { data, error } = await adminSupabase
      .rpc("claim_mission_reward_with_gem_rewards", {
        p_user_id: userId,
        p_mission_id: missionId,
        p_reward_type: reward.kind,
        p_chest_tier: reward.kind === "chest" ? reward.tier : null,
        p_points: points,
        p_progress: mission.requirement,
      })
      .maybeSingle<DbMissionClaimResult>();

    if (error) {
      throw error;
    }

    const claim = data;
    if (!claim) {
      throw new Error("mission_claim_empty");
    }

    if (!claim.claimed) {
      return { status: "error", message: "mission_already_claimed" };
    }

    const gemRewards = normalizeGemRewards(claim.gem_rewards);

    revalidateMissionPaths();

    return {
      status: "success",
      reward,
      points,
      missionPoints: claim.mission_points ?? 0,
      chestPoints: claim.chest_points ?? 0,
      ...(reward.kind === "chest" && gemRewards.length
        ? {
            gemRewards,
            gemType: gemRewards[0]?.type,
            gemAmount: gemRewards[0]?.amount,
            balances: {
              blue: claim.blue_gems ?? 0,
              green: claim.green_gems ?? 0,
              purple: claim.purple_gems ?? 0,
            },
            blueGems: claim.blue_gems ?? 0,
            greenGems: claim.green_gems ?? 0,
            purpleGems: claim.purple_gems ?? 0,
          }
        : {}),
      ...(reward.kind === "chest" ? { chestTier: reward.tier } : {}),
    };
  } catch (error) {
    console.error("claimMissionRewardAction failed:", error);
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function syncMissionProgressAction(
  clientSnapshot: MissionProgressSnapshot,
): Promise<ListMissionsResult> {
  try {
    const authed = await getAuthedSupabase();

    if (!authed) {
      return {
        status: "error",
        missions: [],
        message: "auth_required",
      };
    }

    const { userId, supabase } = authed;
    const { snapshot, claimedIds, rewardOverrides } = await fetchMissionData(
      supabase,
      userId,
      clientSnapshot,
    );

    revalidateMissionPaths();

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, claimedIds, rewardOverrides),
    };
  } catch (error) {
    console.error("syncMissionProgressAction failed:", error);
    return {
      status: "error",
      missions: [],
      message: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
