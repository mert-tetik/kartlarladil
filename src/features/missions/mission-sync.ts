"use client";

import { syncMissionProgressAction } from "./mission-actions";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useGameProgressStore } from "@/features/games/game-progress-store";
import type { MissionProgressSnapshot } from "./mission-types";

export function buildClientMissionSnapshot(): MissionProgressSnapshot {
  const { cards } = useInventoryStore.getState();
  const { progress } = useGameProgressStore.getState();

  return {
    totalCards: cards.length,
    learnedCards: cards.filter((card) => card.status === "learned").length,
    bestMemoryLevel: progress.memory.bestLevel,
    bestWordChallengeLevel: progress.wordChallenge.bestLevel,
    bestWordMatchLevel: progress.wordMatch.bestLevel,
    practicedCharacterIds: new Set(),
  };
}

export async function syncMissionsFromClientState(): Promise<void> {
  try {
    await syncMissionProgressAction(buildClientMissionSnapshot());
  } catch {
    // Mission sync is best-effort; do not break caller flow.
  }
}
