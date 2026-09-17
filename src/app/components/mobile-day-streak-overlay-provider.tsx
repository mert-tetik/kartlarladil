"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MobileDayStreakMenu } from "@/app/components/mobile-day-streak-menu";
import { useAuthSession } from "@/features/auth/auth-client";
import type { DailyStreakSnapshot } from "@/features/daily-streak/daily-streak-actions";
import { useOptionalDailyStreak } from "@/features/daily-streak/daily-streak-client";
import { useLeaderboardOverlay } from "@/features/leaderboard/components/leaderboard-overlay-provider";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";

const DAILY_STREAK_TEST_REOPEN_DELAY = 400;
const DAILY_STREAK_RESULT_REMINDER_STORAGE_KEY = "foxiesdeck:daily-streak:result-reminder";

interface MobileDayStreakOverlayContextValue {
  openDayStreak: () => void;
  closeDayStreak: () => void;
  requestAutoOpenAfterQuizResult: (onClosed: () => void) => void;
  isOpen: boolean;
  snapshot: DailyStreakSnapshot | null;
  loading: boolean;
}

const MobileDayStreakOverlayContext = createContext<MobileDayStreakOverlayContextValue | null>(null);

function isDailyStreakTestMode(searchParams: URLSearchParams) {
  return ["daily-streak-test", "day-streak-test"].some((key) => {
    const value = searchParams.get(key);
    return value === "1" || value === "true";
  });
}

function createDailyStreakTestSnapshot(currentStreak: number): DailyStreakSnapshot {
  const today = getLocalDateKey(new Date());
  const loggedDates = Array.from({ length: Math.max(1, currentStreak) }, (_, index) =>
    getDateKeyOffset(today, index),
  );

  return { currentStreak, today, loggedDates };
}

function getDateKeyOffset(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return getLocalDateKey(new Date(year, month - 1, day + offset, 12));
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  return window.matchMedia("(max-width: 1023px)").matches;
}

export function MobileDayStreakOverlayProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();
  const searchParams = useSearchParams();
  const dailyStreakContext = useOptionalDailyStreak();
  const { openLeaderboard } = useLeaderboardOverlay();
  const [isOpen, setIsOpen] = useState(false);
  const [testValue, setTestValue] = useState(1);
  const testStartedRef = useRef(false);
  const testReopenTimerRef = useRef<number | null>(null);
  const claimedReminderRef = useRef<string | null>(null);
  const pendingResultContinuationRef = useRef<(() => void) | null>(null);
  const dailyStreakTestMode = isDailyStreakTestMode(searchParams);
  const syncedSnapshot = dailyStreakContext?.snapshot ?? null;
  const syncedLoading = dailyStreakContext?.loading ?? false;
  const snapshot = useMemo<DailyStreakSnapshot | null>(
    () => (dailyStreakTestMode ? createDailyStreakTestSnapshot(testValue) : syncedSnapshot),
    [dailyStreakTestMode, syncedSnapshot, testValue],
  );
  const { data: leaderboardData } = useLeaderboardData({
    enabled: Boolean(user && isOpen),
    mode: "streaks",
    refreshOnMount: true,
  });

  const openDayStreak = useCallback(() => {
    void dailyStreakContext?.refresh();
    setIsOpen(true);
  }, [dailyStreakContext]);

  const requestAutoOpenAfterQuizResult = useCallback(
    (onClosed: () => void) => {
      if (!user || dailyStreakTestMode || !isMobileViewport()) {
        onClosed();
        return;
      }

      const reminderKey = `${user.id}:${getLocalDateKey(new Date())}`;
      if (claimedReminderRef.current === reminderKey) {
        onClosed();
        return;
      }

      try {
        if (window.localStorage.getItem(DAILY_STREAK_RESULT_REMINDER_STORAGE_KEY) === reminderKey) {
          claimedReminderRef.current = reminderKey;
          onClosed();
          return;
        }

        window.localStorage.setItem(
          DAILY_STREAK_RESULT_REMINDER_STORAGE_KEY,
          reminderKey,
        );
      } catch {
        // The in-memory claim below still prevents repeated opens in this session
        // when storage is unavailable or blocked.
      }

      claimedReminderRef.current = reminderKey;
      pendingResultContinuationRef.current = onClosed;
      openDayStreak();
    },
    [dailyStreakTestMode, openDayStreak, user],
  );

  const closeDayStreak = useCallback(() => {
    if (!dailyStreakTestMode) {
      setIsOpen(false);
      return;
    }

    setIsOpen(false);
    if (testReopenTimerRef.current !== null) {
      window.clearTimeout(testReopenTimerRef.current);
    }
    testReopenTimerRef.current = window.setTimeout(() => {
      testReopenTimerRef.current = null;
      setTestValue((current) => current + 1);
      setIsOpen(true);
    }, DAILY_STREAK_TEST_REOPEN_DELAY);
  }, [dailyStreakTestMode]);

  const handleDayStreakExited = useCallback(() => {
    const continuation = pendingResultContinuationRef.current;
    pendingResultContinuationRef.current = null;
    continuation?.();
  }, []);

  const handleOpenLeaderboard = useCallback(() => {
    pendingResultContinuationRef.current = null;
    if (testReopenTimerRef.current !== null) {
      window.clearTimeout(testReopenTimerRef.current);
      testReopenTimerRef.current = null;
    }
    setIsOpen(false);
    openLeaderboard("streaks");
  }, [openLeaderboard]);

  useEffect(() => {
    if (!dailyStreakTestMode) {
      testStartedRef.current = false;
      return;
    }

    if (testStartedRef.current) {
      return;
    }

    testStartedRef.current = true;
    setTestValue(1);
    setIsOpen(true);
  }, [dailyStreakTestMode]);

  useEffect(() => {
    return () => {
      if (testReopenTimerRef.current !== null) {
        window.clearTimeout(testReopenTimerRef.current);
      }
    };
  }, []);

  const contextValue = useMemo<MobileDayStreakOverlayContextValue>(
    () => ({
      openDayStreak,
      closeDayStreak,
      requestAutoOpenAfterQuizResult,
      isOpen,
      snapshot,
      loading: dailyStreakTestMode ? false : syncedLoading,
    }),
    [
      closeDayStreak,
      dailyStreakTestMode,
      isOpen,
      openDayStreak,
      requestAutoOpenAfterQuizResult,
      snapshot,
      syncedLoading,
    ],
  );

  return (
    <MobileDayStreakOverlayContext.Provider value={contextValue}>
      {children}
      <MobileDayStreakMenu
        open={isOpen}
        highestStreak={leaderboardData?.viewer.streak ?? snapshot?.currentStreak ?? null}
        streakPosition={leaderboardData?.viewer.streakPosition ?? null}
        onOpenLeaderboard={handleOpenLeaderboard}
        onClose={closeDayStreak}
        onExited={handleDayStreakExited}
        snapshot={snapshot}
        loading={dailyStreakTestMode ? false : syncedLoading}
      />
    </MobileDayStreakOverlayContext.Provider>
  );
}

export function useOptionalMobileDayStreakOverlay() {
  return useContext(MobileDayStreakOverlayContext);
}
