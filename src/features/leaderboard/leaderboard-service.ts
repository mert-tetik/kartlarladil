import "server-only";

import { getRankForPoints } from "@/features/progress/progress-stats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getProfilePointTotal } from "@/features/progress/point-sources";
import type { Tier } from "@/types/domain";
import type {
  LeaderboardEntry,
  LeaderboardMode,
  LeaderboardPayload,
} from "@/features/leaderboard/leaderboard-types";

interface LeaderboardProfileRow {
  user_id: string;
  display_name: string | null;
  ai_practice_points: number | null;
  chest_points: number | null;
  streak_points: number | null;
  mission_points: number | null;
  quiz_result_points: number | null;
  game_points: number | null;
  gem_points: number | null;
  leaderboard_visible: boolean | null;
  profile_picture_index: number | null;
}

interface LearnedCardRow {
  user_id: string;
  card_source_key: string;
}

interface CustomCardTierRow {
  user_id: string;
  source_key: string;
  tier: string;
}

interface DailyLoginRow {
  user_id: string;
  activity_date: string;
}

const TIER_POINT_MAP: Record<Tier, number> = {
  A1: 10,
  A2: 20,
  B1: 40,
  B2: 50,
  C1: 100,
};

const SUPABASE_PAGE_SIZE = 1000;

async function readAllRows<T>(
  loadPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) return rows;
  }
}

export async function getLeaderboardPayload(
  viewerUserId: string,
  mode: LeaderboardMode = "points",
): Promise<LeaderboardPayload> {
  const admin = createSupabaseAdminClient();
  let profiles: LeaderboardProfileRow[];
  try {
    profiles = await readAllRows((from, to) =>
      admin.from("user_profiles").select("*").range(from, to).returns<LeaderboardProfileRow[]>(),
    );
  } catch {
    return createEmptyLeaderboardPayload(viewerUserId, mode);
  }

  if (!profiles.length) {
    return createEmptyLeaderboardPayload(viewerUserId, mode);
  }

  const viewerProfile = profiles.find((profile) => profile.user_id === viewerUserId);

  if (!viewerProfile) {
    return createEmptyLeaderboardPayload(viewerUserId, mode);
  }

  let learnedCards: LearnedCardRow[];
  let customCards: CustomCardTierRow[];
  let dailyLogins: DailyLoginRow[];
  try {
    [learnedCards, customCards, dailyLogins] = await Promise.all([
      readAllRows((from, to) =>
        admin
          .from("user_cards")
          .select("user_id, card_source_key")
          .eq("status", "learned")
          .range(from, to)
          .returns<LearnedCardRow[]>(),
      ),
      readAllRows((from, to) =>
        admin
          .from("custom_cards")
          .select("user_id, source_key, tier")
          .range(from, to)
          .returns<CustomCardTierRow[]>(),
      ),
      readAllRows((from, to) =>
        admin
          .from("user_daily_logins")
          .select("user_id, activity_date")
          .range(from, to)
          .returns<DailyLoginRow[]>(),
      ),
    ]);
  } catch {
    return createEmptyLeaderboardPayload(viewerUserId, mode, viewerProfile);
  }

  const customTierBySourceKey = new Map(
    customCards.map((card) => [card.source_key, card.tier]),
  );
  const learnedPointsByUser = new Map<string, number>();

  for (const row of learnedCards) {
    const tier =
      parseTierFromSourceKey(row.card_source_key) ??
      parseTier(customTierBySourceKey.get(row.card_source_key));
    if (!tier) {
      continue;
    }

    learnedPointsByUser.set(
      row.user_id,
      (learnedPointsByUser.get(row.user_id) ?? 0) + TIER_POINT_MAP[tier],
    );
  }

  const longestStreakByUser = getLongestStreakByUser(dailyLogins);

  const scoredProfiles = profiles
    .map((profile) => {
      const totalPoints = (learnedPointsByUser.get(profile.user_id) ?? 0) + getProfilePointTotal({
        aiPracticePoints: profile.ai_practice_points ?? 0,
        chestPoints: profile.chest_points ?? 0,
        streakPoints: profile.streak_points ?? 0,
        missionPoints: profile.mission_points ?? 0,
        quizResultPoints: profile.quiz_result_points ?? 0,
        gamePoints: profile.game_points ?? 0,
        gemPoints: profile.gem_points ?? 0,
      });
      const leaderboardValue =
        mode === "streaks"
          ? (longestStreakByUser.get(profile.user_id) ?? 0)
          : totalPoints;

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
        streak: longestStreakByUser.get(profile.user_id) ?? 0,
        leaderboardValue,
        leaderboardVisible: profile.leaderboard_visible ?? false,
      };
    })
    .sort((left, right) => {
      if (right.leaderboardValue !== left.leaderboardValue) {
        return right.leaderboardValue - left.leaderboardValue;
      }

      return left.userId.localeCompare(right.userId);
    });

  const viewerIndex = scoredProfiles.findIndex((profile) => profile.userId === viewerUserId);
  const viewer = scoredProfiles[viewerIndex];

  if (!viewer) {
    return createEmptyLeaderboardPayload(viewerUserId, mode, viewerProfile);
  }

  const pointsPositions = createPositionMap(scoredProfiles, (profile) => profile.totalPoints);
  const streakPositions = createPositionMap(scoredProfiles, (profile) => profile.streak);

  const entries: LeaderboardEntry[] = viewer.leaderboardVisible
    ? scoredProfiles
        .map((profile, index) => ({
          userId: profile.userId,
          position: index + 1,
          displayName: profile.leaderboardVisible ? (profile.displayName ?? "") : "",
          profilePictureIndex: profile.profilePictureIndex,
          totalPoints: profile.totalPoints,
          streak: profile.streak,
          rankIcon: getRankForPoints(profile.totalPoints).icon,
          isViewer: profile.userId === viewerUserId,
        }))
        
    : [];

  return {
    mode,
    viewer: {
      userId: viewer.userId,
      position: viewerIndex + 1,
      pointsPosition: pointsPositions.get(viewer.userId) ?? 1,
      streakPosition: streakPositions.get(viewer.userId) ?? 1,
      displayName: viewer.displayName ?? "",
      totalPoints: viewer.totalPoints,
      streak: viewer.streak,
      leaderboardVisible: viewer.leaderboardVisible,
    },
    entries,
    canViewLeaderboard: viewer.leaderboardVisible,
  };
}

