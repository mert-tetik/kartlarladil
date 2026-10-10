"use client";

import { useCallback, useEffect, useRef } from "react";

/** The score and gem HUD pulse animations both currently run for 350ms. */
export const REWARD_HUD_PULSE_DURATION_MS = 350;

// Give the browser one small frame budget after the CSS animation duration so
// a delayed mobile frame cannot make a reward screen advance early.
const REWARD_HUD_PULSE_SETTLE_MS = 150;
const REWARD_HUD_PULSE_WAIT_MS = REWARD_HUD_PULSE_DURATION_MS + REWARD_HUD_PULSE_SETTLE_MS;

interface RewardAnimationGateCallbacks {
  onPointsComplete?: () => void;
  onGemsComplete?: () => void;
  onComplete?: () => void;
}

interface RewardAnimationGateState {
  pointArrivals: number;
  gemArrivals: number;
  pointsScatterComplete: boolean;
  gemsScatterComplete: boolean;
  pointsPulseComplete: boolean;
  gemsPulseComplete: boolean;
  pointsCallbackSent: boolean;
  gemsCallbackSent: boolean;
  completionCallbackSent: boolean;
  expectGems: boolean;
}

const INITIAL_STATE: RewardAnimationGateState = {
  pointArrivals: 0,
  gemArrivals: 0,
  pointsScatterComplete: false,
  gemsScatterComplete: true,
  pointsPulseComplete: false,
  gemsPulseComplete: true,
  pointsCallbackSent: false,
  gemsCallbackSent: false,
  completionCallbackSent: false,
  expectGems: false,
};

/**
 * Coordinates scatter callbacks with the score/gem HUD pulses they trigger.
 * A scatter callback fires when the icon reaches its target, but the target
 * still has a short CSS pulse to finish. This gate keeps those two phases
 * separate and makes every caller wait for both.
 */
export function useRewardAnimationGate(callbacks: RewardAnimationGateCallbacks = {}) {
  const stateRef = useRef<RewardAnimationGateState>({ ...INITIAL_STATE });
  const callbacksRef = useRef(callbacks);
  const pointPulseTimerRef = useRef<number | null>(null);
  const gemPulseTimerRef = useRef<number | null>(null);
  const { onPointsComplete, onGemsComplete, onComplete } = callbacks;

  useEffect(() => {
    callbacksRef.current = { onPointsComplete, onGemsComplete, onComplete };
  }, [onComplete, onGemsComplete, onPointsComplete]);

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const maybeComplete = useCallback(() => {
    const state = stateRef.current;
    const pointsReady = state.pointsScatterComplete && state.pointsPulseComplete;
    const gemsReady = !state.expectGems || (state.gemsScatterComplete && state.gemsPulseComplete);

    if (pointsReady && !state.pointsCallbackSent) {
      state.pointsCallbackSent = true;
      callbacksRef.current.onPointsComplete?.();
    }

    if (state.expectGems && gemsReady && !state.gemsCallbackSent) {
      state.gemsCallbackSent = true;
      callbacksRef.current.onGemsComplete?.();
    }

    if (pointsReady && gemsReady && !state.completionCallbackSent) {
      state.completionCallbackSent = true;
      callbacksRef.current.onComplete?.();
    }
  }, []);

  const markPointsPulseComplete = useCallback(() => {
    const state = stateRef.current;
    if (state.pointArrivals === 0) return;
    state.pointsPulseComplete = true;
    clearTimer(pointPulseTimerRef);
    maybeComplete();
  }, [clearTimer, maybeComplete]);

  const markGemsPulseComplete = useCallback(() => {
    const state = stateRef.current;
    if (state.gemArrivals === 0) return;
    state.gemsPulseComplete = true;
    clearTimer(gemPulseTimerRef);
    maybeComplete();
  }, [clearTimer, maybeComplete]);

  const notePointsArrival = useCallback(() => {
    const state = stateRef.current;
    state.pointArrivals += 1;
    state.pointsPulseComplete = false;
    clearTimer(pointPulseTimerRef);
    pointPulseTimerRef.current = window.setTimeout(() => {
      pointPulseTimerRef.current = null;
      markPointsPulseComplete();
    }, REWARD_HUD_PULSE_WAIT_MS);
  }, [clearTimer, markPointsPulseComplete]);

  const noteGemsArrival = useCallback(() => {
    const state = stateRef.current;
    state.expectGems = true;
    state.gemArrivals += 1;
    state.gemsPulseComplete = false;
    clearTimer(gemPulseTimerRef);
    gemPulseTimerRef.current = window.setTimeout(() => {
      gemPulseTimerRef.current = null;
      markGemsPulseComplete();
    }, REWARD_HUD_PULSE_WAIT_MS);
  }, [clearTimer, markGemsPulseComplete]);

  const markPointsScatterComplete = useCallback(() => {
    const state = stateRef.current;
    state.pointsScatterComplete = true;
    if (state.pointArrivals === 0) state.pointsPulseComplete = true;
    maybeComplete();
  }, [maybeComplete]);

  const markGemsScatterComplete = useCallback(() => {
    const state = stateRef.current;
    state.expectGems = true;
    state.gemsScatterComplete = true;
    if (state.gemArrivals === 0) state.gemsPulseComplete = true;
    maybeComplete();
  }, [maybeComplete]);

  const reset = useCallback((expectGems: boolean) => {
    clearTimer(pointPulseTimerRef);
    clearTimer(gemPulseTimerRef);
    stateRef.current = {
      ...INITIAL_STATE,
      expectGems,
      gemsScatterComplete: !expectGems,
      gemsPulseComplete: !expectGems,
    };
  }, [clearTimer]);

  useEffect(() => () => {
    clearTimer(pointPulseTimerRef);
    clearTimer(gemPulseTimerRef);
  }, [clearTimer]);

  return {
    reset,
    notePointsArrival,
    noteGemsArrival,
    markPointsScatterComplete,
    markGemsScatterComplete,
    markPointsPulseComplete,
    markGemsPulseComplete,
  };
}
