"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { shouldClearInventoryForSession } from "@/features/inventory/inventory-session-cache";
import {
  EMPTY_PROGRESS_STATS,
  calculateProgressStats,
  mergeBonusPoints,
} from "@/features/progress/progress-stats";
import { getProfilePointTotal } from "@/features/progress/point-sources";
import { trackPointMilestones } from "@/lib/twa-analytics-events";
import { isMissionVisualTestRoute } from "@/lib/visual-test-mode";
import { usePathname } from "next/navigation";
import type { ProgressStats } from "@/types/domain";

const CLOUD_MIGRATION_KEY = "foxiesdeck:cloud-migrated:v1";
const PROGRESS_STATS_CACHE_PREFIX = "foxiesdeck:progress-stats:v2:";

interface CachedProgressStats {
  ownerKey: string;
  stats: ProgressStats;
}

interface ProgressStatsContextValue {
  stats: ProgressStats;
  loading: boolean;
  error: string;
  refreshStats: () => Promise<void>;
}

const ProgressStatsContext = createContext<ProgressStatsContextValue | null>(null);

function getProgressStatsCacheKey(ownerKey: string) {
  return `${PROGRESS_STATS_CACHE_PREFIX}${encodeURIComponent(ownerKey)}`;
}

function isProgressStats(value: unknown): value is ProgressStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Partial<ProgressStats>;
  return [
    stats.totalPoints,
    stats.totalCards,
    stats.activeCards,
    stats.learnedCards,
    stats.pointsToNextRank,
    stats.rankProgressPercent,
  ].every((entry) => typeof entry === "number" && Number.isFinite(entry) && entry >= 0) &&
    !!stats.rank && typeof stats.rank === "object" &&
    Array.isArray(stats.tierStats) && Array.isArray(stats.languageStats);
}

function readCachedProgressStats(ownerKey: string): ProgressStats | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getProgressStatsCacheKey(ownerKey));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedProgressStats;
    return cached.ownerKey === ownerKey && isProgressStats(cached.stats) ? cached.stats : null;
  } catch {
    return null;
  }
}

function writeCachedProgressStats(ownerKey: string, stats: ProgressStats) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getProgressStatsCacheKey(ownerKey),
      JSON.stringify({ ownerKey, stats } satisfies CachedProgressStats),
    );
  } catch {
    // Ignore storage errors.
  }
}

