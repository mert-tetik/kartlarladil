import type { RankIconId } from "@/types/domain";

export interface LeaderboardEntry {
  userId: string;
  position: number;
  displayName: string;
  profilePictureIndex: number | null;
  totalPoints: number;
  rankIcon: RankIconId;
  isViewer: boolean;
}

export interface LeaderboardViewer {
  userId: string;
  position: number;
  displayName: string;
  totalPoints: number;
  leaderboardVisible: boolean;
}

export interface LeaderboardPayload {
  viewer: LeaderboardViewer;
  entries: LeaderboardEntry[];
  canViewLeaderboard: boolean;
}
