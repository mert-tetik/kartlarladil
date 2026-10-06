"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type GameUITransitionDirection = "forward" | "backward";

interface GameUITransitionProps {
  screenKey: string;
  direction: GameUITransitionDirection;
  children: ReactNode;
  className?: string;
}

interface ScreenSnapshot {
  key: string;
  children: ReactNode;
}

interface ActiveTransition {
  previous: ScreenSnapshot;
  current: ScreenSnapshot;
  direction: GameUITransitionDirection;
}

const GAME_UI_TRANSITION_DURATION_MS = 460;

export function GameUITransition({
  screenKey,
  direction,
  children,
  className,
}: GameUITransitionProps) {
  const latestChildrenRef = useRef(children);
  const committedScreenRef = useRef<ScreenSnapshot>({ key: screenKey, children });
  const [activeTransition, setActiveTransition] = useState<ActiveTransition | null>(null);

  useLayoutEffect(() => {
    latestChildrenRef.current = children;

    if (committedScreenRef.current.key === screenKey) {
      committedScreenRef.current = { key: screenKey, children };
    }
  }, [children, screenKey]);

  useLayoutEffect(() => {
    if (committedScreenRef.current.key === screenKey) return;

    const previous = committedScreenRef.current;
    const current = { key: screenKey, children: latestChildrenRef.current };

    committedScreenRef.current = current;
    setActiveTransition({ previous, current, direction });

    const timer = window.setTimeout(() => {
      committedScreenRef.current = {
        key: screenKey,
        children: latestChildrenRef.current,
      };
      setActiveTransition(null);
    }, GAME_UI_TRANSITION_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [direction, screenKey]);

  return (
    <div className={cn("relative h-0 min-h-0 flex-1 overflow-hidden", className)} data-game-ui-transition>
      {activeTransition ? (
        <>
          <div
            key={`previous-${activeTransition.previous.key}`}
            className={cn(
              "game-ui-transition-screen",
              direction === "forward"
                ? "game-ui-transition-out-left"
                : "game-ui-transition-out-right",
            )}
            data-game-ui-transition-screen="previous"
          >
            {activeTransition.previous.children}
          </div>
          <div
            key={`current-${screenKey}`}
            className={cn(
              "game-ui-transition-screen",
              direction === "forward"
                ? "game-ui-transition-in-right"
                : "game-ui-transition-in-left",
            )}
            data-game-ui-transition-screen="current"
          >
            {activeTransition.current.children}
          </div>
        </>
      ) : (
        <div
          key={`current-${screenKey}`}
          className="game-ui-transition-screen"
          data-game-ui-transition-screen="current"
        >
          {children}
        </div>
      )}
    </div>
  );
}
