import type { RankIconId } from "@/types/domain";

export type LeaderboardMode = "points" | "streaks";

export function parseLeaderboardMode(value: string | null): LeaderboardMode {
  return value === "streaks" ? "streaks" : "points";
}

export interface LeaderboardEntry {
  userId: string;
  position: number;
  displayName: string;
  profilePictureIndex: number | null;
  /** Kept for existing point consumers; streak mode renders `streak` instead. */
  totalPoints: number;
  streak: number;
  rankIcon: RankIconId;
  isViewer: boolean;
}

export interface LeaderboardViewer {
  userId: string;
  position: number;
  pointsPosition: number;
  streakPosition: number;
  displayName: string;
  totalPoints: number;
  streak: number;
  leaderboardVisible: boolean;
}

export interface LeaderboardPayload {
  mode: LeaderboardMode;
  viewer: LeaderboardViewer;
  entries: LeaderboardEntry[];
  canViewLeaderboard: boolean;
}
