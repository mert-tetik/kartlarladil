"use client";

import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import confetti from "canvas-confetti";
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
const SHOCKWAVE_DELAY_MS = 400;

const STREAK_TIER_BACKGROUND_COLORS = {
  low: "#6FAF64",
  rising: "#3B82F6",
  high: "#8B5CF6",
  maximum: "#F59E0B",
} as const;

function getStreakBackgroundColor(streak: number): string {
  if (streak >= 20) return STREAK_TIER_BACKGROUND_COLORS.maximum;
  if (streak >= 15) return STREAK_TIER_BACKGROUND_COLORS.high;
  if (streak >= 10) return STREAK_TIER_BACKGROUND_COLORS.rising;
  return STREAK_TIER_BACKGROUND_COLORS.low;
}

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
  const streakBackgroundColor = getStreakBackgroundColor(streak);
  const [exiting, setExiting] = useState(false);
  const [exitMotion, setExitMotion] = useState<StreakExitMotion | null>(null);
  const onCompleteRef = useRef(onComplete);
  const animationFrameRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const shockwaveTimeoutRef = useRef<number | null>(null);
  const [shockwaveVisible, setShockwaveVisible] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    shockwaveTimeoutRef.current = window.setTimeout(
      () => {
        setShockwaveVisible(true);
        vibrate("streak-shockwave");
      },
      reducedMotion ? 1 : SHOCKWAVE_DELAY_MS,
    );

    const visibleTimer = window.setTimeout(() => {
      const bodies = createStreakExitMotion();
      setExitMotion({
        background: { ...bodies.background },
        number: { ...bodies.number },
        icon: { ...bodies.icon },
      });
      setExiting(true);
      vibrate("streak-exit");
      void confetti({
        particleCount: 150,
        spread: 105,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#ef4444", "#ffffff"],
        disableForReducedMotion: true,
      });

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
      if (shockwaveTimeoutRef.current !== null) {
        window.clearTimeout(shockwaveTimeoutRef.current);
      }
    };
  }, []);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-hidden",
      )}
      data-streak-celebration-view
      aria-hidden="true"
    >
      <div
        data-streak-celebration-background
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-150 ease-linear",
          shockwaveVisible ? "bg-action-learn" : "bg-background",
          !exiting && "animate-streak-celebration-background-enter",
          exiting && "animate-streak-celebration-background-exit",
        )}
        style={shockwaveVisible ? { backgroundColor: streakBackgroundColor } : undefined}
        data-streak-background-color={shockwaveVisible ? streakBackgroundColor : undefined}
      />
      <div
        className={cn(
          "relative z-10 flex items-center gap-4",
          !exiting && "animate-streak-celebration-copy-enter",
        )}
      >
        <span
          className="relative inline-flex items-center justify-center"
          data-streak-count-shell
          data-streak-count
          style={exitMotion ? motionStyle(exitMotion.number) : undefined}
        >
          {shockwaveVisible && (
            <span className="pointer-events-none absolute inset-0 z-20 text-white" data-streak-text-shockwave aria-hidden="true">
              <span className="animate-streak-shockwave-ring absolute left-1/2 top-1/2 size-20 rounded-full border-[3px] border-current/80" />
              <span className="animate-streak-shockwave-ring-delayed absolute left-1/2 top-1/2 size-20 rounded-full border-2 border-current/45" />
              <span className="animate-streak-shockwave-core absolute left-1/2 top-1/2 size-5 rounded-full bg-current" />
            </span>
          )}
          <span className="relative z-10 text-7xl font-black text-white sm:text-8xl lg:text-9xl">{streak}</span>
        </span>
        <span className="relative inline-flex size-16 items-center justify-center sm:size-20" data-streak-fire-shell>
          {shockwaveVisible && (
            <span className="pointer-events-none absolute inset-0 z-0 text-red-500 opacity-35" data-streak-shockwave aria-hidden="true">
              <span className="animate-streak-shockwave-ring absolute left-1/2 top-1/2 size-12 rounded-full border-[3px] border-current/80" />
              <span className="animate-streak-shockwave-ring-delayed absolute left-1/2 top-1/2 size-12 rounded-full border-2 border-current/45" />
              <span className="animate-streak-shockwave-core absolute left-1/2 top-1/2 size-3 rounded-full bg-current" />
            </span>
          )}
          <Flame
            className={cn(
              "relative z-10 size-16 text-red-500 sm:size-20",
              !exiting && "animate-streak-fire",
            )}
            fill="currentColor"
            data-streak-fire-icon
            style={exitMotion ? motionStyle(exitMotion.icon) : undefined}
          />
        </span>
      </div>
    </div>,
    document.body,
  );
}
