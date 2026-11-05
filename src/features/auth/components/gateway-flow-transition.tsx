"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const GATEWAY_FLOW_EXIT_DURATION_MS = 360;
const GATEWAY_FLOW_EXIT_FALLBACK_BUFFER_MS = 50;

function parseCssTimeMs(value: string): number | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) return null;

  const numericValue = Number.parseFloat(normalizedValue);
  if (!Number.isFinite(numericValue)) return null;
  if (normalizedValue.endsWith("ms")) return numericValue;
  if (normalizedValue.endsWith("s")) return numericValue * 1000;
  return null;
}

function getAnimationFallbackDurationMs(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  if (computedStyle.animationName === "none") return 0;

  const durations = computedStyle.animationDuration.split(",").map(parseCssTimeMs);
  const delays = computedStyle.animationDelay.split(",").map(parseCssTimeMs);
  if (durations.some((duration) => duration === null) || delays.some((delay) => delay === null)) {
    return GATEWAY_FLOW_EXIT_DURATION_MS + GATEWAY_FLOW_EXIT_FALLBACK_BUFFER_MS;
  }

  const animationCount = Math.max(durations.length, delays.length);
  const longestAnimationMs = Array.from({ length: animationCount }, (_, index) => {
    const duration = durations[index % durations.length] ?? 0;
    const delay = delays[index % delays.length] ?? 0;
    return Math.max(0, duration + delay);
  }).reduce((longest, current) => Math.max(longest, current), 0);

  return longestAnimationMs + GATEWAY_FLOW_EXIT_FALLBACK_BUFFER_MS;
}

export type GatewayFlowPhase = "enter" | "exit";

export function GatewayFlowTransition({
  children,
  transitionKey,
  forceExit = false,
  className,
  onCommit,
  onPhaseChange,
}: {
  children: ReactNode;
  transitionKey: string;
  forceExit?: boolean;
  className?: string;
  onCommit: () => void;
  onPhaseChange: (phase: GatewayFlowPhase) => void;
}) {
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [displayedKey, setDisplayedKey] = useState(transitionKey);
  const childrenRef = useRef(children);
  const transitionKeyRef = useRef(transitionKey);
  const committedChildrenRef = useRef(children);
  const transitionElementRef = useRef<HTMLDivElement | null>(null);
  const onCommitRef = useRef(onCommit);
  const onPhaseChangeRef = useRef(onPhaseChange);

  const phase: GatewayFlowPhase = forceExit || transitionKey !== displayedKey ? "exit" : "enter";

  useLayoutEffect(() => {
    childrenRef.current = children;
    transitionKeyRef.current = transitionKey;
    onCommitRef.current = onCommit;
    onPhaseChangeRef.current = onPhaseChange;

    // Keep the last stable screen synchronized with local selection state.
    // Otherwise the exit animation can briefly render the first version of
    // that screen, making a different option look selected even though the
    // submitted value is still correct.
    if (!forceExit && transitionKey === displayedKey && committedChildrenRef.current !== children) {
      committedChildrenRef.current = children;
      setDisplayedChildren(children);
    }
  }, [children, displayedKey, forceExit, onCommit, onPhaseChange, transitionKey]);

  useEffect(() => {
    if (forceExit) {
      onPhaseChangeRef.current("exit");
      return;
    }

    if (transitionKey === displayedKey) return;

    onPhaseChangeRef.current("exit");

    const exitingScreen = transitionElementRef.current?.querySelector<HTMLElement>(
      "[data-gateway-flow-screen-exit]",
    ) ?? null;
    let hasCommitted = false;
    let fallbackTimer: number | undefined;

    const commitTransition = () => {
      if (hasCommitted) return;
      hasCommitted = true;
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      exitingScreen?.removeEventListener("animationend", handleAnimationEnd);

      const nextChildren = childrenRef.current;
      committedChildrenRef.current = nextChildren;
      setDisplayedChildren(nextChildren);
      setDisplayedKey(transitionKeyRef.current);
      onCommitRef.current();
      onPhaseChangeRef.current("enter");
    };

    const handleAnimationEnd = (event: Event) => {
      const animationEvent = event as AnimationEvent;
      if (
        event.target !== exitingScreen ||
        animationEvent.animationName !== "gateway-flow-item-exit"
      ) {
        return;
      }

      commitTransition();
    };

    exitingScreen?.addEventListener("animationend", handleAnimationEnd);
    fallbackTimer = window.setTimeout(
      commitTransition,
      exitingScreen
        ? getAnimationFallbackDurationMs(exitingScreen)
        : GATEWAY_FLOW_EXIT_DURATION_MS,
    );

    return () => {
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      exitingScreen?.removeEventListener("animationend", handleAnimationEnd);
    };
  }, [displayedKey, forceExit, transitionKey]);

  return (
    <div
      ref={transitionElementRef}
      className={cn(
        "gateway-flow-transition",
        className,
        phase === "exit" ? "gateway-flow-transition--exit" : "gateway-flow-transition--enter",
      )}
      data-gateway-flow-phase={phase}
    >
      {phase === "exit" ? displayedChildren : children}
    </div>
  );
}
