"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { listUserMissionsAction, claimMissionRewardAction } from "@/features/missions/mission-actions";
import { buildMissionViewModels } from "@/features/missions/mission-progress";
import { useMissionClaimStore } from "@/features/missions/mission-claim-store";
import { MISSIONS } from "@/features/missions/missions-data";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import type {
  MissionDefinition,
  MissionProgressSnapshot,
  UserMission,
} from "@/features/missions/mission-types";
import { MissionCard } from "./mission-card";
import { MissionRewardOverlay } from "./mission-reward-overlay";

export interface MissionViewModel extends UserMission {
  definition: MissionDefinition;
  requirement: number;
}

export function MissionsList() {
  const t = useT();
  const router = useRouter();
  const { user, updateProfileField } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const getGameProgress = useGameProgressStore((state) => state.getProgress);
  const { claimedIds, setClaimedIds, markClaimed, unmarkClaimed } = useMissionClaimStore();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [rewardMode, setRewardMode] = useState<
    | { kind: "chest"; tier: import("@/features/quiz/chest-rewards").ChestTierDefinition }
    | { kind: "points"; amount: number }
    | null
  >(null);

  const snapshot = useMemo<MissionProgressSnapshot>(() => {
    const totalCards = cards.length;
    const learnedCards = cards.filter((item) => item.status === "learned").length;

    return {
      totalCards,
      learnedCards,
      bestMemoryLevel: getGameProgress("memory").bestLevel,
      bestWordChallengeLevel: getGameProgress("wordChallenge").bestLevel,
      bestWordMatchLevel: getGameProgress("wordMatch").bestLevel,
      practicedCharacterIds: new Set(),
    };
  }, [cards, getGameProgress]);

  const missions = useMemo<MissionViewModel[]>(
    () => buildMissionViewModels(snapshot, claimedIds),
    [snapshot, claimedIds],
  );

  const syncMissions = useCallback(async () => {
    if (!user) return;

    setSyncing(true);
    setError(null);

    const result = await listUserMissionsAction(snapshot);

    if (result.status === "success") {
      setClaimedIds(result.missions.filter((item) => item.status === "claimed").map((item) => item.missionId));
    } else if (result.message === "auth_required") {
      router.replace("/login?next=/missions");
      setSyncing(false);
      return;
    } else {
      setError(result.message ?? t("missions.loadError"));
    }

    setSyncing(false);
  }, [router, snapshot, t, user, setClaimedIds]);

  useEffect(() => {
    if (!user) {
      router.replace("/login?next=/missions");
      return;
    }

    if (!hydrated) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncMissions();
  }, [hydrated, syncMissions, router, user]);

  function handleClaim(missionId: string) {
    if (claimingId) return;

    const mission = MISSIONS.find((item) => item.id === missionId);
    if (!mission) return;

    setClaimingId(missionId);
    markClaimed(missionId);

    const { reward } = mission;

    if (reward.kind === "chest") {
      const tier = CHEST_TIERS.find((item) => item.tier === reward.tier);
      if (tier) {
        setRewardMode({ kind: "chest", tier });
      }
    } else {
      setRewardMode({ kind: "points", amount: reward.amount });
    }

    void claimMissionRewardAction(missionId).then(async (result) => {
      if (result.status === "success") {
        if (result.missionPoints !== undefined && result.chestPoints !== undefined) {
          updateProfileField({
            missionPoints: result.missionPoints,
            chestPoints: result.chestPoints,
          });
        }
        await syncMissions();
      } else if (result.message === "auth_required") {
        setRewardMode(null);
        unmarkClaimed(missionId);
        router.replace("/login?next=/missions");
      } else {
        setError(result.message ?? t("missions.claimError"));
        unmarkClaimed(missionId);
        setRewardMode(null);
      }

      setClaimingId(null);
    });
  }

  const handleRewardComplete = useCallback(() => {
    setRewardMode(null);
  }, []);

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-sm text-foreground-secondary">{error}</p>
        <Button onClick={() => void syncMissions()}>{t("common.retry")}</Button>
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <EmptyState
        title={t("missions.emptyTitle")}
        description={t("missions.emptyDescription")}
      />
    );
  }

  return (
    <>
      {syncing && (
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-foreground-secondary">
          <div className="size-3 animate-spin rounded-full border border-brand border-t-transparent" />
          {t("missions.syncing")}
        </div>
      )}
      <div className={cn("flex flex-col gap-3 pb-8")}>
        {missions.map((mission) => (
          <MissionCard
            key={mission.missionId}
            missionId={mission.missionId}
            type={mission.definition.type}
            requirement={mission.requirement}
            progress={mission.progress}
            status={mission.status}
            reward={mission.definition.reward}
            game={mission.definition.game}
            characterId={mission.definition.characterId}
            onClaim={() => void handleClaim(mission.missionId)}
            claiming={claimingId === mission.missionId}
          />
        ))}
      </div>

      <MissionRewardOverlay mode={rewardMode} onComplete={handleRewardComplete} />
    </>
  );
}