function createEmptyLeaderboardPayload(
  viewerUserId: string,
  mode: LeaderboardMode,
  viewerProfile?: LeaderboardProfileRow,
): LeaderboardPayload {
  return {
    mode,
    viewer: {
      userId: viewerUserId,
      position: 1,
      pointsPosition: 1,
      streakPosition: 1,
      displayName: viewerProfile?.display_name?.trim() || "",
      totalPoints:
        mode === "streaks"
          ? 0
          : getProfilePointTotal({
              aiPracticePoints: viewerProfile?.ai_practice_points ?? 0,
              chestPoints: viewerProfile?.chest_points ?? 0,
              streakPoints: viewerProfile?.streak_points ?? 0,
              missionPoints: viewerProfile?.mission_points ?? 0,
              quizResultPoints: viewerProfile?.quiz_result_points ?? 0,
              gamePoints: viewerProfile?.game_points ?? 0,
              gemPoints: viewerProfile?.gem_points ?? 0,
            }),
      streak: 0,
      leaderboardVisible: viewerProfile?.leaderboard_visible ?? false,
    },
    entries: [],
    canViewLeaderboard: false,
  };
}

function createPositionMap<T extends { userId: string }>(
  profiles: readonly T[],
  getValue: (profile: T) => number,
) {
  return new Map(
    [...profiles]
      .sort((left, right) => {
        const valueDifference = getValue(right) - getValue(left);

        return valueDifference !== 0
          ? valueDifference
          : left.userId.localeCompare(right.userId);
      })
      .map((profile, index) => [profile.userId, index + 1] as const),
  );
}

function getLongestStreakByUser(rows: readonly DailyLoginRow[]) {
  const datesByUser = new Map<string, number[]>();

  for (const row of rows) {
    const dayNumber = getUtcDayNumber(row.activity_date);
    if (dayNumber === null) {
      continue;
    }

    const dates = datesByUser.get(row.user_id) ?? [];
    dates.push(dayNumber);
    datesByUser.set(row.user_id, dates);
  }

  const longestStreakByUser = new Map<string, number>();

  for (const [userId, dates] of datesByUser) {
    longestStreakByUser.set(userId, getLongestConsecutiveRun(dates));
  }

  return longestStreakByUser;
}

export function calculateLongestDailyStreak(activityDates: readonly string[]) {
  const dayNumbers = activityDates
    .map(getUtcDayNumber)
    .filter((dayNumber): dayNumber is number => dayNumber !== null);

  return getLongestConsecutiveRun(dayNumbers);
}

function getLongestConsecutiveRun(dates: readonly number[]) {
  const uniqueSortedDates = [...new Set(dates)].sort((left, right) => left - right);
  let currentStreak = 0;
  let longestStreak = 0;
  let previousDate: number | null = null;

  for (const date of uniqueSortedDates) {
    currentStreak = previousDate !== null && date === previousDate + 1 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDate = date;
  }

  return longestStreak;
}

function getUtcDayNumber(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.floor(timestamp / 86_400_000);
}

function parseTierFromSourceKey(sourceKey: string): Tier | null {
  const tier = sourceKey.split(":")[1];

  return parseTier(tier);
}

function parseTier(value: string | undefined): Tier | null {
  const tier = value;

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
