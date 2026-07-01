"use client";

import { useCallback } from "react";
import { playSoundEffect, type SoundEffectName } from "@/lib/sound-effects";
import { vibrate, type VibrationPatternName } from "@/lib/vibration";

export function useGameSounds() {
  const play = useCallback((sound: SoundEffectName, vibration?: VibrationPatternName) => {
    playSoundEffect(sound);
    if (vibration) {
      vibrate(vibration);
    }
  }, []);

  return {
    flip: useCallback(() => play("correct", "flip"), [play]),
    correct: useCallback(() => play("correct", "correct"), [play]),
    incorrect: useCallback(() => play("incorrect", "incorrect"), [play]),
    complete: useCallback(() => play("quiz-complete", "result"), [play]),
    fail: useCallback(() => play("level-fail", "incorrect"), [play]),
    tickLow: useCallback(() => play("clock-tick-low"), [play]),
    tickHigh: useCallback(() => play("clock-tick-high"), [play]),
  };
}
