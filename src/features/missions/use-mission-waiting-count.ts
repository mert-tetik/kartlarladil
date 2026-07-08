"use client";

import { useEffect, useMemo } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";
import { listUserMissionsAction } from "@/features/missions/mission-actions";
import { countWaitingMissions } from "@/features/missions/mission-progress";
import { useMissionClaimStore } from "@/features/missions/mission-claim-store";
import type { MissionProgressSnapshot } from "@/features/missions/mission-types";

export function useMissionWaitingCount(): number {
  const { user } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const getGameProgress = useGameProgressStore((state) => state.getProgress);
  const { claimedIds, setClaimedIds } = useMissionClaimStore();

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
        setClaimedIds(result.missions.filter((item) => item.status === "claimed").map((item) => item.missionId));
      }
    })();

    return () => {
      cancelled = true;
    };
    // Snapshot changes are computed client-side; sync with Supabase only on mount/auth changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hydrated, setClaimedIds]);

  return useMemo(() => countWaitingMissions(snapshot, claimedIds), [snapshot, claimedIds]);
}
