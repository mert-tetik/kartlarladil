"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { vibrate } from "@/lib/vibration";

type FastForwardHandler = (root: HTMLElement) => boolean;
type FastForwardRegistration = {
  handler: FastForwardHandler;
  priority: number;
};

export const QUIZ_ANIMATION_FAST_FORWARD_DOUBLE_TAP_MS = 500;

export function isQuizAnimationFastForwardDoubleTap(
  lastTapAtRef: { current: number },
  now = Date.now(),
) {
  const previousTapAt = lastTapAtRef.current;
  lastTapAtRef.current = now;

  if (
    previousTapAt <= 0 ||
    now < previousTapAt ||
    now - previousTapAt > QUIZ_ANIMATION_FAST_FORWARD_DOUBLE_TAP_MS
  ) {
    return false;
  }

  lastTapAtRef.current = 0;
  return true;
}

interface FastForwardContextValue {
  register: (id: symbol, registration: FastForwardRegistration | null) => void;
  fastForward: (root: HTMLElement) => boolean;
}

const FastForwardContext = createContext<FastForwardContextValue | null>(null);

export function QuizAnimationFastForwardProvider({ children }: { children: ReactNode }) {
  const registrationsRef = useRef(new Map<symbol, FastForwardRegistration>());

  const register = useCallback((id: symbol, registration: FastForwardRegistration | null) => {
    if (registration) registrationsRef.current.set(id, registration);
    else registrationsRef.current.delete(id);
  }, []);

  const fastForward = useCallback((root: HTMLElement) => {
    const registrations = [...registrationsRef.current.values()]
      .sort((left, right) => right.priority - left.priority);
    let handled = false;
    let handledPriority: number | null = null;

    for (const registration of registrations) {
      if (handledPriority !== null && registration.priority < handledPriority) break;

      try {
        if (registration.handler(root)) {
          handled = true;
          handledPriority ??= registration.priority;
        }
      } catch {
        // A fast-forward helper must never interrupt the quiz result flow.
      }
    }

    if (handled) {
      vibrate("quiz-animation-fast-forward");
      return true;
    }

    const finishedCount = finishCurrentWebAnimations(root);
    if (finishedCount > 0) vibrate("quiz-animation-fast-forward");
    return finishedCount > 0;
  }, []);

  const value = useMemo(() => ({ register, fastForward }), [fastForward, register]);

  return <FastForwardContext.Provider value={value}>{children}</FastForwardContext.Provider>;
}

export function useQuizAnimationFastForward(
  handler: FastForwardHandler,
  enabled = true,
  priority = 0,
) {
  const context = useContext(FastForwardContext);
  const idRef = useRef(Symbol("quiz-animation-fast-forward"));
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!context || !enabled) return;
    context.register(idRef.current, { handler: (root) => handlerRef.current(root), priority });
    return () => context.register(idRef.current, null);
  }, [context, enabled, priority]);
}

export function useQuizAnimationFastForwardRequest() {
  return useContext(FastForwardContext)?.fastForward ?? null;
}

export function finishCurrentWebAnimations(root: HTMLElement, subtree = true): number {
  if (typeof root.getAnimations !== "function") return 0;

  let finishedCount = 0;
  for (const animation of root.getAnimations({ subtree })) {
    if (!isCurrentlyActiveAnimation(animation)) continue;

    try {
      animation.finish();
      finishedCount += 1;
    } catch {
      // Skip animations that cannot be finished (for example, a detached effect).
    }
  }

  return finishedCount;
}

export function isCurrentlyActiveAnimation(animation: Animation): boolean {
  if (animation.playState !== "running") return false;

  const currentTime = typeof animation.currentTime === "number" ? animation.currentTime : null;
  if (currentTime === null) return false;

  const timing = animation.effect?.getTiming();
  const computedTiming = animation.effect?.getComputedTiming();
  const delay = typeof timing?.delay === "number" ? timing.delay : 0;
  const endTime = computedTiming?.endTime;
  if (typeof endTime !== "number" || !Number.isFinite(endTime)) return false;

  return currentTime >= Math.max(0, delay) && currentTime < endTime;
}
