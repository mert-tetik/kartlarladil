import type { RankIconId } from "@/types/domain";

export type LeaderboardMode = "points" | "streaks" | "medals";

export function parseLeaderboardMode(value: string | null): LeaderboardMode {
  if (value === "streaks" || value === "medals") {
    return value;
  }

  return "points";
}

export interface LeaderboardEntry {
  userId: string;
  position: number;
  displayName: string;
  profilePictureIndex: number | null;
  /** Kept for existing point consumers; streak mode renders `streak` instead. */
  totalPoints: number;
  streak: number;
  medals: number;
  rankIcon: RankIconId;
  isViewer: boolean;
}

export interface LeaderboardViewer {
  userId: string;
  position: number;
  pointsPosition: number;
  streakPosition: number;
  medalsPosition: number;
  displayName: string;
  totalPoints: number;
  streak: number;
  medals: number;
  leaderboardVisible: boolean;
}

export interface LeaderboardPayload {
  mode: LeaderboardMode;
  viewer: LeaderboardViewer;
  entries: LeaderboardEntry[];
  canViewLeaderboard: boolean;
}
