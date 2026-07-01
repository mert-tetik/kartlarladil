"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useT } from "@/i18n/locale-provider";
import { buildLevelConfig, getPointsForLevel, isGameLevelLocked } from "../game-levels";
import { generateMemoryCards } from "../game-cards";
import { useGameProgressStore } from "../game-progress-store";
import { useGameSounds } from "../use-game-sounds";
import { useGameTimer } from "../game-timer";
import type { MemoryCardItem } from "../game-types";
import { GameShell } from "./game-shell";
import { GameHeader } from "./game-header";
import { GameStartSplash } from "./game-start-splash";
import { GameResultScreen } from "./game-result-screen";
import { MemoryCard } from "./memory-card";

type MemoryPhase = "splash" | "reveal" | "playing" | "completed" | "failed";

interface MemoryGameBoardProps {
  initialLevel: number;
}

const REVEAL_DURATION_MS = 3000;

export function MemoryGameBoard({ initialLevel }: MemoryGameBoardProps) {
  const t = useT();
  const { entitlements } = useSubscription();
  const sounds = useGameSounds();
  const startLevel = useGameProgressStore((state) => state.startLevel);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);

  const [level, setLevel] = useState(initialLevel);
  const [phase, setPhase] = useState<MemoryPhase>("splash");
  const [cards, setCards] = useState<MemoryCardItem[]>(() => generateMemoryCards(buildLevelConfig(level, "memory").tiers));
  const [matchedCount, setMatchedCount] = useState(0);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = useMemo(() => buildLevelConfig(level, "memory"), [level]);
  const totalPairs = cards.length / 2;

  const handleTimeExpired = useCallback(() => {
    sounds.fail();
    setPhase("failed");
  }, [sounds]);

  const handleTick = useCallback(
    (remainingSeconds: number) => {
      if (remainingSeconds <= 10 && remainingSeconds > 0) {
        if (remainingSeconds <= 3) {
          sounds.tickHigh();
        } else {
          sounds.tickLow();
        }
      }
    },
    [sounds],
  );

  const { remaining, reset } = useGameTimer({
    seconds: config.seconds,
    running: phase === "playing",
    onExpired: handleTimeExpired,
    onTick: handleTick,
  });

  useEffect(() => {
    startLevel("memory", level);
    setCards(generateMemoryCards(config.tiers));
    setMatchedCount(0);
    setFlippedIds([]);
    setPhase("splash");
    setShowSplash(true);
    setIsChecking(false);
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    reset(config.seconds);
  }, [level, config.seconds, config.tiers, startLevel, reset]);

  useEffect(() => {
    if (matchedCount > 0 && matchedCount === totalPairs && phase === "playing") {
      sounds.complete();
      completeLevel("memory", level);
      setPhase("completed");
    }
  }, [matchedCount, totalPairs, phase, sounds, completeLevel, level]);

  const isFreePlan = entitlements?.effectivePlan === "free" || !entitlements;

  const handleSplashComplete = useCallback(() => {
    if (isGameLevelLocked(level) && isFreePlan) {
      setUpgradeOpen(true);
      return;
    }
    setPhase("reveal");
    revealTimerRef.current = setTimeout(() => {
      setPhase("playing");
    }, REVEAL_DURATION_MS);
  }, [level, isFreePlan]);

  const handleCardClick = useCallback(
    (id: string) => {
      if (phase !== "playing" || isChecking || flippedIds.length >= 2) return;
      if (flippedIds.includes(id)) return;

      sounds.flip();
      const nextFlipped = [...flippedIds, id];
      setFlippedIds(nextFlipped);

      if (nextFlipped.length === 2) {
        setIsChecking(true);
        const [firstId, secondId] = nextFlipped;
        const first = cards.find((c) => c.id === firstId);
        const second = cards.find((c) => c.id === secondId);

        if (first && second && first.pairId === second.pairId) {
          sounds.correct();
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) => (c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: true } : c)),
            );
            setMatchedCount((prev) => prev + 1);
            setFlippedIds([]);
            setIsChecking(false);
          }, 400);
        } else {
          sounds.incorrect();
          setTimeout(() => {
            setFlippedIds([]);
            setIsChecking(false);
          }, 700);
        }
      }
    },
    [phase, isChecking, flippedIds, cards, sounds],
  );

  const handleNextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    setCards(generateMemoryCards(config.tiers));
    setMatchedCount(0);
    setFlippedIds([]);
    setPhase("splash");
    setShowSplash(true);
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    reset(config.seconds);
  }, [config.tiers, config.seconds, reset]);

  const progressLabel = t("games.memory.progress", { matched: matchedCount, total: totalPairs });
  const revealAll = phase === "reveal";

  return (
    <GameShell>
      <GameHeader level={level} tiers={config.tiers} remainingSeconds={remaining} progressLabel={progressLabel} />

      {showSplash ? (
        <GameStartSplash
          onComplete={handleSplashComplete}
          onExited={() => setShowSplash(false)}
        />
      ) : null}

      {phase === "completed" || phase === "failed" ? (
        <GameResultScreen
          level={level}
          success={phase === "completed"}
          points={phase === "completed" ? getPointsForLevel(level) : undefined}
          onPrimary={phase === "completed" ? handleNextLevel : handleTryAgain}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-3">
          <div className="grid aspect-[8/9] max-h-full w-auto grid-cols-4 gap-2 sm:aspect-[2/1] sm:grid-cols-6">
            {cards.map((card) => (
              <MemoryCard
                key={card.id}
                item={card}
                isFlipped={flippedIds.includes(card.id)}
                onClick={() => handleCardClick(card.id)}
                disabled={isChecking || flippedIds.length >= 2 || card.isMatched}
                revealAll={revealAll}
              />
            ))}
          </div>
        </div>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        errorCode={upgradeOpen ? "game_level_locked" : null}
        onOpenChange={setUpgradeOpen}
      />
    </GameShell>
  );
}
