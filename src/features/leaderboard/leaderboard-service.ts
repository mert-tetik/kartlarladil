import "server-only";

import { getRankForPoints } from "@/features/progress/progress-stats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/types/domain";
import type { LeaderboardEntry, LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";

interface LeaderboardProfileRow {
  user_id: string;
  display_name: string | null;
  ai_practice_points: number | null;
  chest_points: number | null;
  streak_points: number | null;
  mission_points: number | null;
  leaderboard_visible: boolean | null;
  profile_picture_index: number | null;
}

interface LearnedCardRow {
  user_id: string;
  card_source_key: string;
}

const TIER_POINT_MAP: Record<Tier, number> = {
  A1: 10,
  A2: 20,
  B1: 40,
  B2: 50,
  C1: 100,
};

export async function getLeaderboardPayload(viewerUserId: string): Promise<LeaderboardPayload> {
  const admin = createSupabaseAdminClient();
  const { data: profiles, error: profileError } = await admin
    .from("user_profiles")
    .select("*");

  if (profileError || !profiles?.length) {
    return createEmptyLeaderboardPayload(viewerUserId);
  }

  const viewerProfile = profiles.find((profile) => profile.user_id === viewerUserId);

  if (!viewerProfile) {
    return createEmptyLeaderboardPayload(viewerUserId);
  }

  const userIds = profiles.map((profile) => profile.user_id);
  const { data: learnedCards, error: learnedError } = await admin
    .from("user_cards")
    .select("user_id, card_source_key")
    .in("user_id", userIds)
    .eq("status", "learned");

  if (learnedError) {
    return createEmptyLeaderboardPayload(viewerUserId, viewerProfile);
  }

  const learnedPointsByUser = new Map<string, number>();

  for (const row of (learnedCards ?? []) as LearnedCardRow[]) {
    const tier = parseTierFromSourceKey(row.card_source_key);
    if (!tier) {
      continue;
    }

    learnedPointsByUser.set(
      row.user_id,
      (learnedPointsByUser.get(row.user_id) ?? 0) + TIER_POINT_MAP[tier],
    );
  }

  const scoredProfiles = profiles
    .map((profile) => {
      const totalPoints =
        (learnedPointsByUser.get(profile.user_id) ?? 0) +
        (profile.ai_practice_points ?? 0) +
        (profile.chest_points ?? 0) +
        (profile.streak_points ?? 0) +
        (profile.mission_points ?? 0);

      return {
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        profilePictureIndex:
          typeof profile.profile_picture_index === "number" &&
          Number.isInteger(profile.profile_picture_index) &&
          profile.profile_picture_index >= 0 &&
          profile.profile_picture_index <= 18
            ? profile.profile_picture_index
            : null,
        totalPoints,
        leaderboardVisible: profile.leaderboard_visible ?? false,
      };
    })
    .sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      return left.userId.localeCompare(right.userId);
    });

  const viewerIndex = scoredProfiles.findIndex((profile) => profile.userId === viewerUserId);
  const viewer = scoredProfiles[viewerIndex];

  if (!viewer) {
    return createEmptyLeaderboardPayload(viewerUserId, viewerProfile);
  }

  const entries: LeaderboardEntry[] = viewer.leaderboardVisible
    ? scoredProfiles
        .map((profile, index) => ({
          userId: profile.userId,
          position: index + 1,
          displayName: profile.leaderboardVisible ? (profile.displayName ?? "") : "",
          profilePictureIndex: profile.profilePictureIndex,
          totalPoints: profile.totalPoints,
          rankIcon: getRankForPoints(profile.totalPoints).icon,
          isViewer: profile.userId === viewerUserId,
        }))
        
    : [];

  return {
    viewer: {
      userId: viewer.userId,
      position: viewerIndex + 1,
      displayName: viewer.displayName ?? "",
      totalPoints: viewer.totalPoints,
      leaderboardVisible: viewer.leaderboardVisible,
    },
    entries,
    canViewLeaderboard: viewer.leaderboardVisible,
  };
}

function createEmptyLeaderboardPayload(
  viewerUserId: string,
  viewerProfile?: LeaderboardProfileRow,
): LeaderboardPayload {
  return {
    viewer: {
      userId: viewerUserId,
      position: 1,
      displayName: viewerProfile?.display_name?.trim() || "",
      totalPoints:
        (viewerProfile?.ai_practice_points ?? 0) +
        (viewerProfile?.chest_points ?? 0) +
        (viewerProfile?.streak_points ?? 0) +
        (viewerProfile?.mission_points ?? 0),
      leaderboardVisible: viewerProfile?.leaderboard_visible ?? false,
    },
    entries: [],
    canViewLeaderboard: false,
  };
}

function parseTierFromSourceKey(sourceKey: string): Tier | null {
  const tier = sourceKey.split(":")[1];

  if (
    tier === "A1" ||
    tier === "A2" ||
    tier === "B1" ||
    tier === "B2" ||
    tier === "C1"
  ) {
    return tier;
  }

  return null;
}
