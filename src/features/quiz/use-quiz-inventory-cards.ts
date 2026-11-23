"use client";

import { useRef, useState } from "react";
import { useInventoryStore } from "@/features/inventory/inventory-store";

/**
 * Keep quiz result screens on the inventory snapshot used to produce them.
 * Result overlays may add cards, but that should not rerender the whole quiz
 * setup/flow tree for each selection.
 */
export function useQuizInventoryCards(freezeAtResult: boolean) {
  const latestCardsRef = useRef<ReturnType<typeof useInventoryStore.getState>["cards"] | null>(null);
  const [, setSnapshotRevision] = useState(0);
  const cards = useInventoryStore((state) => {
    if (!freezeAtResult) {
      latestCardsRef.current = state.cards;
      return state.cards;
    }

    if (latestCardsRef.current === null) latestCardsRef.current = state.cards;
    return latestCardsRef.current;
  });
  const refreshSnapshot = () => {
    if (!freezeAtResult) return;
    latestCardsRef.current = useInventoryStore.getState().cards;
    setSnapshotRevision((revision) => revision + 1);
  };

  return { cards, refreshSnapshot };
}
