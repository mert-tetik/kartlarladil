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

export function ChestOpeningView({ tier, onComplete }: ChestOpeningViewProps) {
  const t = useT();
  const [phase, setPhase] = useState<ChestPhase>("appearing");
  const [sparkles, setSparkles] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const hasAwarded = useRef(false);
  const lidRef = useRef<HTMLDivElement | null>(null);

  const ui = CHEST_TIER_UI_CLASSES[tier.tier];

  useEffect(() => {
    const timer = setTimeout(() => setPhase("idle"), 500);
    return () => clearTimeout(timer);
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
    const launchX = direction * (72 + Math.random() * 26);
    const apexY = 84 + Math.random() * 28;
    const dropY = 128 + Math.random() * 44;
    const midRotation = direction * (26 + Math.random() * 18);
    const finalRotation = direction * (96 + Math.random() * 32);
    const lidElement =
      lidRef.current ??
      (document.querySelector("[data-chest-lid]") as HTMLDivElement | null);

    if (lidElement) {
      lidElement.style.willChange = "transform";
      lidElement.style.transition = "transform 280ms cubic-bezier(0.2, 0.92, 0.24, 1)";
      lidElement.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
    }
    setPhase("opening");
    spawnSparkles();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (lidElement) {
          lidElement.style.transform = `translate3d(${launchX}px, -${apexY}px, 0) rotate(${midRotation}deg)`;
        }
      });
    });

    setTimeout(() => {
      if (lidElement) {
        lidElement.style.transition = "transform 620ms cubic-bezier(0.14, 0.7, 0.2, 1)";
        lidElement.style.transform = `translate3d(${launchX * 1.45}px, ${dropY}px, 0) rotate(${finalRotation}deg)`;
      }
    }, 280);

    setTimeout(() => {
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

    setTimeout(() => {
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
              "relative flex h-[160px] w-[248px] items-end justify-center overflow-visible rounded-lg transition-transform focus:outline-none sm:h-[188px] sm:w-[308px] md:h-[210px] md:w-[344px]",
              phase === "idle" && "animate-chest-float",
              phase === "shake" && "animate-chest-shake",
              phase === "revealed" && "scale-[1.03]",
            )}
            style={{ cursor: phase === "revealed" ? "default" : "pointer", perspective: "800px" }}
            aria-label={phase === "revealed" ? t("chest.opened") : t("chest.tapToOpen")}
          >
            <div className={cn("absolute bottom-2 left-1/2 h-[74px] w-[216px] -translate-x-1/2 rounded-full opacity-35 blur-2xl sm:h-[88px] sm:w-[268px] md:h-[96px] md:w-[300px]", ui.glow)} />

            <div className="relative h-[116px] w-full sm:h-[136px] md:h-[152px]">
              <div className={cn("absolute inset-x-0 bottom-0 h-[92px] rounded-b-[10px] rounded-t-[8px] border-[3px] border-black/15 shadow-sm sm:h-[108px] md:h-[120px]", ui.base)}>
                <div className="absolute inset-x-0 top-0 h-3 bg-black/10" />
                <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80 sm:w-10", ui.band)} />
                <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                <div className={cn("absolute left-1/2 top-0 z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-black/15 shadow-sm sm:h-14 sm:w-14", ui.lock)}>
                  <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 sm:h-4 sm:w-4" />
                </div>
              </div>

              <div
                ref={lidRef}
                data-chest-lid
                className={cn(
                  "absolute inset-x-0 top-0 z-30 h-[46px] rounded-t-[12px] rounded-b-[6px] border-[3px] border-black/15 shadow-sm sm:h-[54px] md:h-[60px]",
                  ui.lid,
                )}
              >
                <div className="absolute inset-x-0 bottom-0 h-2 bg-black/12" />
                <div className={cn("absolute left-1/2 top-0 h-full w-8 -translate-x-1/2 opacity-80 sm:w-10", ui.band)} />
                <div className={cn("absolute left-[24%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
                <div className={cn("absolute left-[76%] top-0 h-full w-4 -translate-x-1/2 opacity-65 sm:w-5", ui.band)} />
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
          <div className="mt-8 flex animate-points-pop flex-col items-center">
            <div className="flex items-center gap-2 text-amber-500">
              <Gift className="size-6" aria-hidden="true" />
              <span className="text-lg font-semibold">{t("chest.rewardTitle")}</span>
            </div>
            <p className="mt-1 text-5xl font-bold text-foreground">+{tier.points}</p>
            <p className="text-sm text-foreground-secondary">{t("chest.pointsLabel")}</p>
            <Button className="mt-6 w-full max-w-xs bg-brand hover:bg-brand-hover" onClick={handleCollect}>
              {t("chest.collect")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
