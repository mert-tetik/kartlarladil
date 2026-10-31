import type { GemBalances } from "@/features/gems/gem-types";
import type { MissionRewardAnimationMode } from "@/features/missions/mission-reward-queue";

type MissionPointsAnimationMode = Extract<MissionRewardAnimationMode, { kind: "points" }>;
type MissionGemsAnimationMode = Extract<MissionRewardAnimationMode, { kind: "gems" }>;

export function getMissionPointsDisplayTotal(
  totalPoints: number,
  modes: readonly MissionPointsAnimationMode[],
  arrivedByMission: Readonly<Record<string, number>>,
) {
  let arrivedBeforeClaimSettled = 0;
  let settledPointsStillInFlight = 0;

  for (const mode of modes) {
    const arrived = Math.min(mode.amount, Math.max(0, arrivedByMission[mode.missionId] ?? 0));
    if (mode.claimSettled) settledPointsStillInFlight += mode.amount - arrived;
    else arrivedBeforeClaimSettled += arrived;
  }

  return Math.max(0, totalPoints + arrivedBeforeClaimSettled - settledPointsStillInFlight);
}

export function getMissionGemDisplayBalances(
  profileBalances: GemBalances,
  modes: readonly MissionGemsAnimationMode[],
  arrivedByMission: Readonly<Record<string, number>>,
): GemBalances {
  const displayBalances = { ...profileBalances };

  for (const mode of modes) {
    const arrived = Math.min(mode.amount, Math.max(0, arrivedByMission[mode.missionId] ?? 0));
    if (mode.claimSettled) {
      if (mode.balances) displayBalances[mode.gemType] -= mode.amount - arrived;
    } else {
      displayBalances[mode.gemType] += arrived;
    }
  }

  return {
    blue: Math.max(0, displayBalances.blue),
    green: Math.max(0, displayBalances.green),
    purple: Math.max(0, displayBalances.purple),
  };
}
