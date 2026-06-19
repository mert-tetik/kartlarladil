"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Gift, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { getChestFrameIndex, type ChestTierDefinition } from "@/features/quiz/chest-rewards";
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

  useEffect(() => {
    const timer = setTimeout(() => setPhase("idle"), 500);
    return () => clearTimeout(timer);
  }, []);

  const frameIndex = getChestFrameIndex(tapCount);

  function spawnSparkles() {
    const next = Array.from({ length: 14 }, (_, index) => ({
      id: Date.now() + index,
      left: 10 + Math.random() * 80,
      delay: Math.random() * 250,
    }));
    setSparkles(next);
  }

  function handleTap() {
    if (phase === "appearing" || phase === "revealed" || phase === "disappearing") return;

    const nextTap = tapCount + 1;
    setTapCount(nextTap);

    if (nextTap < 3) {
      setPhase("shake");
      playSoundEffect("chest-tap");
      vibrate("chest-tap");
      setTimeout(() => setPhase("idle"), 260);
      return;
    }

    setPhase("opening");
    playSoundEffect("chest-open");
    vibrate("chest-open");
    void confetti({
      particleCount: 160,
      spread: 100,
      origin: { y: 0.5 },
      colors: ["#facc15", "#fbbf24", "#f59e0b", "#fde047", "#ffffff"],
      disableForReducedMotion: true,
    });
    spawnSparkles();

    setTimeout(() => {
      setPhase("revealed");
      playSoundEffect("points");
      vibrate("confetti");
    }, 450);
  }

  function handleCollect() {
    if (hasAwarded.current) return;
    hasAwarded.current = true;
    setPhase("disappearing");
    setTimeout(() => onComplete(), 350);
  }

  return (
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col items-center justify-center p-4 text-center">
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
        <p className="mt-2 text-sm text-foreground-secondary">{t(tier.labelKey)}</p>

        <div className="relative mt-8">
          {phase === "revealed" ? (
            <div className="pointer-events-none absolute inset-0 -z-10 animate-chest-glow rounded-full" />
          ) : null}

          <button
            type="button"
            onClick={handleTap}
            disabled={phase === "revealed" || phase === "disappearing"}
            className={cn(
              "relative flex h-[105px] w-[210px] items-center justify-center overflow-hidden rounded-lg transition-transform focus:outline-none",
              phase === "idle" && "animate-chest-float",
              phase === "shake" && "animate-chest-shake",
              phase === "revealed" && "scale-110",
            )}
            style={{ cursor: phase === "revealed" ? "default" : "pointer" }}
            aria-label={phase === "revealed" ? t("chest.opened") : t("chest.tapToOpen")}
          >
            <Image
              src="/chests/chest-sprite.png"
              alt=""
              width={140}
              height={70}
              className="chest-sprite h-[105px] w-[210px] object-cover object-left"
              style={{ objectPosition: `-${frameIndex * 30}px 0`, filter: tier.filter }}
              unoptimized
            />
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
          <p className="mt-6 text-sm font-semibold text-foreground-secondary">
            {tapCount === 0 ? t("chest.tapToOpen") : t("chest.tapsRemaining", { count: 3 - tapCount })}
          </p>
        ) : null}

        {phase === "revealed" ? (
          <div className="mt-6 flex animate-points-pop flex-col items-center">
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
