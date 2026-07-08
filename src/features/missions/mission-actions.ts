"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getChestRewardPoints, type ChestTier } from "@/features/quiz/chest-rewards";
import { MISSIONS_BY_ID } from "./missions-data";
import { buildMissionViewModels } from "./mission-progress";
import type {
  MissionProgressSnapshot,
  MissionReward,
  UserMission,
} from "./mission-types";

interface DbUserMission {
  mission_id: string;
  claimed_at: string | null;
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
    const [snapshot, claimedIds] = await Promise.all([
      fetchCloudMissionSnapshot(supabase, userId, clientSnapshot),
      fetchClaimedMissionIds(supabase, userId),
    ]);

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, claimedIds),
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

export async function claimMissionRewardAction(missionId: string): Promise<ClaimMissionResult> {
  try {
    const authed = await getAuthedSupabase();

    if (!authed) {
      return { status: "error", message: "auth_required" };
    }

    const { userId, supabase } = authed;
    const mission = MISSIONS_BY_ID.get(missionId);

    if (!mission) {
      return { status: "error", message: "invalid_mission" };
    }

    const { data: row, error: fetchError } = await supabase
      .from("user_missions")
      .select("status")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .maybeSingle<{ status: string }>();

    if (fetchError) {
      throw fetchError;
    }

    if (row?.status === "claimed") {
      return { status: "error", message: "mission_already_claimed" };
    }

    const reward = mission.reward;
    const now = new Date().toISOString();

    if (reward.kind === "points") {
      const [{ error: updateError }, { error: rewardError }] = await Promise.all([
        supabase.rpc("increment_mission_points", {
          p_user_id: userId,
          p_points: reward.amount,
        }),
        supabase.from("mission_rewards").insert({
          user_id: userId,
          mission_id: missionId,
          reward_type: "points",
          points: reward.amount,
        }),
      ]);

      if (updateError) throw updateError;
      if (rewardError) throw rewardError;
    } else {
      const points = getChestRewardPoints(reward.tier);

      if (points <= 0) {
        return { status: "error", message: "invalid_chest_reward" };
      }

      const { error: chestIncError } = await supabase.rpc("increment_chest_points", {
        p_user_id: userId,
        p_points: points,
      });

      if (chestIncError) {
        console.error("increment_chest_points failed:", chestIncError);
        throw chestIncError;
      }

      const { error: chestRewardError } = await supabase.from("chest_rewards").insert({
        user_id: userId,
        tier: reward.tier,
        points,
      });

      if (chestRewardError) {
        console.error("chest_rewards insert failed:", chestRewardError);
        throw chestRewardError;
      }

      const { error: missionRewardError } = await supabase.from("mission_rewards").insert({
        user_id: userId,
        mission_id: missionId,
        reward_type: "chest",
        chest_tier: reward.tier,
        points,
      });

      if (missionRewardError) {
        console.error("mission_rewards insert failed:", missionRewardError);
        throw missionRewardError;
      }
    }

    const { error: upsertError } = await supabase
      .from("user_missions")
      .upsert(
        {
          user_id: userId,
          mission_id: missionId,
          progress: mission.requirement,
          status: "claimed",
          claimed_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,mission_id" },
      );

    if (upsertError) {
      throw upsertError;
    }

    revalidateMissionPaths();

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("mission_points, chest_points")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    return {
      status: "success",
      reward,
      points: reward.kind === "chest" ? getChestRewardPoints(reward.tier) : reward.amount,
      missionPoints: profile?.mission_points ?? 0,
      chestPoints: profile?.chest_points ?? 0,
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
    const [snapshot, claimedIds] = await Promise.all([
      fetchCloudMissionSnapshot(supabase, userId, clientSnapshot),
      fetchClaimedMissionIds(supabase, userId),
    ]);

    revalidateMissionPaths();

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, claimedIds),
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
