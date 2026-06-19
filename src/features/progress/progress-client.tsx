"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import {
  EMPTY_PROGRESS_STATS,
  calculateProgressStats,
  mergeBonusPoints,
} from "@/features/progress/progress-stats";
import type { ProgressStats } from "@/types/domain";

const CLOUD_MIGRATION_KEY = "foxiesdeck:cloud-migrated:v1";

interface ProgressStatsContextValue {
  stats: ProgressStats;
  loading: boolean;
  error: string;
  refreshStats: () => Promise<void>;
}

const ProgressStatsContext = createContext<ProgressStatsContextValue | null>(null);

export function ProgressStatsProvider({ children }: { children: ReactNode }) {
  const { user, refreshProfile } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const setCloudEnabled = useInventoryStore((state) => state.setCloudEnabled);
  const clearLocalInventory = useInventoryStore((state) => state.clearLocalInventory);
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const migrateLocalInventoryToCloud = useInventoryStore((state) => state.migrateLocalInventoryToCloud);
  const migrationStartedRef = useRef(false);

  useEffect(() => {
    setCloudEnabled(Boolean(user));

    if (!user) {
      migrationStartedRef.current = false;

      if (ownerUserId) {
        clearLocalInventory();
      }
    }
  }, [setCloudEnabled, user, ownerUserId, clearLocalInventory]);

  useEffect(() => {
    if (!user || !hydrated || migrationStartedRef.current) {
      return;
    }

    migrationStartedRef.current = true;
    const migrationKey = `${CLOUD_MIGRATION_KEY}:${user.id}`;

    void (async () => {
      const state = useInventoryStore.getState();

      if (ownerUserId && ownerUserId !== user.id) {
        state.clearLocalInventory();
        window.localStorage.removeItem(migrationKey);
        await loadCloudInventory();
        state.setOwnerUserId(user.id);
        window.localStorage.setItem(migrationKey, "1");
        return;
      }

      if (!window.localStorage.getItem(migrationKey) && cards.length > 0) {
        await migrateLocalInventoryToCloud();

        if (!useInventoryStore.getState().cloudError) {
          window.localStorage.setItem(migrationKey, "1");
          state.setOwnerUserId(user.id);
        }

        return;
      }

      await loadCloudInventory();
      state.setOwnerUserId(user.id);
      window.localStorage.setItem(migrationKey, "1");
    })();
  }, [cards.length, hydrated, loadCloudInventory, migrateLocalInventoryToCloud, ownerUserId, user]);

  const stats = useMemo(() => {
    if (!hydrated) {
      return EMPTY_PROGRESS_STATS;
    }

    const baseStats = calculateProgressStats(joinInventoryCards(cards));
    const bonusPoints = (user?.profile.aiPracticePoints ?? 0) + (user?.profile.chestPoints ?? 0);

    return mergeBonusPoints(baseStats, bonusPoints);
  }, [cards, hydrated, user?.profile.aiPracticePoints, user?.profile.chestPoints]);

  const refreshStats = useCallback(async () => {
    if (user) {
      await refreshProfile();
      await loadCloudInventory();
    }
  }, [loadCloudInventory, refreshProfile, user]);

  const value = useMemo(
    () => ({
      stats,
      loading: !hydrated || cloudLoading,
      error: cloudError,
      refreshStats,
    }),
    [cloudError, cloudLoading, hydrated, refreshStats, stats],
  );

  return <ProgressStatsContext.Provider value={value}>{children}</ProgressStatsContext.Provider>;
}

export function useProgressStats() {
  const context = useContext(ProgressStatsContext);

  if (!context) {
    throw new Error("useProgressStats must be used inside ProgressStatsProvider.");
  }

  return context;
}
