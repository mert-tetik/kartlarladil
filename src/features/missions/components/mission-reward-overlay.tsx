"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { useProgressStats } from "@/features/progress/progress-client";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { useLocale } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";

interface MissionRewardOverlayProps {
  mode: { kind: "chest"; tier: ChestTierDefinition } | { kind: "points"; amount: number; source?: DOMRect } | null;
  onComplete: () => void;
}

const EXIT_DURATION_MS = 500;
const POINT_DROP_DELAY_MS = 220;
const POINT_CLOSE_DELAY_MS = 500;

export function MissionRewardOverlay({ mode, onComplete }: MissionRewardOverlayProps) {
  const { stats } = useProgressStats();
  const [activeMode, setActiveMode] = useState(mode);
  const [exiting, setExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode) {
      setActiveMode(mode);
      setExiting(false);
      return;
    }

    setActiveMode(null);
    setExiting(false);
  }, [mode]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleChildComplete = useCallback(() => {
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
    }

    setExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      setActiveMode(null);
      setExiting(false);
      onComplete();
    }, EXIT_DURATION_MS);
  }, [onComplete]);

  if (!activeMode) {
    return null;
  }

  if (activeMode.kind === "points") {
    return <MissionPointsFlight amount={activeMode.amount} source={activeMode.source} totalPoints={stats.totalPoints} onComplete={handleChildComplete} />;
  }

  const overlay = (
    <div
      data-mission-reward-overlay
      data-state={exiting ? "closing" : "open"}
      className={cn(
        "animate-screen-pop fixed inset-0 z-50 overflow-hidden bg-background transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        exiting ? "opacity-0" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          exiting ? "scale-[0.985] opacity-0" : "scale-100 opacity-100",
        )}
      >
        <ChestOpeningView tier={activeMode.tier} totalPoints={stats.totalPoints} onComplete={handleChildComplete} />
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(overlay, document.body);
}

function MissionPointsFlight({ amount, source, totalPoints, onComplete }: { amount: number; source?: DOMRect; totalPoints: number; onComplete: () => void }) {
  const { locale } = useLocale();
  const scoreRef = useRef<HTMLSpanElement>(null);
  const arrivedRef = useRef(new Set<number>());
  const timersRef = useRef<number[]>([]);
  const [visible, setVisible] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [pulse, setPulse] = useState(0);
  const [icons, setIcons] = useState<Array<{ id: number; startX: number; startY: number; scatterX: number; scatterY: number; targetX: number; targetY: number; delay: number }>>([]);

  useEffect(() => {
    const timers = timersRef.current;
    const startTimer = window.setTimeout(() => {
      if (!scoreRef.current) return;
      setVisible(true);
      const target = scoreRef.current.getBoundingClientRect();
      const count = getScoreFlightIconCount(amount);
      const originX = source ? source.left + source.width / 2 : window.innerWidth / 2;
      const originY = source ? source.top + source.height / 2 : window.innerHeight / 2;
      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      setIcons(Array.from({ length: count }, (_, index) => ({ id: index, startX: originX + (Math.random() - 0.5) * 80, startY: originY + (Math.random() - 0.5) * 50, scatterX: (Math.random() - 0.5) * 150, scatterY: -35 - Math.random() * 100, targetX, targetY, delay: Math.round((count === 1 ? 0 : index / (count - 1)) * 780) })));
    }, 100);
    return () => { window.clearTimeout(startTimer); timers.forEach((timer) => window.clearTimeout(timer)); };
  }, [amount, source]);

  function handleArrival(id: number) {
    if (arrivedRef.current.has(id)) return;
    arrivedRef.current.add(id);
    const index = arrivedRef.current.size;
    setDisplayPoints(
      totalPoints + getScoreFlightAwardAtArrival(amount, icons.length, index),
    );
    setPulse(index);
    playSoundEffect("points");
    vibrate("tap");
    if (index === icons.length) {
      timersRef.current.push(window.setTimeout(() => setVisible(false), 420));
      timersRef.current.push(window.setTimeout(onComplete, 920));
    }
  }

  return createPortal(<>
    <div className={cn("pointer-events-none fixed left-1/2 top-3 z-[70] -translate-x-1/2 transition-all duration-300", visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0")}>
      <div className="relative flex items-center gap-2 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-white shadow-lg"><Star className="size-5 fill-current" /><span ref={scoreRef} key={pulse} className={cn("text-lg font-bold", pulse > 0 && "animate-score-bobble")}>{formatPoints(locale, displayPoints)}</span></div>
    </div>
    {icons.map((icon) => <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[71] animate-quiz-score-icon-flight" style={{ "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`, "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`, "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`, animationDelay: `${icon.delay}ms` } as CSSProperties} onAnimationEnd={() => handleArrival(icon.id)}><ScoreIcon size={32} /></span>)}
  </>, document.body);
}

function MissionPointsCelebration({
  amount,
  totalPoints,
  onComplete,
}: {
  amount: number;
  totalPoints: number;
  onComplete: () => void;
}) {
  const { locale } = useLocale();
  const [bonusPhase, setBonusPhase] = useState<"idle" | "dropping" | "bobble">("idle");
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const dropTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const bonusCompletedRef = useRef(false);

  useEffect(() => {
    playSoundEffect("mission-claim");
    vibrate("confetti");

    dropTimerRef.current = window.setTimeout(() => {
      setBonusPhase("dropping");
    }, POINT_DROP_DELAY_MS);

    return () => {
      if (dropTimerRef.current !== null) {
        window.clearTimeout(dropTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function handleAnimationEnd() {
    if (bonusCompletedRef.current) {
      return;
    }

    bonusCompletedRef.current = true;
    setDisplayPoints(totalPoints + amount);
    setBonusPhase("bobble");

    closeTimerRef.current = window.setTimeout(() => {
      onComplete();
    }, POINT_CLOSE_DELAY_MS);
  }

  return (
    <div
      data-mission-points-celebration
      className="relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-85" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.18),_transparent_26%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.12),_transparent_30%)]" />
      </div>

      <div className="relative flex items-center justify-center">
        <div
          data-mission-total-points-shell
          className="relative flex min-w-[min(76vw,17rem)] items-center justify-center gap-2.5 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-6 py-4 text-white shadow-[0_16px_40px_rgba(245,158,11,0.22)] sm:min-w-[19rem] sm:px-8 sm:py-5"
        >
          <Star className="size-6 fill-current sm:size-7" aria-hidden="true" />
          <span
            data-mission-total-points
            className={cn(
              "text-3xl font-bold tracking-tight sm:text-4xl",
              bonusPhase === "bobble" && "animate-score-bobble",
            )}
          >
            {formatPoints(locale, displayPoints)}
          </span>
          {bonusPhase === "dropping" ? (
            <span
              className="animate-mission-points-fall-far pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-4xl font-bold text-amber-100 drop-shadow-[0_10px_30px_rgba(255,255,255,0.25)] sm:text-5xl"
              onAnimationEnd={handleAnimationEnd}
            >
              <span>{amount}</span>
              <ScoreIcon size={32} className="size-8 sm:size-10" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
