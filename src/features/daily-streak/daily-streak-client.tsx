"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { syncDailyStreakAction, type DailyStreakSnapshot } from "./daily-streak-actions";

interface DailyStreakContextValue {
  snapshot: DailyStreakSnapshot | null;
  loading: boolean;
  refresh: () => Promise<boolean>;
}

const DailyStreakContext = createContext<DailyStreakContextValue | null>(null);

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isDailyStreakTestMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return ["daily-streak-test", "day-streak-test"].some((key) => {
    const value = params.get(key);
    return value === "1" || value === "true";
  });
}

const DAILY_STREAK_RETRY_DELAYS = [0, 500, 1500] as const;

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function DailyStreakProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const [snapshot, setSnapshot] = useState<DailyStreakSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);
  const syncRequestRef = useRef<Promise<boolean> | null>(null);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (isDailyStreakTestMode() || !userId) {
      return false;
    }

    if (syncRequestRef.current) {
      return syncRequestRef.current;
    }

    setLoading(true);
    const request = (async () => {
      try {
        const result = await syncDailyStreakAction(getBrowserTimeZone());
        if (result.success) {
          setSnapshot(result.snapshot);
          return true;
        }
      } catch {
        // A streak sync failure must not block the rest of the application.
      }

      return false;
    })();

    syncRequestRef.current = request;
    try {
      return await request;
    } finally {
      if (syncRequestRef.current === request) {
        syncRequestRef.current = null;
      }
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isDailyStreakTestMode()) {
      syncedUserIdRef.current = null;
      setSnapshot(null);
      setLoading(false);
      return;
    }

    if (!user) {
      syncedUserIdRef.current = null;
      setSnapshot(null);
      return;
    }

    if (syncedUserIdRef.current === user.id) {
      return;
    }

    let cancelled = false;

    const syncWithRetry = async () => {
      for (const delay of DAILY_STREAK_RETRY_DELAYS) {
        if (delay > 0) {
          await wait(delay);
        }

        if (cancelled) {
          return;
        }

        if (await refresh()) {
          if (!cancelled) {
            syncedUserIdRef.current = user.id;
          }
          return;
        }
      }
    };

    void syncWithRetry();

    return () => {
      cancelled = true;
    };
  }, [refresh, user]);

  useEffect(() => {
    if (!user || isDailyStreakTestMode()) {
      return;
    }

    const refreshWhenResuming = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void refresh();
    };

    window.addEventListener("pageshow", refreshWhenResuming);
    window.addEventListener("focus", refreshWhenResuming);
    document.addEventListener("visibilitychange", refreshWhenResuming);

    return () => {
      window.removeEventListener("pageshow", refreshWhenResuming);
      window.removeEventListener("focus", refreshWhenResuming);
      document.removeEventListener("visibilitychange", refreshWhenResuming);
    };
  }, [refresh, user]);

  const value = useMemo(
    () => ({ snapshot, loading, refresh }),
    [loading, refresh, snapshot],
  );

  return <DailyStreakContext.Provider value={value}>{children}</DailyStreakContext.Provider>;
}

export function useDailyStreak() {
  const context = useContext(DailyStreakContext);

  if (!context) {
    throw new Error("useDailyStreak must be used inside DailyStreakProvider.");
  }

  return context;
}

export function useOptionalDailyStreak() {
  return useContext(DailyStreakContext);
}
