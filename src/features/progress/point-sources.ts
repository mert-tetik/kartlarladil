import type { AuthProfile } from "@/features/auth/auth-types";

/** Keeps every mutable point source consistent across progress and leaderboard. */
export function getProfilePointTotal(profile?: Pick<AuthProfile,
  "aiPracticePoints" | "chestPoints" | "streakPoints" | "missionPoints" |
  "quizResultPoints" | "gamePoints" | "gemPoints"> | null) {
  return (
    (profile?.aiPracticePoints ?? 0) +
    (profile?.chestPoints ?? 0) +
    (profile?.streakPoints ?? 0) +
    (profile?.missionPoints ?? 0) +
    (profile?.quizResultPoints ?? 0) +
    (profile?.gamePoints ?? 0) +
    (profile?.gemPoints ?? 0)
  );
}

export function getGemBalance(
  profile: Pick<AuthProfile, "blueGems" | "greenGems" | "purpleGems">,
  type: "blue" | "green" | "purple",
) {
  return type === "blue" ? profile.blueGems ?? 0 : type === "green" ? profile.greenGems ?? 0 : profile.purpleGems ?? 0;
}
