"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Flame } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { formatPoints } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { playSoundEffect } from "@/lib/sound-effects";

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
const FLIGHT_DURATION_MS = 700;
const LAST_START_MS = 780;

export function QuizStreakRewardView({ streak, points, totalPoints, onComplete }: QuizStreakRewardViewProps) {
  const { locale } = useLocale();
  const rewardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const [breaking, setBreaking] = useState(false);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);

  useEffect(() => {
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
      timersRef.current = icons.map((icon, index) => window.setTimeout(() => {
        setDisplayPoints(totalPoints + Math.min(points, (index + 1) * 2));
        playSoundEffect("points");
        if (index === icons.length - 1) {
          timersRef.current.push(window.setTimeout(onComplete, 420));
        }
      }, icon.delay + FLIGHT_DURATION_MS));
    }, BREAK_DELAY_MS);

    return () => {
      window.clearTimeout(breakTimer);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onComplete, points, totalPoints]);

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-emerald-500" data-streak-reward-view aria-hidden="true">
      <div ref={scoreRef} className="absolute right-5 top-5 flex items-center gap-2 rounded-full bg-black/20 px-4 py-2 text-white sm:right-8 sm:top-8">
        <ScoreIcon size={24} className="size-6" />
        <span className="text-xl font-black">{formatPoints(locale, displayPoints)}</span>
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
        } as CSSProperties}><ScoreIcon size={32} /></span>
      ))}
    </div>,
    document.body,
  );
}
