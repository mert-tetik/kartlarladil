"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { CHEST_TIER_UI_CLASSES, type ChestTierDefinition } from "@/features/quiz/chest-rewards";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface ChestOpeningViewProps {
  tier: ChestTierDefinition;
  onComplete: () => void;
}

type ChestPhase = "appearing" | "idle" | "shake" | "opening" | "revealed" | "disappearing";
type LidMotion = { x: number; y: number; rotation: number };

export function ChestOpeningView({ tier, onComplete }: ChestOpeningViewProps) {
  const t = useT();
  const [phase, setPhase] = useState<ChestPhase>("appearing");
  const [sparkles, setSparkles] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const [lidMotion, setLidMotion] = useState<LidMotion>({ x: 0, y: 0, rotation: 0 });
  const hasAwarded = useRef(false);
  const lidRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const revealTimeoutRef = useRef<number | null>(null);
  const pointsTimeoutRef = useRef<number | null>(null);

  const ui = CHEST_TIER_UI_CLASSES[tier.tier];

  useEffect(() => {
    const timer = setTimeout(() => setPhase("idle"), 500);
    return () => clearTimeout(timer);
  }, []);

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
    };
  }, []);

  function spawnSparkles() {
    const next = Array.from({ length: 18 }, (_, index) => ({
      id: Date.now() + index,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 250,
    }));
    setSparkles(next);
  }

  function handleTap() {
    if (phase === "appearing" || phase === "opening" || phase === "revealed" || phase === "disappearing") return;

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
    }, 900);

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

    pointsTimeoutRef.current = window.setTimeout(() => {
      try {
        playSoundEffect("points");
        vibrate("confetti");
      } catch {
        // Ignore effect failures; the reward flow should keep running.
      }
    }, 900);
  }

  function handleCollect() {
    if (hasAwarded.current) return;
    hasAwarded.current = true;
    setPhase("disappearing");
    setTimeout(() => onComplete(), 350);
  }

  return (
    <div
      data-chest-opening-view
      className="relative mx-auto flex w-full max-w-xl flex-col items-center justify-center px-4 py-6 text-center sm:py-8"
    >
      <div
        className={cn(
          "relative flex flex-col items-center transition-all duration-300",
          phase === "disappearing" && "scale-75 opacity-0",
        )}
      >
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{t("chest.title")}</h2>
        <p className={cn("mt-2 text-sm font-semibold sm:text-base", CHEST_TIER_UI_CLASSES[tier.tier].base.replace("bg-", "text-"))}>
          {t(tier.labelKey)}
        </p>

        <div className="relative mt-8 sm:mt-10">
          {phase === "revealed" ? (
            <div className={cn("pointer-events-none absolute inset-0 -z-10 animate-chest-glow rounded-full blur-2xl", ui.glow)} />
          ) : null}

          <button
            type="button"
            onClick={handleTap}
            disabled={phase === "revealed" || phase === "disappearing"}
            className={cn(
              "relative flex size-[204px] items-end justify-center overflow-visible rounded-lg transition-transform focus:outline-none sm:size-[244px] md:size-[272px]",
              phase === "idle" && "animate-chest-float",
              phase === "shake" && "animate-chest-shake",
              phase === "revealed" && "scale-[1.03]",
            )}
            style={{ cursor: phase === "revealed" ? "default" : "pointer", perspective: "800px" }}
            aria-label={phase === "revealed" ? t("chest.opened") : t("chest.tapToOpen")}
          >
            <div className={cn("absolute bottom-3 left-1/2 h-[82px] w-[150px] -translate-x-1/2 rounded-full opacity-35 blur-2xl sm:h-[98px] sm:w-[176px] md:h-[112px] md:w-[196px]", ui.glow)} />

            {phase === "revealed" ? (
              <div
                data-chest-reward-stack
                className="pointer-events-none absolute left-1/2 top-[12px] z-40 flex w-[88%] -translate-x-1/2 animate-points-pop flex-col items-center text-center sm:top-[16px] md:top-[20px]"
              >
                <div className="flex items-center gap-2 text-foreground drop-shadow-[0_6px_18px_rgba(255,255,255,0.35)] dark:drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
                  <Gift className="size-5 sm:size-6" aria-hidden="true" />
                  <span className="text-base font-semibold sm:text-lg">{t("chest.rewardTitle")}</span>
                </div>
                <p className="mt-1 text-4xl font-bold leading-none text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.5)] sm:text-5xl">
                  +{tier.points}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 sm:text-sm">
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
          </button>

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

        {phase === "appearing" || phase === "idle" || phase === "shake" || phase === "opening" ? (
          <p className="mt-8 text-sm font-semibold text-foreground-secondary">
            {t("chest.tapToOpen")}
          </p>
        ) : null}

        {phase === "revealed" ? (
          <div className="mt-8 flex w-full animate-points-pop flex-col items-center">
            <Button className="w-full max-w-xs bg-brand hover:bg-brand-hover" onClick={handleCollect}>
              {t("chest.collect")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
