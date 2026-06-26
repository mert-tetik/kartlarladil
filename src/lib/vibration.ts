"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "foxiesdeck:vibration-enabled";

export type VibrationPatternName = "tap" | "flip" | "correct" | "incorrect" | "learned" | "confetti" | "result" | "draw" | "chest-tap" | "chest-open";

export const VIBRATION_PATTERNS: Record<VibrationPatternName, number | number[]> = {
  /** Light tap for generic presses. */
  tap: [22],
  /** Short, solid feedback when a card flips. */
  flip: [22],
  /** Crisp confirmation for a correct answer. */
  correct: [38],
  /** Two short bursts that mimic an "incorrect" buzz. */
  incorrect: [22, 55, 22],
  /** Subtle pulse when the learned popup appears. */
  learned: [32],
  /** Heavier burst synced with confetti. */
  confetti: [65],
  /** Strong, satisfying pulse when the result screen opens. */
  result: [85],
  /** Short burst when new cards are drawn. */
  draw: [40],
  /** Thud when the chest is tapped. */
  "chest-tap": [45],
  /** Strong, triumphant burst when the chest opens. */
  "chest-open": [90, 35, 120],
};

export function isVibrationSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function";
}

function readEnabledState(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

function subscribe(callback: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  return () => {};
}

export function getVibrationEnabled(): boolean {
  return isVibrationSupported() && readEnabledState();
}

export function setVibrationEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function vibrate(patternName: VibrationPatternName): void {
  if (!getVibrationEnabled()) return;

  const pattern = VIBRATION_PATTERNS[patternName];
  try {
    navigator.vibrate(pattern as VibratePattern);
  } catch {
    // Vibration is best-effort; ignore failures.
  }
}

export function useVibration() {
  const supported = useSyncExternalStore(
    subscribe,
    isVibrationSupported,
    () => false,
  );
  const enabled = useSyncExternalStore(
    subscribe,
    readEnabledState,
    () => true,
  );

  const toggle = useCallback(() => {
    const next = !enabled;
    setVibrationEnabled(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    }
  }, [enabled]);

  const trigger = useCallback((patternName: VibrationPatternName) => {
    vibrate(patternName);
  }, []);

  return { supported, enabled: supported && enabled, toggle, trigger };
}
