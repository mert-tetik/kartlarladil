"use client";

import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";

interface QuizStreakCelebrationViewProps {
  streak: number;
  onComplete?: () => void;
}

const VISIBLE_DURATION_MS = 1300;
const EXIT_DURATION_MS = 820;

type RigidBodyMotion = {
  launchX: string;
  launchY: string;
  launchRotation: string;
  apexX: string;
  apexY: string;
  apexRotation: string;
  landingX: string;
  landingY: string;
  landingRotation: string;
  fallX: string;
  fallY: string;
  fallRotation: string;
};

type StreakExitMotion = {
  background: RigidBodyMotion;
  number: RigidBodyMotion;
  icon: RigidBodyMotion;
};

function createRigidBodyMotion(horizontalSpread: number, verticalSpread: number): RigidBodyMotion {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const distance = direction * (horizontalSpread + Math.random() * horizontalSpread * 0.75);
  const rotation = direction * (12 + Math.random() * 22);
  const fallRotation = rotation + direction * (35 + Math.random() * 65);

  return {
    launchX: `${distance * 0.18}px`,
    launchY: `-${Math.round(verticalSpread * 0.5 + Math.random() * verticalSpread * 0.25)}px`,
    launchRotation: `${rotation * 0.25}deg`,
    apexX: `${distance * 0.5}px`,
    apexY: `-${Math.round(verticalSpread + Math.random() * verticalSpread * 0.45)}px`,
    apexRotation: `${rotation}deg`,
    landingX: `${distance}px`,
    landingY: `${Math.round(28 + Math.random() * 18)}vh`,
    landingRotation: `${fallRotation * 0.7}deg`,
    fallX: `${distance + direction * Math.round(24 + Math.random() * 70)}px`,
    fallY: `${Math.round(112 + Math.random() * 18)}vh`,
    fallRotation: `${fallRotation}deg`,
  };
}

function createStreakExitMotion(): StreakExitMotion {
  return {
    background: createRigidBodyMotion(36, 130),
    number: createRigidBodyMotion(100, 180),
    icon: createRigidBodyMotion(130, 210),
  };
}

function motionStyle(prefix: "background" | "number" | "icon", motion: RigidBodyMotion): CSSProperties {
  return {
    [`--streak-${prefix}-launch-x`]: motion.launchX,
    [`--streak-${prefix}-launch-y`]: motion.launchY,
    [`--streak-${prefix}-launch-rotation`]: motion.launchRotation,
    [`--streak-${prefix}-apex-x`]: motion.apexX,
    [`--streak-${prefix}-apex-y`]: motion.apexY,
    [`--streak-${prefix}-apex-rotation`]: motion.apexRotation,
    [`--streak-${prefix}-landing-x`]: motion.landingX,
    [`--streak-${prefix}-landing-y`]: motion.landingY,
    [`--streak-${prefix}-landing-rotation`]: motion.landingRotation,
    [`--streak-${prefix}-fall-x`]: motion.fallX,
    [`--streak-${prefix}-fall-y`]: motion.fallY,
    [`--streak-${prefix}-fall-rotation`]: motion.fallRotation,
  } as CSSProperties;
}

export function QuizStreakCelebrationView({
  streak,
  onComplete,
}: QuizStreakCelebrationViewProps) {
  const [exiting, setExiting] = useState(false);
  const [exitMotion, setExitMotion] = useState<StreakExitMotion | null>(null);

  useEffect(() => {
    playSoundEffect("streak-fire");

    const timer = window.setTimeout(() => {
      setExitMotion(createStreakExitMotion());
      setExiting(true);
    }, VISIBLE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!exiting) return;

    const timer = window.setTimeout(() => onComplete?.(), EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [exiting, onComplete]);

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
          exiting
            ? "animate-streak-celebration-background-exit"
            : "animate-streak-celebration-background-enter",
        )}
        style={exitMotion ? motionStyle("background", exitMotion.background) : undefined}
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
            exiting && "animate-streak-celebration-number-exit",
          )}
          data-streak-count
          style={exitMotion ? motionStyle("number", exitMotion.number) : undefined}
        >
          {streak}
        </span>
        <Flame
          className={cn(
            "size-16 text-red-500 animate-streak-fire sm:size-20",
            exiting && "animate-streak-celebration-icon-exit",
          )}
          fill="currentColor"
          data-streak-fire-icon
          style={exitMotion ? motionStyle("icon", exitMotion.icon) : undefined}
        />
      </div>
    </div>,
    document.body,
  );
}
