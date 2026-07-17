"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface MissionClaimState {
  claimedIds: Set<string>;
  pendingClaimIds: Set<string>;
  pendingClaimOwnerId: string | null;
  setClaimedIds: (ids: Iterable<string>, userId?: string) => void;
  markClaimed: (id: string) => void;
  unmarkClaimed: (id: string) => void;
  markClaimPending: (id: string, userId: string) => void;
  resolvePendingClaim: (id: string, userId: string) => void;
  rejectPendingClaim: (id: string, userId: string) => void;
  clearClaimed: () => void;
}

const STORAGE_KEY = "foxiesdeck:missions:claimed";

export const useMissionClaimStore = create<MissionClaimState>()(
  persist(
    (set) => ({
      claimedIds: new Set(),
      pendingClaimIds: new Set(),
      pendingClaimOwnerId: null,

      setClaimedIds(ids, userId) {
        set((state) => ({
          claimedIds: new Set([
            ...ids,
            ...(state.pendingClaimOwnerId === userId ? state.pendingClaimIds : []),
          ]),
        }));
      },

      markClaimed(id) {
        set((state) => {
          const next = new Set(state.claimedIds);
          next.add(id);
          return { claimedIds: next };
        });
      },

      unmarkClaimed(id) {
        set((state) => {
          const next = new Set(state.claimedIds);
          next.delete(id);
          return { claimedIds: next };
        });
      },

      markClaimPending(id, userId) {
        set((state) => ({
          claimedIds: state.pendingClaimOwnerId && state.pendingClaimOwnerId !== userId
            ? new Set([id])
            : new Set(state.claimedIds).add(id),
          pendingClaimIds: state.pendingClaimOwnerId === userId
            ? new Set(state.pendingClaimIds).add(id)
            : new Set([id]),
          pendingClaimOwnerId: userId,
        }));
      },

      resolvePendingClaim(id, userId) {
        set((state) => {
          if (state.pendingClaimOwnerId !== userId) return state;
          const nextPending = new Set(state.pendingClaimIds);
          nextPending.delete(id);
          return {
            pendingClaimIds: nextPending,
            pendingClaimOwnerId: nextPending.size > 0 ? userId : null,
          };
        });
      },

      rejectPendingClaim(id, userId) {
        set((state) => {
          if (state.pendingClaimOwnerId !== userId) return state;
          const nextClaimed = new Set(state.claimedIds);
          const nextPending = new Set(state.pendingClaimIds);
          nextClaimed.delete(id);
          nextPending.delete(id);
          return {
            claimedIds: nextClaimed,
            pendingClaimIds: nextPending,
            pendingClaimOwnerId: nextPending.size > 0 ? userId : null,
          };
        });
      },

      clearClaimed() {
        set({ claimedIds: new Set(), pendingClaimIds: new Set(), pendingClaimOwnerId: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        claimedIds: Array.from(state.claimedIds),
        pendingClaimIds: Array.from(state.pendingClaimIds),
        pendingClaimOwnerId: state.pendingClaimOwnerId,
      }),
      merge: (persisted, current) => ({
        ...current,
        claimedIds: new Set((persisted as { claimedIds?: string[] }).claimedIds ?? []),
        pendingClaimIds: new Set((persisted as { pendingClaimIds?: string[] }).pendingClaimIds ?? []),
        pendingClaimOwnerId: (persisted as { pendingClaimOwnerId?: string | null }).pendingClaimOwnerId ?? null,
      }),
    },
  ),
);
