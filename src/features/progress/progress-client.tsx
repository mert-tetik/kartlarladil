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
  const { user } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const setCloudEnabled = useInventoryStore((state) => state.setCloudEnabled);
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const migrateLocalInventoryToCloud = useInventoryStore((state) => state.migrateLocalInventoryToCloud);
  const migrationStartedRef = useRef(false);

  useEffect(() => {
    setCloudEnabled(Boolean(user));

    if (!user) {
      migrationStartedRef.current = false;
    }
  }, [setCloudEnabled, user]);

  useEffect(() => {
    if (!user || !hydrated || migrationStartedRef.current) {
      return;
    }

    migrationStartedRef.current = true;
    const migrationKey = `${CLOUD_MIGRATION_KEY}:${user.id}`;

    void (async () => {
      if (!window.localStorage.getItem(migrationKey) && cards.length > 0) {
        await migrateLocalInventoryToCloud();

        if (!useInventoryStore.getState().cloudError) {
          window.localStorage.setItem(migrationKey, "1");
        }

        return;
      }

      await loadCloudInventory();
      window.localStorage.setItem(migrationKey, "1");
    })();
  }, [cards.length, hydrated, loadCloudInventory, migrateLocalInventoryToCloud, user]);

  const stats = useMemo(() => {
    if (!hydrated) {
      return EMPTY_PROGRESS_STATS;
    }

    return calculateProgressStats(joinInventoryCards(cards));
  }, [cards, hydrated]);

  const refreshStats = useCallback(async () => {
    if (user) {
      await loadCloudInventory();
    }
  }, [loadCloudInventory, user]);

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
