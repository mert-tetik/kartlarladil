"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseGameTimerOptions {
  seconds: number;
  running: boolean;
  onExpired: () => void;
  onTick?: (remaining: number) => void;
}

export function useGameTimer({ seconds, running, onExpired, onTick }: UseGameTimerOptions) {
  const [remaining, setRemaining] = useState(seconds);
  const onExpiredRef = useRef(onExpired);
  const onTickRef = useRef(onTick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  const lastTickRef = useRef<number>(seconds);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  });

  useEffect(() => {
    onTickRef.current = onTick;
  });

  const reset = useCallback((newSeconds: number) => {
    setRemaining(newSeconds);
    endTimeRef.current = Date.now() + newSeconds * 1000;
    lastTickRef.current = newSeconds;
  }, []);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    endTimeRef.current = Date.now() + remaining * 1000;

    intervalRef.current = setInterval(() => {
      const next = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemaining(next);

      if (next !== lastTickRef.current) {
        lastTickRef.current = next;
        onTickRef.current?.(next);
      }

      if (next <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onExpiredRef.current();
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, remaining]);

  return { remaining, reset };
}

export function formatGameTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
