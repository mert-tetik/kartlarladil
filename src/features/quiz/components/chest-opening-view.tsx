"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Gift, Sparkles, Star } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatPoints } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { CHEST_TIER_UI_CLASSES, type ChestTierDefinition } from "@/features/quiz/chest-rewards";
import confetti from "canvas-confetti";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  totalPoints: number;
  onComplete: () => void;
}

type ChestPhase = "appearing" | "idle" | "shake" | "opening" | "revealed" | "disappearing";
type PointsPhase = "hidden" | "shown" | "flying" | "added";
type LidMotion = { x: number; y: number; rotation: number };
type FlightIcon = { id: number; startX: number; startY: number; scatterX: number; scatterY: number; targetX: number; targetY: number; delay: number };

const REWARD_REVEAL_DELAY_MS = 900;
const REWARD_HOLD_BEFORE_FLIGHT_MS = 800;
const AUTO_CLOSE_AFTER_FLIGHT_MS = 1000;
const AUTO_OPEN_DELAY_MS = 500;
const DISAPPEAR_MS = 420;

export function ChestOpeningView({ tier, totalPoints, onComplete }: ChestOpeningViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const stableTotalPointsRef = useRef(totalPoints);
  const stableTotalPoints = stableTotalPointsRef.current;
  const phaseRef = useRef<ChestPhase>("appearing");
  const [phase, setPhase] = useState<ChestPhase>("appearing");
  const [pointsPhase, setPointsPhase] = useState<PointsPhase>("hidden");
  const [displayPoints, setDisplayPoints] = useState(stableTotalPoints);
  const [sparkles, setSparkles] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const [lidMotion, setLidMotion] = useState<LidMotion>({ x: 0, y: 0, rotation: 0 });
  const [flightIcons, setFlightIcons] = useState<FlightIcon[]>([]);
  const hasAwarded = useRef(false);
  const lidRef = useRef<HTMLDivElement | null>(null);
  const totalPointsRef = useRef<HTMLSpanElement | null>(null);
  const rewardPointsRef = useRef<HTMLParagraphElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const pointsTimeoutRef = useRef<number | null>(null);
  const pointsSoundTimeoutRef = useRef<number | null>(null);
  const flyTimeoutRef = useRef<number | null>(null);
  const arrivalTimersRef = useRef<number[]>([]);
  const closeTimeoutRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);
  const autoOpenTimeoutRef = useRef<number | null>(null);
  const hasStartedOpeningRef = useRef(false);

  const ui = CHEST_TIER_UI_CLASSES[tier.tier];

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
      setPhase("revealed");
      setPointsPhase("shown");
      pointsTimeoutRef.current = window.setTimeout(() => {
        setPointsPhase("flying");
      }, REWARD_HOLD_BEFORE_FLIGHT_MS);
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
    autoOpenTimeoutRef.current = window.setTimeout(() => {
      setPhase("idle");
      startOpening();
    }, AUTO_OPEN_DELAY_MS);

    return () => {
      if (autoOpenTimeoutRef.current !== null) {
        window.clearTimeout(autoOpenTimeoutRef.current);
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
      if (flyTimeoutRef.current !== null) {
        window.clearTimeout(flyTimeoutRef.current);
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

    const iconCount = Math.min(Math.ceil(tier.points / 2), 25);
    const latestStart = 780;
    const icons = Array.from({ length: iconCount }, (_, index) => {
      const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
      return { id: index, startX: startX + (Math.random() - 0.5) * start.width * 0.55, startY: startY + (Math.random() - 0.5) * start.height * 0.35, scatterX: (Math.random() - 0.5) * 150, scatterY: -35 - Math.random() * 100, targetX: endX, targetY: endY, delay: Math.round(ratio * latestStart) };
    });
    setFlightIcons(icons);
    arrivalTimersRef.current = icons.map((icon, index) => window.setTimeout(() => {
      setDisplayPoints(stableTotalPoints + Math.min(tier.points, (index + 1) * 2));
      playSoundEffect("points");
      vibrate("tap");
      if (index === icons.length - 1) setPointsPhase("added");
    }, icon.delay + 700));

    return () => {
      if (flyTimeoutRef.current !== null) {
        window.clearTimeout(flyTimeoutRef.current);
      }
      arrivalTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [pointsPhase, stableTotalPoints, tier.points]);

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
      className="animate-screen-pop relative flex min-h-full w-full items-center justify-center overflow-hidden px-4 py-6 text-center sm:px-6 sm:py-8"
    >
      <div className="relative flex h-full w-full max-w-5xl flex-1 flex-col">
        <div className="flex justify-center pt-1 sm:pt-2">
          <div
            data-chest-total-points-shell
            className="rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-lg sm:px-5"
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
        </div>

        <div className="flex flex-1 items-center justify-center py-10 sm:py-12">
          <div
            className={cn(
              "relative flex w-full max-w-xl flex-col items-center rounded-[2rem] border border-transparent bg-transparent px-6 py-8 shadow-none transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-8 sm:py-10",
              phase === "disappearing" && "translate-y-2 scale-[0.94] opacity-0",
            )}
          >
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">{t("chest.title")}</h2>
            <p
              className={cn(
                "mt-1 text-base font-semibold sm:text-lg",
                CHEST_TIER_UI_CLASSES[tier.tier].base.replace("bg-", "text-"),
              )}
            >
              {t(tier.labelKey)}
            </p>

            <div className="relative mt-6 sm:mt-8">
              <div
                data-chest-auto-open
                role="img"
                aria-label={phase === "revealed" ? t("chest.opened") : t("chest.title")}
                className={cn(
                  "relative flex size-[204px] items-end justify-center overflow-visible rounded-lg transition-transform sm:size-[244px] md:size-[272px]",
                  phase === "idle" && "animate-chest-float",
                  phase === "shake" && "animate-chest-shake",
                  phase === "revealed" && "scale-[1.03]",
                )}
                style={{ perspective: "800px" }}
              >
                {shouldRenderRewardStack ? (
                  <div
                    data-chest-reward-stack
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-[12px] z-40 flex w-[88%] -translate-x-1/2 flex-col items-center text-center sm:top-[16px] md:top-[20px]",
                      pointsPhase === "shown" && "animate-points-pop",
                    )}
                  >
                    <div className="flex items-center gap-2 text-amber-400">
                      <Gift className="size-5 sm:size-6" aria-hidden="true" />
                      <span className="text-base font-semibold sm:text-lg">{t("chest.rewardTitle")}</span>
                    </div>
                    <p
                      ref={rewardPointsRef}
                      data-chest-reward-points
                      className={cn(
                        "mt-1 flex items-center justify-center gap-2 text-4xl font-bold leading-none text-amber-400 sm:text-5xl",
                        shouldHideRewardSource && "opacity-0",
                      )}
                    >
                      <span>{tier.points}</span>
                      <ScoreIcon size={34} className="size-8 sm:size-10" />
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-400 sm:text-sm">
                      {t("chest.pointsLabel")}
                    </p>
                  </div>
                ) : null}

                <div className="relative h-[160px] w-[160px] sm:h-[194px] sm:w-[194px] md:h-[220px] md:w-[220px]">
                  <div className={cn("absolute bottom-0 left-[6px] right-[6px] h-[98px] rounded-b-[14px] rounded-t-[10px] border-[3px] border-black/15 shadow-sm sm:left-[8px] sm:right-[8px] sm:h-[120px] md:left-[10px] md:right-[10px] md:h-[136px]", ui.base)}>
                    <div className="absolute inset-x-0 top-0 h-3 bg-black/10" />
                    <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80 sm:w-10", ui.band)} />
                    <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                    <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                  </div>

                  <div
                    ref={lidRef}
                    data-chest-lid
                    className={cn(
                      "absolute left-[6px] right-[6px] top-0 z-30 h-[52px] rounded-t-[16px] rounded-b-[8px] border-[3px] border-black/15 shadow-sm sm:left-[8px] sm:right-[8px] sm:h-[64px] md:left-[10px] md:right-[10px] md:h-[72px]",
                      ui.lid,
                    )}
                    style={{
                      transform: `translate3d(${lidMotion.x}px, ${lidMotion.y}px, 0) rotate(${lidMotion.rotation}deg)`,
                      transformOrigin: "50% 70%",
                      willChange: phase === "opening" || phase === "revealed" ? "transform" : undefined,
                    }}
                  >
                    <div className="absolute inset-x-0 bottom-0 h-2 bg-black/12" />
                    <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80 sm:w-10", ui.band)} />
                    <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                    <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                    <div className={cn("absolute left-1/2 bottom-0 z-20 h-10 w-10 -translate-x-1/2 translate-y-1/3 rounded-full border-[3px] border-black/15 shadow-sm sm:h-12 sm:w-12", ui.lock)}>
                      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 sm:h-3.5 sm:w-3.5" />
                    </div>
                  </div>
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
    </div>
  );
}
