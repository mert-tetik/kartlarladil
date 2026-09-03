"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Sparkles, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { ChestArtwork } from "@/features/quiz/components/chest-artwork";
import type { ChestTierDefinition } from "@/features/quiz/chest-rewards";
import { GEM_ASSETS, type ChestRewardOutcome, type GemType } from "@/features/gems/gem-types";
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import confetti from "canvas-confetti";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  totalPoints: number;
  onComplete: () => void;
  onRewardReady?: () => Promise<ChestRewardOutcome | null>;
  reward?: ChestRewardOutcome | null;
}

type ChestPhase = "appearing" | "idle" | "shake" | "opening" | "revealed" | "disappearing";
type PointsPhase = "hidden" | "shown" | "flying" | "added";
type LidMotion = { x: number; y: number; rotation: number };
type FlightIcon = { id: number; startX: number; startY: number; scatterX: number; scatterY: number; targetX: number; targetY: number; delay: number };

const REWARD_REVEAL_DELAY_MS = 900;
const REWARD_HOLD_BEFORE_FLIGHT_MS = 800;
const AUTO_CLOSE_AFTER_FLIGHT_MS = 1000;
const AUTO_OPEN_DELAY_MS = 700;
const CHEST_CHARGE_DURATION_MS = 780;
const DISAPPEAR_MS = 500;

