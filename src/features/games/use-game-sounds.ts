"use client";

import { useCallback } from "react";
import { playSoundEffect, type SoundEffectName } from "@/lib/sound-effects";
import { vibrate, type VibrationPatternName } from "@/lib/vibration";

export interface GameSoundOptions {
  playbackRate?: number;
}

export function useGameSounds() {
  const play = useCallback(
    (sound: SoundEffectName, vibration?: VibrationPatternName, options?: GameSoundOptions) => {
      playSoundEffect(sound, options);
      if (vibration) {
        vibrate(vibration);
      }
    },
    [],
  );

  return {
    flip: useCallback(() => play("correct", "flip"), [play]),
    select: useCallback(() => play("word-select"), [play]),
    correct: useCallback(
      (options?: GameSoundOptions) => play("correct", "correct", options),
      [play],
    ),
    passed: useCallback(() => play("mission-passed", "correct"), [play]),
    incorrect: useCallback(() => play("incorrect", "incorrect"), [play]),
    complete: useCallback(() => play("quiz-complete", "result"), [play]),
    fail: useCallback(() => play("level-fail", "incorrect"), [play]),
    tickLow: useCallback(() => play("clock-tick-low"), [play]),
    tickHigh: useCallback(() => play("clock-tick-high"), [play]),
  };
}
