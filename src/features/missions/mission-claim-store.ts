"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface MissionClaimState {
  claimedIds: Set<string>;
  setClaimedIds: (ids: Iterable<string>) => void;
  markClaimed: (id: string) => void;
  clearClaimed: () => void;
}

const STORAGE_KEY = "foxiesdeck:missions:claimed";

export const useMissionClaimStore = create<MissionClaimState>()(
  persist(
    (set) => ({
      claimedIds: new Set(),

      setClaimedIds(ids) {
        set({ claimedIds: new Set(ids) });
      },

      markClaimed(id) {
        set((state) => {
          const next = new Set(state.claimedIds);
          next.add(id);
          return { claimedIds: next };
        });
      },

      clearClaimed() {
        set({ claimedIds: new Set() });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ claimedIds: Array.from(state.claimedIds) }),
      merge: (persisted, current) => ({
        ...current,
        claimedIds: new Set((persisted as { claimedIds?: string[] }).claimedIds ?? []),
      }),
    },
  ),
);
