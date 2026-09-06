"use client";

import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  createStreakExitMotion,
  stepRigidBody,
  type RigidBodyState,
  type StreakExitMotion,
} from "@/features/quiz/streak-rigid-body";
import { vibrate } from "@/lib/vibration";

interface QuizStreakCelebrationViewProps {
  streak: number;
  onComplete?: () => void;
}

const VISIBLE_DURATION_MS = 1300;
const EXIT_DURATION_MS = 1000;

function motionStyle(motion: RigidBodyState): CSSProperties {
  return {
    transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotation}deg)`,
    transformOrigin: "center",
    willChange: "transform",
  };
}

export function QuizStreakCelebrationView({
  streak,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const [exiting, setExiting] = useState(false);
  const [exitMotion, setExitMotion] = useState<StreakExitMotion | null>(null);
  const onCompleteRef = useRef(onComplete);
  const animationFrameRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const visibleTimer = window.setTimeout(() => {
      const bodies = createStreakExitMotion();
      setExitMotion({
        background: { ...bodies.background },
        number: { ...bodies.number },
        icon: { ...bodies.icon },
      });
      setExiting(true);
      vibrate("streak-break");

      let elapsed = 0;
      let lastTimestamp: number | null = null;
      const tick = (timestamp: number) => {
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.032);
        lastTimestamp = timestamp;
        elapsed += delta * 1000;

        stepRigidBody(bodies.background, delta);
        stepRigidBody(bodies.number, delta);
        stepRigidBody(bodies.icon, delta);
        setExitMotion({
          background: { ...bodies.background },
          number: { ...bodies.number },
          icon: { ...bodies.icon },
        });

        if (elapsed < EXIT_DURATION_MS) {
          animationFrameRef.current = window.requestAnimationFrame(tick);
        }
      };

      animationFrameRef.current = window.requestAnimationFrame(tick);
      completionTimeoutRef.current = window.setTimeout(() => {
        onCompleteRef.current?.();
      }, EXIT_DURATION_MS);
    }, VISIBLE_DURATION_MS);

    return () => {
      window.clearTimeout(visibleTimer);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-hidden",
        !exiting && "bg-action-learn",
      )}
      data-streak-celebration-view
      aria-hidden="true"
    >
      <div
        data-streak-celebration-background
        className={cn(
          "pointer-events-none absolute inset-0 bg-action-learn",
          !exiting && "animate-streak-celebration-background-enter",
        )}
        style={exitMotion ? motionStyle(exitMotion.background) : undefined}
      />
      <div
        className={cn(
          "relative z-10 flex items-center gap-4",
          !exiting && "animate-streak-celebration-copy-enter",
        )}
      >
        <span
          className={cn(
            "text-7xl font-black text-white sm:text-8xl lg:text-9xl",
          )}
          data-streak-count
          style={exitMotion ? motionStyle(exitMotion.number) : undefined}
        >
          {streak}
        </span>
        <Flame
          className={cn(
            "size-16 text-red-500 sm:size-20",
            !exiting && "animate-streak-fire",
          )}
          fill="currentColor"
          data-streak-fire-icon
          style={exitMotion ? motionStyle(exitMotion.icon) : undefined}
        />
      </div>
    </div>,
    document.body,
  );
}