export function ChestOpeningView({ tier, totalPoints, onComplete, onRewardReady, reward }: ChestOpeningViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const usesSuperWater = canUseSuperWater(locale);
  const [stableTotalPoints] = useState(totalPoints);
  const phaseRef = useRef<ChestPhase>("appearing");
  const [phase, setPhase] = useState<ChestPhase>("appearing");
  const [pointsPhase, setPointsPhase] = useState<PointsPhase>("hidden");
  const [displayPoints, setDisplayPoints] = useState(stableTotalPoints);
  const [sparkles, setSparkles] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const [lidMotion, setLidMotion] = useState<LidMotion>({ x: 0, y: 0, rotation: 0 });
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);
  const [gemFlightIcons, setGemFlightIcons] = useState<FlightIcon[]>([]);
  const [rewardOutcome, setRewardOutcome] = useState<ChestRewardOutcome | null>(reward ?? null);
  const hasAwarded = useRef(false);
  const lidRef = useRef<HTMLImageElement | null>(null);
  const totalPointsRef = useRef<HTMLSpanElement | null>(null);
  const rewardPointsRef = useRef<HTMLParagraphElement | null>(null);
  const rewardGemRef = useRef<HTMLParagraphElement | null>(null);
  const gemTargetRefs = useRef<Partial<Record<GemType, HTMLSpanElement | null>>>({});
  const animationFrameRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const pointsTimeoutRef = useRef<number | null>(null);
  const pointsSoundTimeoutRef = useRef<number | null>(null);
  const arrivalTimersRef = useRef<number[]>([]);
  const closeTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const autoOpenTimeoutRef = useRef<number | null>(null);
  const chargeTimeoutRef = useRef<number | null>(null);
  const hasStartedOpeningRef = useRef(false);
  const rewardPromiseRef = useRef<Promise<ChestRewardOutcome | null> | null>(null);

  const formatRewardText = (text: string) =>
    usesSuperWater ? formatSuperWaterText(locale, text) : text;

  const spawnSparkles = useCallback(() => {
    const next = Array.from({ length: 18 }, (_, index) => ({
      id: Date.now() + index,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 250,
    }));
    setSparkles(next);
  }, []);

  const handleCollect = useCallback(() => {
    if (hasAwarded.current) return;
    hasAwarded.current = true;
    setPhase("disappearing");
    completeTimeoutRef.current = window.setTimeout(() => onComplete(), DISAPPEAR_MS);
  }, [onComplete]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const startOpening = useCallback(() => {
    const currentPhase = phaseRef.current;

    if (
      hasStartedOpeningRef.current ||
      currentPhase === "opening" ||
      currentPhase === "revealed" ||
      currentPhase === "disappearing"
    ) {
      return;
    }

    hasStartedOpeningRef.current = true;

    const direction = Math.random() < 0.5 ? -1 : 1;
    const launchVelocityX = direction * (340 + Math.random() * 120);
    let velocityY = -(620 + Math.random() * 120);
    let velocityX = launchVelocityX;
    let rotation = 0;
    let rotationVelocity = direction * (220 + Math.random() * 110);
    let offsetX = 0;
    let offsetY = 0;
    let lastTimestamp: number | null = null;
    const gravity = 1850;
    const rotationDrag = 0.995;
    const horizontalDrag = 0.998;
    const floorY = 188 + Math.random() * 30;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
    }

    setLidMotion({ x: 0, y: 0, rotation: 0 });
    setPhase("opening");
    spawnSparkles();

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.032);
      lastTimestamp = timestamp;

      velocityY += gravity * delta;
      velocityX *= horizontalDrag;
      offsetX += velocityX * delta;
      offsetY += velocityY * delta;
      rotation += rotationVelocity * delta;
      rotationVelocity *= rotationDrag;

      if (offsetY >= floorY) {
        offsetY = floorY;
        velocityY *= -0.18;
        velocityX *= 0.86;
        rotationVelocity *= 0.82;
      }

      setLidMotion({
        x: offsetX,
        y: offsetY,
        rotation,
      });

      const shouldStop =
        offsetY >= floorY - 1 &&
        Math.abs(velocityY) < 22 &&
        Math.abs(velocityX) < 12 &&
        Math.abs(rotationVelocity) < 14;

      if (!shouldStop) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    revealTimeoutRef.current = window.setTimeout(() => {
      const reveal = (outcome: ChestRewardOutcome | null) => {
        setRewardOutcome(outcome);
        setPhase("revealed");
        setPointsPhase("shown");
        pointsTimeoutRef.current = window.setTimeout(() => {
          setPointsPhase("flying");
        }, REWARD_HOLD_BEFORE_FLIGHT_MS);
      };

      if (rewardPromiseRef.current) {
        void rewardPromiseRef.current.then(reveal);
      } else {
        reveal(null);
      }
    }, REWARD_REVEAL_DELAY_MS);

    try {
      playSoundEffect("chest-open");
      vibrate("chest-open");
      void confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.55 },
        colors: ["#facc15", "#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
        disableForReducedMotion: true,
      });
    } catch {
      // Ignore effect failures; the reward flow should keep running.
    }

    pointsSoundTimeoutRef.current = window.setTimeout(() => {
      try {
        playSoundEffect("points");
        vibrate("confetti");
      } catch {
        // Ignore effect failures; the reward flow should keep running.
      }
    }, REWARD_REVEAL_DELAY_MS);
  }, [spawnSparkles]);

  useEffect(() => {
    if (reward) {
      rewardPromiseRef.current = Promise.resolve(reward);
    } else if (onRewardReady) {
      rewardPromiseRef.current ??= onRewardReady().catch(() => null);
    }
    if (!rewardPromiseRef.current) return;
    void rewardPromiseRef.current.then(setRewardOutcome);
  }, [onRewardReady, reward]);

  useEffect(() => {
    autoOpenTimeoutRef.current = window.setTimeout(() => {
      setPhase("shake");
      chargeTimeoutRef.current = window.setTimeout(() => {
        startOpening();
      }, CHEST_CHARGE_DURATION_MS);
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      if (autoOpenTimeoutRef.current !== null) {
        window.clearTimeout(autoOpenTimeoutRef.current);
      }
      if (chargeTimeoutRef.current !== null) {
        window.clearTimeout(chargeTimeoutRef.current);
      }
    };
  }, [startOpening]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (revealTimeoutRef.current !== null) {
        window.clearTimeout(revealTimeoutRef.current);
      }
      if (pointsTimeoutRef.current !== null) {
        window.clearTimeout(pointsTimeoutRef.current);
      }
      if (pointsSoundTimeoutRef.current !== null) {
        window.clearTimeout(pointsSoundTimeoutRef.current);
      }
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      if (completeTimeoutRef.current !== null) {
        window.clearTimeout(completeTimeoutRef.current);
      }
      if (autoOpenTimeoutRef.current !== null) {
        window.clearTimeout(autoOpenTimeoutRef.current);
      }
      if (chargeTimeoutRef.current !== null) {
        window.clearTimeout(chargeTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (pointsPhase !== "flying" || !rewardPointsRef.current || !totalPointsRef.current) return;

    const start = rewardPointsRef.current.getBoundingClientRect();
    const end = totalPointsRef.current.getBoundingClientRect();

    const startX = start.left + start.width / 2;
    const startY = start.top + start.height / 2;
    const endX = end.left + end.width / 2;
    const endY = end.top + end.height / 2;

    const iconCount = getScoreFlightIconCount(tier.points);
    const latestStart = 780;
    const icons = Array.from({ length: iconCount }, (_, index) => {
      const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
      return { id: index, startX: startX + (Math.random() - 0.5) * start.width * 0.55, startY: startY + (Math.random() - 0.5) * start.height * 0.35, scatterX: (Math.random() - 0.5) * 150, scatterY: -35 - Math.random() * 100, targetX: endX, targetY: endY, delay: Math.round(ratio * latestStart) };
    });
    setFlightIcons(icons);
    arrivalTimersRef.current = icons.map((icon, index) => window.setTimeout(() => {
      setDisplayPoints(
        stableTotalPoints + getScoreFlightAwardAtArrival(tier.points, iconCount, index + 1),
      );
      playSoundEffect("points");
      vibrate("tap");
      if (index === icons.length - 1) setPointsPhase("added");
    }, icon.delay + 700));

    return () => {
      arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pointsPhase, stableTotalPoints, tier.points]);

  useLayoutEffect(() => {
    if (pointsPhase !== "flying" || !rewardOutcome?.gem || !rewardGemRef.current) return;
    const target = gemTargetRefs.current[rewardOutcome.gem.type];
    if (!target) return;
    const start = rewardGemRef.current.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const startX = start.left + start.width / 2;
    const startY = start.top + start.height / 2;
    const targetX = end.left + end.width / 2;
    const targetY = end.top + end.height / 2;
    const count = Math.max(1, rewardOutcome.gem.amount);
    setGemFlightIcons(Array.from({ length: count }, (_, index) => ({
      id: index,
      startX: startX + (Math.random() - 0.5) * 40,
      startY: startY + (Math.random() - 0.5) * 24,
      scatterX: (Math.random() - 0.5) * 120,
      scatterY: -25 - Math.random() * 80,
      targetX,
      targetY,
      delay: Math.round((count === 1 ? 0 : index / (count - 1)) * 640),
    })));
  }, [pointsPhase, rewardOutcome]);

  useEffect(() => {
    if (pointsPhase !== "added") return;

    closeTimeoutRef.current = window.setTimeout(() => {
      handleCollect();
    }, Math.max(0, AUTO_CLOSE_AFTER_FLIGHT_MS - DISAPPEAR_MS));

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [handleCollect, pointsPhase]);

  const shouldRenderRewardStack = phase === "revealed" || pointsPhase !== "hidden";
  const shouldHideRewardSource = pointsPhase === "added" || pointsPhase === "flying";

  return (
    <div
      data-chest-opening-view
      data-chest-opening-layout
      className={cn(
        "relative flex min-h-full w-full items-center justify-center overflow-hidden bg-[#121212] px-4 py-6 text-center sm:px-6 sm:py-8",
        phase === "disappearing" ? "animate-chest-screen-close" : "animate-screen-pop",
      )}
    >
      <Image
        src="/chests/chest_background.png"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden="true"
        data-chest-opening-background
        className={cn(
          "pointer-events-none absolute inset-0 z-0 object-cover opacity-0 transition-opacity duration-300 ease-out",
          (phase === "opening" || phase === "revealed" || phase === "disappearing") && "opacity-100",
        )}
      />

      <div className="relative z-10 flex h-full w-full max-w-5xl flex-1 flex-col">
        <div className="flex flex-col items-center gap-2 pt-1 sm:pt-2">
          <div
            data-chest-total-points-shell
            className={cn(
              "rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg transition-[opacity,transform] duration-300 ease-out sm:px-5",
              phase !== "opening" && phase !== "revealed" && phase !== "disappearing" && "translate-y-2 opacity-0",
            )}
          >
            <div className="flex items-center gap-2">
              <Star className="size-5 fill-current" aria-hidden="true" />
              <span
                ref={totalPointsRef}
                data-chest-total-points
                className={cn(
                  "text-lg font-bold sm:text-xl",
                  pointsPhase === "added" && "animate-score-bobble",
                )}
              >
                {formatPoints(locale, displayPoints)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 lg:hidden" data-reward-gem-hud>
            {(["blue", "green", "purple"] as const).map((type) => (
              <span key={type} className="inline-flex items-center gap-0.5 rounded-full bg-black/30 px-1.5 py-1 text-xs font-bold text-white">
                <Image src={GEM_ASSETS[type]} alt="" width={20} height={20} className="size-5 object-contain" />
                <span ref={(element) => { gemTargetRefs.current[type] = element; }}>{rewardOutcome?.balances?.[type] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-12">
          <div
            className={cn(
              "relative flex w-full max-w-xl flex-col items-center rounded-[2rem] border border-transparent bg-transparent px-6 py-8 shadow-none sm:px-8 sm:py-10",
            )}
          >
            <p
              data-chest-tier-name
              className={cn(
                "mt-1 text-center text-4xl font-bold leading-tight text-white transition-[opacity,transform] duration-300 ease-out sm:text-5xl",
                phase !== "opening" && phase !== "revealed" && phase !== "disappearing" && "translate-y-3 opacity-0",
                usesSuperWater && "font-super-water",
              )}
            >
              {formatRewardText(t(tier.labelKey))}
            </p>

            <div className="relative mt-5 sm:mt-6">
              <div
                data-chest-auto-open
                role="img"
                aria-label={phase === "revealed" ? t("chest.opened") : t("chest.title")}
                className={cn(
                  "relative flex size-[260px] scale-100 items-end justify-center overflow-visible rounded-lg opacity-100 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:size-[320px] md:size-[360px]",
                  phase === "appearing" && "animate-chest-appear",
                  phase === "revealed" && "scale-[1.03]",
                )}
                style={{ perspective: "800px" }}
              >
                <span
                  data-chest-ground-shadow
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-1 left-1/2 z-0 h-5 w-[72%] -translate-x-1/2 rounded-full bg-black/40 blur-[6px]"
                />

                <div
                  className={cn(
                    "relative flex size-full items-end justify-center",
                    phase === "idle" && "animate-chest-float",
                    phase === "shake" && "animate-chest-charge",
                    phase === "opening" && "animate-chest-pulse",
                  )}
                >
                  {shouldRenderRewardStack ? (
                    <div
                      data-chest-reward-stack
                      className={cn(
                        "pointer-events-none absolute left-1/2 top-[28px] z-40 flex w-[92%] -translate-x-1/2 flex-col items-center text-center sm:top-[32px] md:top-[36px]",
                        usesSuperWater && "font-super-water",
                        pointsPhase === "shown" && "animate-points-pop",
                      )}
                    >
                      <p
                        ref={rewardPointsRef}
                        data-chest-reward-points
                        className={cn(
                          "flex items-center justify-center gap-3 text-6xl font-bold leading-none text-amber-400 sm:text-7xl md:text-8xl",
                          shouldHideRewardSource && "opacity-0",
                        )}
                      >
                        <span>{tier.points}</span>
                        <ScoreIcon size={42} className="size-10 sm:size-12" />
                      </p>
                      {rewardOutcome?.gem ? (
                        <p ref={rewardGemRef} data-chest-reward-gem className={cn("mt-2 inline-flex items-center justify-center gap-2 text-3xl font-bold text-white lg:hidden", shouldHideRewardSource && "opacity-0")}>
                          <span>{rewardOutcome.gem.amount}</span>
                          <Image src={GEM_ASSETS[rewardOutcome.gem.type]} alt="" width={36} height={36} className="size-9 object-contain" />
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <ChestArtwork
                    tier={tier.tier}
                    className="relative z-10 size-[220px] sm:size-[270px] md:size-[310px]"
                    lidRef={lidRef}
                    priority
                    sizes="(max-width: 640px) 220px, (max-width: 768px) 270px, 310px"
                    lidStyle={{
                      transform: `translate3d(${lidMotion.x}px, ${lidMotion.y}px, 0) rotate(${lidMotion.rotation}deg)`,
                      transformOrigin: "50% 70%",
                      willChange: phase === "opening" || phase === "revealed" ? "transform" : undefined,
                    }}
                  />
                </div>
              </div>

              {sparkles.map((sparkle) => (
                <span
                  key={sparkle.id}
                  className="pointer-events-none absolute bottom-0 animate-sparkle-rise text-amber-400"
                  style={{ left: `${sparkle.left}%`, animationDelay: `${sparkle.delay}ms` }}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {flightIcons.length > 0 ? createPortal(flightIcons.map((icon) => (
        <span key={icon.id} className="pointer-events-none fixed left-0 top-0 z-[60] animate-quiz-score-icon-flight" aria-hidden="true" style={{ "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`, "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`, "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`, animationDelay: `${icon.delay}ms` } as CSSProperties}><ScoreIcon size={32} /></span>
      )), document.body) : null}
      {gemFlightIcons.length > 0 ? createPortal(gemFlightIcons.map((icon) => (
        <span key={`gem-${icon.id}`} className="pointer-events-none fixed left-0 top-0 z-[61] animate-quiz-score-icon-flight lg:hidden" aria-hidden="true" style={{ "--score-flight-start-x": `${icon.startX}px`, "--score-flight-start-y": `${icon.startY}px`, "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`, "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`, "--score-flight-target-x": `${icon.targetX}px`, "--score-flight-target-y": `${icon.targetY}px`, animationDelay: `${icon.delay}ms` } as CSSProperties} onAnimationEnd={() => playSoundEffect("gem-loot")}><Image src={rewardOutcome ? GEM_ASSETS[rewardOutcome.gem.type] : GEM_ASSETS.blue} alt="" width={28} height={28} className="size-7 object-contain" /></span>
      )), document.body) : null}
    </div>
  );
}
