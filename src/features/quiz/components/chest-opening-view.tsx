"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles, X } from "lucide-react";
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
  onClose: () => void;
}

type ChestPhase = "appearing" | "idle" | "shake" | "opening" | "revealed" | "disappearing";

export function ChestOpeningView({ tier, onComplete, onClose }: ChestOpeningViewProps) {
  const t = useT();
  const [phase, setPhase] = useState<ChestPhase>("appearing");
  const [tapCount, setTapCount] = useState(0);
  const [sparkles, setSparkles] = useState<Array<{ id: number; left: number; delay: number }>>([]);
  const hasAwarded = useRef(false);

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

    setTapCount(1);
    setPhase("opening");
    playSoundEffect("chest-open");
    vibrate("chest-open");
    void confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.55 },
      colors: ["#facc15", "#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
      disableForReducedMotion: true,
    });
    spawnSparkles();

    setTimeout(() => {
      setPhase("revealed");
      playSoundEffect("points");
      vibrate("confetti");
    }, 550);
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
      className="relative mx-auto flex w-full max-w-2xl flex-col items-center justify-center p-4 text-center"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-background-card text-foreground-secondary shadow-sm transition-colors hover:bg-background-muted hover:text-foreground"
        aria-label={t("common.close")}
      >
        <X className="size-5" aria-hidden="true" />
      </button>

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

        <div className="relative mt-10">
          {phase === "revealed" ? (
            <div className={cn("pointer-events-none absolute inset-0 -z-10 animate-chest-glow rounded-full blur-3xl", ui.glow)} />
          ) : null}

          <button
            type="button"
            onClick={handleTap}
            disabled={phase === "revealed" || phase === "disappearing"}
            className={cn(
              "relative flex h-[260px] w-[420px] items-end justify-center overflow-visible rounded-lg transition-transform focus:outline-none",
              phase === "idle" && "animate-chest-float",
              phase === "shake" && "animate-chest-shake",
              phase === "revealed" && "scale-110",
            )}
            style={{ cursor: phase === "revealed" ? "default" : "pointer", perspective: "800px" }}
            aria-label={phase === "revealed" ? t("chest.opened") : t("chest.tapToOpen")}
          >
            {/* Chest glow base */}
            <div className={cn("absolute bottom-2 left-1/2 h-[120px] w-[380px] -translate-x-1/2 rounded-full opacity-40 blur-2xl", ui.glow)} />

            {/* Chest body */}
            <div className={cn("relative h-[140px] w-[420px] rounded-b-2xl rounded-t-lg border-4 border-black/20 shadow-2xl", ui.base)}>
              {/* Vertical bands */}
              <div className={cn("absolute left-1/2 top-0 h-full w-12 -translate-x-1/2 opacity-80", ui.band)} />
              <div className={cn("absolute left-[25%] top-0 h-full w-6 -translate-x-1/2 opacity-60", ui.band)} />
              <div className={cn("absolute left-[75%] top-0 h-full w-6 -translate-x-1/2 opacity-60", ui.band)} />

              {/* Lock plate */}
              <div className={cn("absolute left-1/2 top-1/2 z-20 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-black/20 shadow-xl", ui.lock)}>
                <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30" />
              </div>
            </div>

            {/* Chest lid */}
            <div
              className={cn(
                "absolute top-0 h-[75px] w-[420px] origin-bottom rounded-t-2xl border-4 border-black/20 shadow-xl transition-transform duration-500",
                ui.lid,
              )}
              style={{ transform: phase === "revealed" ? "translateY(-16px) rotateX(-110deg)" : undefined }}
            >
              <div className={cn("absolute left-1/2 top-0 h-full w-12 -translate-x-1/2 opacity-80", ui.band)} />
              <div className={cn("absolute left-[25%] top-0 h-full w-6 -translate-x-1/2 opacity-60", ui.band)} />
              <div className={cn("absolute left-[75%] top-0 h-full w-6 -translate-x-1/2 opacity-60", ui.band)} />
            </div>

            {/* Side handles */}
            <div className={cn("absolute -left-5 top-20 size-8 rounded-full border-4 border-black/20 shadow-lg", ui.band)} />
            <div className={cn("absolute -right-5 top-20 size-8 rounded-full border-4 border-black/20 shadow-lg", ui.band)} />
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
            {tapCount === 0 ? t("chest.tapToOpen") : t("chest.tapsRemaining", { count: 3 - tapCount })}
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
