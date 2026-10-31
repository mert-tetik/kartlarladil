"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const GATEWAY_FLOW_EXIT_DURATION_MS = 360;

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
  const committedChildrenRef = useRef(children);
  const onCommitRef = useRef(onCommit);
  const onPhaseChangeRef = useRef(onPhaseChange);

  const phase: GatewayFlowPhase = forceExit || transitionKey !== displayedKey ? "exit" : "enter";

  useLayoutEffect(() => {
    childrenRef.current = children;
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

    const timer = window.setTimeout(() => {
      const nextChildren = childrenRef.current;
      committedChildrenRef.current = nextChildren;
      setDisplayedChildren(nextChildren);
      setDisplayedKey(transitionKey);
      onCommitRef.current();
      onPhaseChangeRef.current("enter");
    }, GATEWAY_FLOW_EXIT_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [displayedKey, forceExit, transitionKey]);

  return (
    <div
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
