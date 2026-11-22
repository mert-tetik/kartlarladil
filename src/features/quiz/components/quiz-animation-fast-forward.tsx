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

type FastForwardHandler = () => boolean;
type FastForwardRegistration = {
  handler: FastForwardHandler;
  priority: number;
};

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

    for (const registration of registrations) {
      try {
        if (registration.handler()) return true;
      } catch {
        // A fast-forward helper must never interrupt the quiz result flow.
      }
    }

    return finishCurrentWebAnimations(root) > 0;
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
    context.register(idRef.current, { handler: () => handlerRef.current(), priority });
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
