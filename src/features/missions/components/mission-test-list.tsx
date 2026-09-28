"use client";

import { useCallback, useRef, useState } from "react";
import { createChestRewardPreview } from "@/features/gems/chest-reward-preview";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import { MissionRewardOverlay } from "./mission-reward-overlay";
import { MissionDetailsOverlay, type MissionDetailsData } from "./mission-details-overlay";
import { MissionCard } from "./mission-card";
import { createMissionTestViewModels, type MissionTestViewModel } from "../mission-test-fixtures";
import {
  completeMissionRewardAnimation,
  enqueueMissionRewardAnimation,
  getActiveMissionRewardAnimations,
  type MissionRewardAnimationEntry,
  type MissionRewardAnimationMode,
} from "../mission-reward-queue";

export function MissionTestList({ seed }: { seed: number }) {
  const [missions, setMissions] = useState<MissionTestViewModel[]>(() => createMissionTestViewModels(seed));
  const [pendingMissionIds, setPendingMissionIds] = useState<Set<string>>(() => new Set());
  const pendingMissionIdsRef = useRef(new Set<string>());
  const [rewardQueue, setRewardQueue] = useState<MissionRewardAnimationEntry[]>([]);
  const [missionDetails, setMissionDetails] = useState<{
    mission: MissionDetailsData;
    sourceRect: DOMRect;
  } | null>(null);
  const rewardModes = getActiveMissionRewardAnimations(rewardQueue);

  const handleClaim = useCallback((missionId: string, source?: DOMRect) => {
    if (pendingMissionIdsRef.current.has(missionId)) return;

    const mission = missions.find((item) => item.missionId === missionId);
    if (!mission || mission.status !== "waiting") return;

    const reward = mission.definition.reward;
    let animationMode: MissionRewardAnimationMode;

    if (reward.kind === "chest") {
      const tier = CHEST_TIERS.find((item) => item.tier === reward.tier);
      if (!tier) return;

      animationMode = {
        missionId,
        kind: "chest",
        tier,
        gemReward: createChestRewardPreview(tier.tier),
      } as const;
    } else if (reward.kind === "gems") {
      animationMode = {
        missionId,
        kind: "gems",
        gemType: reward.gemType,
        amount: reward.amount,
        source,
      } as const;
    } else {
      animationMode = {
        missionId,
        kind: "points",
        amount: reward.amount,
        source,
      } as const;
    }

    pendingMissionIdsRef.current.add(missionId);
    setPendingMissionIds(new Set(pendingMissionIdsRef.current));
    setRewardQueue((queue) => enqueueMissionRewardAnimation(queue, animationMode, true));
  }, [missions]);

  const handleRewardComplete = useCallback((claimedMissionId: string) => {
    setMissions((currentMissions) => currentMissions.map((mission) => (
      mission.missionId === claimedMissionId
        ? {
            ...mission,
            status: "claimed",
            progress: mission.requirement,
            claimedAt: "test-mode",
          }
      : mission
    )));
    pendingMissionIdsRef.current.delete(claimedMissionId);
    setPendingMissionIds(new Set(pendingMissionIdsRef.current));
    setRewardQueue((queue) => completeMissionRewardAnimation(queue, claimedMissionId));
  }, []);

  const handleOpenDetails = useCallback((mission: MissionTestViewModel, sourceRect: DOMRect) => {
    setMissionDetails({
      mission: {
        missionId: mission.missionId,
        index: mission.definition.index,
        type: mission.definition.type,
        requirement: mission.requirement,
        progress: mission.progress,
        status: mission.status,
        reward: mission.definition.reward,
        game: mission.definition.game,
        characterId: mission.definition.characterId,
      },
      sourceRect,
    });
  }, []);

  return (
    <div
      data-mission-test-mode
      data-mission-test-pending-mission={Array.from(pendingMissionIds).join(",") || undefined}
      className="flex min-w-0 flex-col"
    >
      <div className="grid grid-cols-2 gap-0 pb-8">
        {missions.map((mission) => (
          <MissionCard
            key={mission.missionId}
            missionId={mission.missionId}
            index={mission.definition.index}
            type={mission.definition.type}
            requirement={mission.requirement}
            progress={mission.progress}
            status={mission.status}
            reward={mission.definition.reward}
            game={mission.definition.game}
            characterId={mission.definition.characterId}
            onClaim={(source) => handleClaim(mission.missionId, source)}
            onOpenDetails={(source) => handleOpenDetails(mission, source)}
            claiming={pendingMissionIds.has(mission.missionId)}
          />
        ))}
      </div>

      <MissionRewardOverlay modes={rewardModes} onComplete={handleRewardComplete} />
      <MissionDetailsOverlay
        mission={missionDetails?.mission ?? null}
        sourceRect={missionDetails?.sourceRect ?? null}
        onClose={() => setMissionDetails(null)}
        onNavigate={() => setMissionDetails(null)}
      />
    </div>
  );
}
