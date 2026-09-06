"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useT } from "@/i18n/locale-provider";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { cn } from "@/lib/utils";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { listUserMissionsAction } from "@/features/missions/mission-actions";
import { enqueueMissionClaim, resumePendingMissionClaims } from "@/features/missions/mission-claim-queue";
import { buildMissionViewModels } from "@/features/missions/mission-progress";
import { useMissionClaimStore } from "@/features/missions/mission-claim-store";
import { MISSIONS } from "@/features/missions/missions-data";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";
import type {
  MissionDefinition,
  MissionProgressSnapshot,
  MissionReward,
  UserMission,
} from "@/features/missions/mission-types";
import { MissionCard } from "./mission-card";
import { MissionRewardOverlay } from "./mission-reward-overlay";
import { MissionDetailsOverlay, type MissionDetailsData } from "./mission-details-overlay";
import {
  getMissionNavigationHref,
  type MissionNavigationTarget,
} from "../mission-navigation";

export interface MissionViewModel extends UserMission {
  definition: MissionDefinition;
  requirement: number;
}

export function MissionsList({ onMissionNavigate }: { onMissionNavigate?: (target: MissionNavigationTarget) => void }) {
  const t = useT();
  const router = useRouter();
  const { user, updateProfileField } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const getGameProgress = useGameProgressStore((state) => state.getProgress);
  const claimedIds = useMissionClaimStore((state) => state.claimedIds);
  const pendingClaimIds = useMissionClaimStore((state) => state.pendingClaimIds);
  const pendingClaimOwnerId = useMissionClaimStore((state) => state.pendingClaimOwnerId);
  const setClaimedIds = useMissionClaimStore((state) => state.setClaimedIds);
  const markClaimPending = useMissionClaimStore((state) => state.markClaimPending);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [historicalRewards, setHistoricalRewards] = useState<{
    userId: string;
    rewards: Record<string, MissionReward>;
  } | null>(null);
  const [rewardMode, setRewardMode] = useState<
    | { missionId: string; kind: "chest"; tier: import("@/features/quiz/chest-rewards").ChestTierDefinition; gemReward?: import("@/features/gems/gem-types").ChestRewardOutcome }
    | { missionId: string; kind: "points"; amount: number; source?: DOMRect }
    | null
  >(null);
  const [missionDetails, setMissionDetails] = useState<{
    mission: MissionDetailsData;
    sourceRect: DOMRect;
  } | null>(null);
  const hasResumedPendingClaimsRef = useRef(false);

  function handleMissionNavigate(target: MissionNavigationTarget) {
    if (onMissionNavigate) {
      onMissionNavigate(target);
      return;
    }

    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    navigateWithRouteTransition(() => router.push(getMissionNavigationHref(target, isMobile)));
  }

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
    () => {
      const rewardOverrides = new Map<string, MissionReward>();
      const rewardState = historicalRewards;
      if (rewardState && rewardState.userId === user?.id) {
        for (const [missionId, reward] of Object.entries(rewardState.rewards)) {
          rewardOverrides.set(missionId, reward);
        }
      }

      return buildMissionViewModels(snapshot, claimedIds, rewardOverrides);
    },
    [historicalRewards, snapshot, claimedIds, user?.id],
  );

  const syncMissions = useCallback(async () => {
    if (!user) return;

    setLoadError(null);

    const result = await listUserMissionsAction(snapshot);

    if (result.status === "success") {
      const rewards = Object.fromEntries(
        result.missions
          .filter((item) => item.status === "claimed")
          .map((item) => [item.missionId, item.definition.reward]),
      );
      setHistoricalRewards({ userId: user.id, rewards });
      setClaimedIds(
        result.missions.filter((item) => item.status === "claimed").map((item) => item.missionId),
        user.id,
      );
    } else if (result.message === "auth_required") {
      navigateWithRouteTransition(() => router.replace("/login?next=/missions"));
      return;
    } else {
      setLoadError(result.message ?? t("missions.loadError"));
    }
  }, [router, snapshot, t, user, setClaimedIds]);

  useEffect(() => {
    if (!user) {
      navigateWithRouteTransition(() => router.replace("/login?next=/missions"));
      return;
    }

    if (!hydrated) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncMissions();
  }, [hydrated, syncMissions, router, user]);

  useEffect(() => {
    if (!user || hasResumedPendingClaimsRef.current) return;
    hasResumedPendingClaimsRef.current = true;
    if (pendingClaimOwnerId === user.id) {
      resumePendingMissionClaims(user.id, pendingClaimIds);
    }
  }, [pendingClaimIds, pendingClaimOwnerId, user]);

  function handleClaim(missionId: string, source?: DOMRect) {
    if (!user) return;

    const userId = user.id;
    if (pendingClaimOwnerId === user?.id && pendingClaimIds.has(missionId)) return;

    const mission = MISSIONS.find((item) => item.id === missionId);
    if (!mission) return;

    const { reward } = mission;
    setClaimError(null);

    // Mount the reward UI before the server action can occupy the main thread.
    if (reward.kind === "chest") {
      const tier = CHEST_TIERS.find((item) => item.tier === reward.tier);
      if (!tier) return;

      flushSync(() => {
        markClaimPending(missionId, userId);
        setRewardMode({ missionId, kind: "chest", tier });
      });
    } else {
      flushSync(() => {
        markClaimPending(missionId, userId);
        setRewardMode({ missionId, kind: "points", amount: reward.amount, source });
      });
    }

    window.requestAnimationFrame(() => void enqueueMissionClaim(userId, missionId).then((result) => {
      if (result.status === "success") {
        if (result.reward && typeof result.points === "number") {
          sendTwaAnalyticsEvent("fd_mission_reward_claimed", {
            params: {
              mission_id: missionId,
              mission_type: mission.type,
              reward_kind: result.reward.kind,
              points: result.points,
              chest_tier: result.chestTier ?? "",
            },
          });
        }

        if (result.missionPoints !== undefined && result.chestPoints !== undefined) {
          updateProfileField({
            missionPoints: result.missionPoints,
            chestPoints: result.chestPoints,
            ...(result.blueGems !== undefined ? { blueGems: result.blueGems } : {}),
            ...(result.greenGems !== undefined ? { greenGems: result.greenGems } : {}),
            ...(result.purpleGems !== undefined ? { purpleGems: result.purpleGems } : {}),
          });
        }
        if (result.gemRewards?.length && reward.kind === "chest") {
          setRewardMode((current) => current?.missionId === missionId && current.kind === "chest"
            ? {
                ...current,
                gemReward: {
                  points: result.points ?? 0,
                  rewards: result.gemRewards!,
                  balances: result.balances,
                },
              }
            : current);
        }
      } else if (result.message === "auth_required") {
        setRewardMode((current) => current?.missionId === missionId ? null : current);
        navigateWithRouteTransition(() => router.replace("/login?next=/missions"));
      } else {
        setClaimError(result.message ?? t("missions.claimError"));
        setRewardMode((current) => current?.missionId === missionId ? null : current);
      }
    }));
  }

  const handleRewardComplete = useCallback(() => {
    setRewardMode(null);
  }, []);

  if (!user) {
    return null;
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-sm text-foreground-secondary">{loadError}</p>
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
      {claimError ? <p role="alert" className="text-sm text-destructive">{claimError}</p> : null}
      <div className={cn("grid grid-cols-2 gap-0 pb-8")}>
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
            onClaim={(source) => void handleClaim(mission.missionId, source)}
            onOpenDetails={(source) => setMissionDetails({
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
              sourceRect: source,
            })}
            claiming={pendingClaimOwnerId === user.id && pendingClaimIds.has(mission.missionId)}
          />
        ))}
      </div>

      <MissionRewardOverlay mode={rewardMode} onComplete={handleRewardComplete} />
      <MissionDetailsOverlay
        mission={missionDetails?.mission ?? null}
        sourceRect={missionDetails?.sourceRect ?? null}
        onClose={() => setMissionDetails(null)}
        onNavigate={handleMissionNavigate}
      />
    </>
  );
}
