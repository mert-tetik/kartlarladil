"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";
import { useProgressStats } from "@/features/progress/progress-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { listUserMissionsAction, claimMissionRewardAction } from "@/features/missions/mission-actions";
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

export function MissionsList({ initialMissions }: { initialMissions: MissionViewModel[] }) {
  const t = useT();
  const router = useRouter();
  const { user } = useAuthSession();
  const { refreshStats } = useProgressStats();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const getGameProgress = useGameProgressStore((state) => state.getProgress);
  const [missions, setMissions] = useState<MissionViewModel[]>(initialMissions);
  const [loading, setLoading] = useState(false);
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

  const loadMissions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    const result = await listUserMissionsAction(snapshot);

    if (result.status === "success") {
      setMissions(result.missions);
    } else {
      setError(result.message ?? t("missions.loadError"));
    }

    setLoading(false);
  }, [snapshot, t, user]);

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.replace("/login?next=/missions");
      return;
    }

    // Initial prop uses server-side snapshot (game progress unknown).
    // Refresh from the client once inventory and game progress are hydrated.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMissions();
  }, [hydrated, loadMissions, router, user]);

  async function handleClaim(missionId: string) {
    if (claimingId) return;

    setClaimingId(missionId);
    const result = await claimMissionRewardAction(missionId);

    if (result.status === "success") {
      const mission = MISSIONS.find((item) => item.id === missionId);

      if (!mission) {
        await refreshStats();
        await loadMissions();
        return;
      }

      const { reward } = mission;

      if (reward.kind === "chest") {
        const tier = CHEST_TIERS.find((item) => item.tier === reward.tier);
        if (tier) {
          setRewardMode({ kind: "chest", tier });
        }
      } else if (reward.kind === "points") {
        setRewardMode({ kind: "points", amount: reward.amount });
      }

      await refreshStats();
      await loadMissions();
    } else {
      setError(result.message ?? t("missions.claimError"));
    }

    setClaimingId(null);
  }

  function handleRewardComplete() {
    setRewardMode(null);
  }

  if (!hydrated || loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-sm text-foreground-secondary">{error}</p>
        <Button onClick={() => void loadMissions()}>{t("common.retry")}</Button>
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
      <div className={cn("flex flex-col gap-3 pb-8", rewardMode && "pointer-events-none")}>
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
