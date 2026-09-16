"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { syncDailyStreakAction, type DailyStreakSnapshot } from "./daily-streak-actions";

interface DailyStreakContextValue {
  snapshot: DailyStreakSnapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
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

export function DailyStreakProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const [snapshot, setSnapshot] = useState<DailyStreakSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (isDailyStreakTestMode()) {
      return;
    }

    setLoading(true);
    try {
      const result = await syncDailyStreakAction(getBrowserTimeZone());
      if (result.success) {
        setSnapshot(result.snapshot);
      }
    } catch {
      // A streak sync failure must not block the rest of the application.
    } finally {
      setLoading(false);
    }
  }, []);

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

    syncedUserIdRef.current = user.id;
    void refresh();
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
