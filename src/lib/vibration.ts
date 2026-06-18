"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "foxiesdeck:vibration-enabled";

export type VibrationPatternName = "tap" | "flip" | "correct" | "incorrect" | "learned" | "confetti" | "result";

export const VIBRATION_PATTERNS: Record<VibrationPatternName, number | number[]> = {
  /** Very light tap for generic presses. */
  tap: [12],
  /** Short, solid feedback when a card flips. */
  flip: [15],
  /** Crisp confirmation for a correct answer. */
  correct: [22],
  /** Two short bursts that mimic an "incorrect" buzz. */
  incorrect: [15, 70, 15],
  /** Subtle pulse when the learned popup appears. */
  learned: [18],
  /** Heavier burst synced with confetti. */
  confetti: [35],
  /** Strong, satisfying pulse when the result screen opens. */
  result: [45],
};

export function isVibrationSupported(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function";
}

function readEnabledState(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
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
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const isSupported = isVibrationSupported();
    setSupported(isSupported);
    setEnabled(isSupported && readEnabledState());
  }, []);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      setVibrationEnabled(next);
      return next;
    });
  }, []);

  const trigger = useCallback((patternName: VibrationPatternName) => {
    vibrate(patternName);
  }, []);

  return { supported, enabled, toggle, trigger };
}
