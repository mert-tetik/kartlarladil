"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";
import { listUserMissionsAction } from "@/features/missions/mission-actions";
import { countWaitingMissions } from "@/features/missions/mission-progress";
import type { MissionProgressSnapshot, UserMission } from "@/features/missions/mission-types";

export function useMissionWaitingCount(): number {
  const { user } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const getGameProgress = useGameProgressStore((state) => state.getProgress);
  const [userMissions, setUserMissions] = useState<UserMission[]>([]);

  const snapshot = useMemo<MissionProgressSnapshot>(
    () => ({
      totalCards: cards.length,
      learnedCards: cards.filter((item) => item.status === "learned").length,
      bestMemoryLevel: getGameProgress("memory").bestLevel,
      bestWordChallengeLevel: getGameProgress("wordChallenge").bestLevel,
      bestWordMatchLevel: getGameProgress("wordMatch").bestLevel,
      practicedCharacterIds: new Set(),
    }),
    [cards, getGameProgress],
  );

  useEffect(() => {
    if (!user || !hydrated) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await listUserMissionsAction(snapshot);
      if (!cancelled && result.status === "success") {
        setUserMissions(
          result.missions.map((item) => ({
            missionId: item.missionId,
            progress: item.progress,
            status: item.status,
            claimedAt: item.claimedAt,
          })),
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [snapshot, user, hydrated]);

  return useMemo(() => countWaitingMissions(snapshot, userMissions), [snapshot, userMissions]);
}
