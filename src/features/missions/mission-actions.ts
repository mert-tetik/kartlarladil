"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getChestRewardPoints, type ChestTier } from "@/features/quiz/chest-rewards";
import { MISSIONS, MISSIONS_BY_ID } from "./missions-data";
import {
  buildMissionViewModels,
  computeMissionProgress,
  deriveMissionStatus,
} from "./mission-progress";
import type {
  MissionProgressSnapshot,
  MissionReward,
  MissionStatus,
  UserMission,
} from "./mission-types";

interface DbUserMission {
  mission_id: string;
  progress: number;
  status: MissionStatus;
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
  message?: string;
}

function revalidateMissionPaths() {
  revalidatePath("/missions");
  revalidatePath("/profile");
  revalidatePath("/");
}

async function getAuthedSupabase() {
  const user = await requireAuthUser("/missions");
  const supabase = await createSupabaseServerClient();
  return { user, supabase };
}

async function fetchUserMissionRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<DbUserMission[]> {
  const { data, error } = await supabase
    .from("user_missions")
    .select("mission_id, progress, status, claimed_at")
    .eq("user_id", userId)
    .returns<DbUserMission[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
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

async function ensureAllMissionRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  snapshot: MissionProgressSnapshot,
): Promise<DbUserMission[]> {
  const existingRows = await fetchUserMissionRows(supabase, userId);
  const existingById = new Map(existingRows.map((row) => [row.mission_id, row]));
  const missingMissionIds: string[] = [];

  for (const mission of MISSIONS) {
    if (!existingById.has(mission.id)) {
      missingMissionIds.push(mission.id);
    }
  }

  if (missingMissionIds.length > 0) {
    const userMissionById = new Map(existingRows.map((row) => [row.mission_id, row]));
    const rows = missingMissionIds.map((missionId) => {
      const mission = MISSIONS_BY_ID.get(missionId)!;
      const index = mission.index;
      const previousMission = MISSIONS[index - 1];
      const previousClaimed = previousMission
        ? userMissionById.get(previousMission.id)?.status === "claimed"
        : true;
      const progress = computeMissionProgress(mission, snapshot);
      const status = deriveMissionStatus(mission, progress, previousClaimed);

      return {
        user_id: userId,
        mission_id: missionId,
        progress,
        status,
      };
    });

    const { error } = await supabase.from("user_missions").insert(rows);

    if (error) {
      throw error;
    }

    return fetchUserMissionRows(supabase, userId);
  }

  return existingRows;
}

export async function listUserMissionsAction(
  clientSnapshot: MissionProgressSnapshot,
): Promise<ListMissionsResult> {
  try {
    const { user, supabase } = await getAuthedSupabase();
    const snapshot = await fetchCloudMissionSnapshot(supabase, user.id, clientSnapshot);
    const rows = await ensureAllMissionRows(supabase, user.id, snapshot);

    const userMissions: UserMission[] = rows.map((row) => ({
      missionId: row.mission_id,
      progress: row.progress,
      status: row.status,
      claimedAt: row.claimed_at,
    }));

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, userMissions),
    };
  } catch (error) {
    return {
      status: "error",
      missions: [],
      message: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function claimMissionRewardAction(missionId: string): Promise<ClaimMissionResult> {
  try {
    const { user, supabase } = await getAuthedSupabase();
    const mission = MISSIONS_BY_ID.get(missionId);

    if (!mission) {
      return { status: "error", message: "invalid_mission" };
    }

    const { data: row, error: fetchError } = await supabase
      .from("user_missions")
      .select("status, progress")
      .eq("user_id", user.id)
      .eq("mission_id", missionId)
      .maybeSingle<Pick<DbUserMission, "status" | "progress">>();

    if (fetchError) {
      throw fetchError;
    }

    if (!row || row.status !== "waiting") {
      return { status: "error", message: "mission_not_claimable" };
    }

    const reward = mission.reward;
    const now = new Date().toISOString();

    if (reward.kind === "points") {
      const [{ error: updateError }, { error: rewardError }] = await Promise.all([
        supabase.rpc("increment_mission_points", {
          p_user_id: user.id,
          p_points: reward.amount,
        }),
        supabase.from("mission_rewards").insert({
          user_id: user.id,
          mission_id: missionId,
          reward_type: "points",
          points: reward.amount,
        }),
      ]);

      if (updateError) throw updateError;
      if (rewardError) throw rewardError;
    } else {
      const points = getChestRewardPoints(reward.tier);

      const [{ error: chestError }, { error: rewardError }, { error: missionError }] = await Promise.all([
        supabase.rpc("increment_chest_points", {
          p_user_id: user.id,
          p_points: points,
        }),
        supabase.from("chest_rewards").insert({
          user_id: user.id,
          tier: reward.tier,
          points,
        }),
        supabase.from("mission_rewards").insert({
          user_id: user.id,
          mission_id: missionId,
          reward_type: "chest",
          chest_tier: reward.tier,
          points,
        }),
      ]);

      if (chestError) throw chestError;
      if (rewardError) throw rewardError;
      if (missionError) throw missionError;
    }

    const { error: statusError } = await supabase
      .from("user_missions")
      .update({
        status: "claimed",
        claimed_at: now,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("mission_id", missionId);

    if (statusError) {
      throw statusError;
    }

    revalidateMissionPaths();

    if (reward.kind === "chest") {
      return {
        status: "success",
        reward,
        points: getChestRewardPoints(reward.tier),
        chestTier: reward.tier,
      };
    }

    return {
      status: "success",
      reward,
      points: reward.amount,
    };
  } catch (error) {
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
    const { user, supabase } = await getAuthedSupabase();
    const snapshot = await fetchCloudMissionSnapshot(supabase, user.id, clientSnapshot);
    const rows = await ensureAllMissionRows(supabase, user.id, snapshot);
    const userMissionById = new Map(rows.map((row) => [row.mission_id, row]));

    for (const mission of MISSIONS) {
      const row = userMissionById.get(mission.id);

      if (!row || row.status === "claimed") {
        continue;
      }

      const previousMission = MISSIONS[mission.index - 1];
      const previousClaimed = previousMission
        ? userMissionById.get(previousMission.id)?.status === "claimed"
        : true;
      const progress = computeMissionProgress(mission, snapshot);
      const status = deriveMissionStatus(mission, progress, previousClaimed);

      if (row.progress !== progress || row.status !== status) {
        const { error } = await supabase
          .from("user_missions")
          .update({ progress, status, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("mission_id", mission.id);

        if (error) {
          throw error;
        }
      }
    }

    revalidateMissionPaths();

    const updatedRows = await fetchUserMissionRows(supabase, user.id);
    const userMissions: UserMission[] = updatedRows.map((row) => ({
      missionId: row.mission_id,
      progress: row.progress,
      status: row.status,
      claimedAt: row.claimed_at,
    }));

    return {
      status: "success",
      missions: buildMissionViewModels(snapshot, userMissions),
    };
  } catch (error) {
    return {
      status: "error",
      missions: [],
      message: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
