"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Flame, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { formatPoints } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";

interface QuizStreakRewardViewProps {
  streak: number;
  points: number;
  totalPoints: number;
  onComplete: () => void;
}

type FlightIcon = {
  id: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

const BREAK_DELAY_MS = 1000;
const LAST_START_MS = 780;

export function QuizStreakRewardView({ streak, points, totalPoints, onComplete }: QuizStreakRewardViewProps) {
  const { locale } = useLocale();
  const rewardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const arrivedIconIdsRef = useRef(new Set<number>());
  const [breaking, setBreaking] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    const breakTimer = window.setTimeout(() => {
      if (!rewardRef.current || !scoreRef.current) return;
      setBreaking(true);
      playSoundEffect("card-ready");

      const source = rewardRef.current.getBoundingClientRect();
      const target = scoreRef.current.getBoundingClientRect();
      const iconCount = Math.min(Math.ceil(points / 2), 25);
      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      const icons = Array.from({ length: iconCount }, (_, index) => {
        const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
        const startX = source.left + source.width * (0.22 + Math.random() * 0.56);
        const startY = source.top + source.height * (0.22 + Math.random() * 0.56);
        return {
          id: index, startX, startY, targetX, targetY,
          scatterX: (Math.random() - 0.5) * 150,
          scatterY: -35 - Math.random() * 100,
          delay: Math.round(ratio * LAST_START_MS),
        };
      });
      setFlightIcons(icons);
    }, BREAK_DELAY_MS);

    return () => {
      window.clearTimeout(breakTimer);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onComplete, points, totalPoints]);

  function handleFlightEnd(icon: FlightIcon) {
    if (arrivedIconIdsRef.current.has(icon.id)) return;
    arrivedIconIdsRef.current.add(icon.id);

    const arrivalIndex = arrivedIconIdsRef.current.size;
    setDisplayPoints(totalPoints + Math.min(points, arrivalIndex * 2));
    setScorePulse(arrivalIndex);
    playSoundEffect("points");
    vibrate("tap");

    if (arrivalIndex === flightIcons.length) {
      timersRef.current.push(window.setTimeout(() => setExiting(true), 420));
      timersRef.current.push(window.setTimeout(onComplete, 780));
    }
  }

  return createPortal(
    <div className={`fixed inset-0 z-[70] overflow-hidden bg-emerald-500 ${exiting ? "animate-streak-reward-exit" : "animate-streak-reward-enter"}`} data-streak-reward-view aria-hidden="true">
      <div className="absolute left-1/2 top-5 -translate-x-1/2 sm:top-8">
        <div className="relative flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg">
          <Star className="size-5 fill-current" aria-hidden="true" />
          <span ref={scoreRef} key={scorePulse} className={cn("text-lg font-bold", scorePulse > 0 && "animate-score-bobble")}>
            {formatPoints(locale, displayPoints)}
          </span>
        </div>
      </div>
      <div ref={rewardRef} className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4 ${breaking ? "animate-streak-reward-break" : ""}`}>
        <span className="text-7xl font-black text-white sm:text-8xl lg:text-9xl">{streak}</span>
        <Flame className="size-16 animate-streak-fire text-red-500 sm:size-20" fill="currentColor" />
      </div>
      {flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[71] animate-quiz-score-icon-flight" style={{
          "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`,
          "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
          "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`,
          animationDelay: `${icon.delay}ms`,
        } as CSSProperties} onAnimationEnd={() => handleFlightEnd(icon)}><ScoreIcon size={32} /></span>
      ))}
    </div>,
    document.body,
  );
}
