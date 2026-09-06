"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Flame, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RewardGemHud, useGemRewardDisplay } from "@/features/progress/components/reward-gem-hud";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";
import { useAuthSession } from "@/features/auth/auth-client";
import { awardProgressGemRewardAction } from "@/features/gems/gem-actions";
import type { GemBalances, GemRewards } from "@/features/gems/gem-types";
import { formatPoints } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import {
  createStreakExitMotion,
  stepRigidBody,
  type RigidBodyState,
  type StreakExitMotion,
} from "@/features/quiz/streak-rigid-body";

interface QuizStreakRewardViewProps {
  streak: number;
  points: number;
  totalPoints: number;
  quizSessionId?: string;
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
const EXIT_DURATION_MS = 1000;

function motionStyle(motion: RigidBodyState): CSSProperties {
  return {
    transform: `translate3d(${motion.x}px, ${motion.y}px, 0) rotate(${motion.rotation}deg)`,
    transformOrigin: "center",
    willChange: "transform",
  };
}

export function QuizStreakRewardView({ streak, points, totalPoints, quizSessionId, onComplete }: QuizStreakRewardViewProps) {
  const { locale } = useLocale();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const rewardRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const arrivedIconIdsRef = useRef(new Set<number>());
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const animationFrameRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const [displayPoints, setDisplayPoints] = useState(totalPoints);
  const [scorePulse, setScorePulse] = useState(0);
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);
  const [gemRewards, setGemRewards] = useState<GemRewards>([]);
  const [breakMotion, setBreakMotion] = useState<StreakExitMotion | null>(null);
  const gemFinalBalancesRef = useRef<GemBalances | null>(null);
  const {
    balances: gemDisplayBalances,
    pulse: gemPulse,
    prepare: prepareGemRewardDisplay,
    handleGemArrive,
    finish: finishGemRewardDisplay,
  } = useGemRewardDisplay();

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!user || !quizSessionId || streak <= 0) return;
    let active = true;

    void awardProgressGemRewardAction({
      source: "quiz-streak",
      claimKey: `quiz-streak:${quizSessionId}`,
      streak,
    }).then((result) => {
      if (!active || !result.success) return;
      const rewards = result.awarded ? result.rewards ?? [] : [];
      if (result.balances) {
        gemFinalBalancesRef.current = result.balances;
        prepareGemRewardDisplay(result.balances, rewards);
        updateProfileField({
          blueGems: result.balances.blue,
          greenGems: result.balances.green,
          purpleGems: result.balances.purple,
        });
      }
      if (result.awarded && result.rewards?.length) setGemRewards(result.rewards);
    });

    return () => {
      active = false;
    };
  }, [prepareGemRewardDisplay, quizSessionId, streak, updateProfileField, user]);

  useEffect(() => {
    const breakTimer = window.setTimeout(() => {
      const bodies = createStreakExitMotion();
      setBreakMotion({
        background: { ...bodies.background },
        number: { ...bodies.number },
        icon: { ...bodies.icon },
      });
      vibrate("streak-break");

      if (rewardRef.current && scoreRef.current) {
        const source = rewardRef.current.getBoundingClientRect();
        const target = scoreRef.current.getBoundingClientRect();
        const iconCount = getScoreFlightIconCount(points);
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
      }

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
        setBreakMotion({
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
        if (completedRef.current) return;
        completedRef.current = true;
        onCompleteRef.current();
      }, EXIT_DURATION_MS);
    }, BREAK_DELAY_MS);

    return () => {
      window.clearTimeout(breakTimer);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, [points]);

  function handleFlightEnd(icon: FlightIcon) {
    if (arrivedIconIdsRef.current.has(icon.id)) return;
    arrivedIconIdsRef.current.add(icon.id);

    const arrivalIndex = arrivedIconIdsRef.current.size;
    setDisplayPoints(
      totalPoints + getScoreFlightAwardAtArrival(points, flightIcons.length, arrivalIndex),
    );
    setScorePulse(arrivalIndex);
    playSoundEffect("points");
    vibrate("tap");

    // The reward view closes on the deterministic one-second break timer.
    // Flight completion only updates the score and feedback while it remains mounted.
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-hidden bg-transparent animate-streak-reward-enter" data-streak-reward-view aria-hidden="true">
      <div
        data-streak-reward-background
        className="pointer-events-none absolute inset-0 bg-action-learn"
        style={breakMotion ? motionStyle(breakMotion.background) : undefined}
      />
      <div className="absolute left-1/2 top-5 -translate-x-1/2 sm:top-8">
        <div className="relative flex items-center gap-2 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-4 py-2 text-white shadow-lg">
          <Star className="size-5 fill-current" aria-hidden="true" />
          <span ref={scoreRef} key={scorePulse} className={cn("text-lg font-bold", scorePulse > 0 && "animate-score-bobble")}>
            {formatPoints(locale, displayPoints)}
          </span>
        </div>
        <RewardGemHud className="mt-2" balances={gemDisplayBalances} pulse={gemPulse} animate />
      </div>
      <div ref={rewardRef} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
        <span
          className="text-7xl font-black text-white sm:text-8xl lg:text-9xl"
          style={breakMotion ? motionStyle(breakMotion.number) : undefined}
        >
          {streak}
        </span>
        <Flame
          className="size-16 animate-streak-fire text-red-500 sm:size-20"
          fill="currentColor"
          style={breakMotion ? motionStyle(breakMotion.icon) : undefined}
        />
      </div>
      {flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[71] animate-quiz-score-icon-flight" style={{
          "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`,
          "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
          "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`,
          animationDelay: `${icon.delay}ms`,
        } as CSSProperties} onAnimationEnd={() => handleFlightEnd(icon)}><ScoreIcon size={32} /></span>
      ))}
      <GemRewardFlight
        key={gemRewards.map((item) => `${item.type}-${item.amount}`).join("|") || "no-gem-reward"}
        rewards={gemRewards}
        sourceRef={rewardRef}
        startDelayMs={BREAK_DELAY_MS}
        onGemArrive={handleGemArrive}
        onComplete={() => {
          finishGemRewardDisplay(gemFinalBalancesRef.current);
          void refreshProfile();
        }}
      />
    </div>,
    document.body,
  );
}