export function ProgressStatsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isVisualTestMode = isMissionVisualTestRoute(pathname);
  const { user, isSessionReady, refreshProfile } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const setCloudEnabled = useInventoryStore((state) => state.setCloudEnabled);
  const clearLocalInventory = useInventoryStore((state) => state.clearLocalInventory);
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const migrateLocalInventoryToCloud = useInventoryStore((state) => state.migrateLocalInventoryToCloud);
  const setActiveCardLimit = useInventoryStore((state) => state.setActiveCardLimit);
  const { entitlements } = useSubscription();
  const migrationStartedForUserRef = useRef<string | null>(null);
  const trackedPointsRef = useRef<number | null>(null);
  const trackedPointsOwnerRef = useRef<string>("guest");
  // Read browser-only cached stats after hydration so the server and the
  // client's first render use the same initial snapshot.
  const cacheOwnerKey = user?.id ?? "guest";
  const [cachedStats, setCachedStats] = useState<CachedProgressStats | null>(null);

  useEffect(() => {
    setCachedStats(null);
    const cached = readCachedProgressStats(cacheOwnerKey);
    if (cached) setCachedStats({ ownerKey: cacheOwnerKey, stats: cached });
  }, [cacheOwnerKey]);

  useEffect(() => {
    if (isVisualTestMode) {
      migrationStartedForUserRef.current = null;
      setCloudEnabled(false);
      setActiveCardLimit(null);
      return;
    }

    setActiveCardLimit(entitlements?.limits.activeCards ?? null);

    // AuthSessionProvider can temporarily report no user while it restores a
    // valid browser session. Keep the persisted inventory intact until that
    // identity check has completed.
    if (!isSessionReady) return;

    setCloudEnabled(Boolean(user));

    if (!user) {
      migrationStartedForUserRef.current = null;

      if (shouldClearInventoryForSession({
        sessionReady: isSessionReady,
        userId: null,
        ownerUserId,
      })) {
        clearLocalInventory();
      }
    }
  }, [isVisualTestMode, isSessionReady, setCloudEnabled, setActiveCardLimit, user, ownerUserId, clearLocalInventory, entitlements]);

  useEffect(() => {
    if (isVisualTestMode || !isSessionReady || !user || !hydrated || migrationStartedForUserRef.current === user.id) {
      return;
    }

    migrationStartedForUserRef.current = user.id;
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
        }

        // Keep this device's local inventory associated with the active account
        // even if migration fails, so startup can release to the offline fallback.
        // The migration key stays unset so a later launch retries the cloud copy.
        state.setOwnerUserId(user.id);
        return;
      }

      await loadCloudInventory();
      state.setOwnerUserId(user.id);
      window.localStorage.setItem(migrationKey, "1");
    })();
  }, [cards.length, hydrated, isSessionReady, isVisualTestMode, loadCloudInventory, migrateLocalInventoryToCloud, ownerUserId, user]);

  const computedStats = useMemo(() => {
    if (!hydrated) {
      return EMPTY_PROGRESS_STATS;
    }

    const inventoryIsSafeForOwner = ownerUserId === null || ownerUserId === (user?.id ?? null);
    const safeCards = inventoryIsSafeForOwner ? cards : [];
    const baseStats = calculateProgressStats(joinInventoryCards(safeCards));
    const bonusPoints = getProfilePointTotal(user?.profile);

    return mergeBonusPoints(baseStats, bonusPoints);
  }, [cards, hydrated, ownerUserId, user?.id, user?.profile]);

  const stats = useMemo(() => {
    const localInventoryIsUsable = ownerUserId === (user?.id ?? null) || (user && ownerUserId === null && cards.length > 0);
    const cloudSnapshotPending = Boolean(
      user &&
      !localInventoryIsUsable &&
      (!cloudEnabled || cloudLoading || !cloudLoadComplete || Boolean(cloudError)),
    );
    if ((!hydrated || cloudSnapshotPending) && cachedStats?.ownerKey === cacheOwnerKey) {
      return cachedStats.stats;
    }
    return computedStats;
  }, [cacheOwnerKey, cachedStats, cards.length, cloudEnabled, cloudError, cloudLoadComplete, cloudLoading, computedStats, hydrated, ownerUserId, user]);

  useEffect(() => {
    if (!hydrated) return;

    const inventoryIsSafeForOwner = ownerUserId === null || ownerUserId === (user?.id ?? null);
    const hasUsableLocalSnapshot = inventoryIsSafeForOwner && (!user || ownerUserId === user.id || cards.length > 0);
    const cloudAttemptSettled = cloudEnabled && cloudLoadComplete && !cloudLoading && !cloudError;
    if (user && !hasUsableLocalSnapshot && !cloudAttemptSettled) return;

    writeCachedProgressStats(cacheOwnerKey, computedStats);
    setCachedStats({ ownerKey: cacheOwnerKey, stats: computedStats });
  }, [cacheOwnerKey, cards.length, cloudEnabled, cloudError, cloudLoadComplete, cloudLoading, computedStats, hydrated, ownerUserId, user]);

  useEffect(() => {
    const ownerKey = user?.id ?? "guest";
    if (trackedPointsOwnerRef.current === ownerKey) {
      return;
    }

    trackedPointsOwnerRef.current = ownerKey;
    trackedPointsRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (isVisualTestMode || !hydrated || cloudLoading) {
      return;
    }

    const previousPoints = trackedPointsRef.current;
    const nextPoints = computedStats.totalPoints;

    if (previousPoints === null) {
      trackedPointsRef.current = nextPoints;
      return;
    }

    trackPointMilestones(previousPoints, nextPoints);
    trackedPointsRef.current = nextPoints;
  }, [cloudLoading, computedStats.totalPoints, hydrated, isVisualTestMode]);

  const refreshStats = useCallback(async () => {
    if (isVisualTestMode) {
      return;
    }

    if (user) {
      await refreshProfile();
      await loadCloudInventory();
    }
  }, [isVisualTestMode, loadCloudInventory, refreshProfile, user]);

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
