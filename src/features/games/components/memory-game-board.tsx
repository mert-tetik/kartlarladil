"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useT } from "@/i18n/locale-provider";
import {
  buildLevelConfig,
  getHighestTierForLevel,
  getMemoryRevealDurationMs,
  getPointsForLevel,
  isGameLevelLocked,
} from "../game-levels";
import { generateMemoryCards } from "../game-cards";
import { useGameProgressStore } from "../game-progress-store";
import { useGameSounds } from "../use-game-sounds";
import { useGameTimer } from "../game-timer";
import type { MemoryCardItem } from "../game-types";
import { addGamePointsAction } from "../game-actions";
import { refreshLeaderboardPositions } from "@/features/leaderboard/leaderboard-refresh";
import { GAME_BACKGROUND_SOURCES, GameShell } from "./game-shell";
import { GameHeader } from "./game-header";
import { GameStartSplash } from "./game-start-splash";
import { GameResultScreen } from "./game-result-screen";
import { GameUITransition } from "./game-ui-transition";
import { MemoryCard } from "./memory-card";

type MemoryPhase = "splash" | "reveal" | "playing" | "completing" | "completed" | "failed";

const MEMORY_MATCH_RESOLVE_DELAY_MS = 400;
const MEMORY_WRONG_PAIR_RESET_DELAY_MS = 600;
const MEMORY_MATCH_ANIMATION_DURATION_MS = 560;
const MEMORY_MATCH_SOUND_RATE_STEP = 0.1;
const MEMORY_MATCH_SOUND_MAX_RATE = 2.5;

interface MemoryGameBoardProps {
  initialLevel: number;
}

export function MemoryGameBoard({ initialLevel }: MemoryGameBoardProps) {
  const t = useT();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const { entitlements } = useSubscription();
  const sounds = useGameSounds();
  const startLevel = useGameProgressStore((state) => state.startLevel);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const addLocalPoints = useGameProgressStore((state) => state.addPoints);

  const [level, setLevel] = useState(initialLevel);
  const [phase, setPhase] = useState<MemoryPhase>("splash");
  const selectedLanguage = useGameProgressStore((state) => state.selectedLanguage);
  const config = useMemo(() => buildLevelConfig(level, "memory", selectedLanguage), [level, selectedLanguage]);
  const pairCount = config.cardCount / 2;
  const revealDurationMs = useMemo(() => getMemoryRevealDurationMs(config.cardCount), [config.cardCount]);
  const [cards, setCards] = useState<MemoryCardItem[]>(() =>
    generateMemoryCards(pairCount, config.tiers, selectedLanguage),
  );
  const [matchedCount, setMatchedCount] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const resolutionTimersRef = useRef<Set<number>>(new Set());
  const pendingMatchPairIdsRef = useRef(new Set<string>());
  const correctMatchStreakRef = useRef(0);
  const selectedIdsRef = useRef<string[]>([]);

  const clearResolutionTimers = useCallback(() => {
    resolutionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resolutionTimersRef.current.clear();
  }, []);

  const scheduleResolution = useCallback((callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(() => {
      resolutionTimersRef.current.delete(timer);
      callback();
    }, delayMs);
    resolutionTimersRef.current.add(timer);
  }, []);

  const handleTimeExpired = useCallback(() => {
    clearResolutionTimers();
    pendingMatchPairIdsRef.current.clear();
    selectedIdsRef.current = [];
    correctMatchStreakRef.current = 0;
    setPhase("failed");
  }, [clearResolutionTimers]);

  const handleTick = useCallback(
    (remainingSeconds: number) => {
      if (remainingSeconds <= 3 && remainingSeconds > 0) {
        sounds.tickHigh();
      } else if (remainingSeconds <= 10 && remainingSeconds > 0) {
        sounds.tickLow();
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
    setCards(generateMemoryCards(pairCount, config.tiers, selectedLanguage));
    setMatchedCount(0);
    selectedIdsRef.current = [];
    pendingMatchPairIdsRef.current.clear();
    setPhase("splash");
    setShowSplash(true);
    correctMatchStreakRef.current = 0;
    clearResolutionTimers();
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    reset(config.seconds);
  }, [
    clearResolutionTimers,
    level,
    config.seconds,
    config.tiers,
    pairCount,
    selectedLanguage,
    startLevel,
    reset,
  ]);

  useEffect(() => {
    if (matchedCount > 0 && matchedCount === pairCount && phase === "playing") {
      const points = getPointsForLevel(level);
      completeLevel("memory", level);
      addLocalPoints("memory", points);
      if (user) {
        updateProfileField({
          gamePoints: (user.profile.gamePoints ?? 0) + points,
        });
        void addGamePointsAction(points).then(async (result) => {
          if (result.status !== "success") return;
          await refreshProfile();
          refreshLeaderboardPositions();
        });
      }
      setPhase("completing");
      completionTimerRef.current = window.setTimeout(() => {
        completionTimerRef.current = null;
        setPhase("completed");
      }, MEMORY_MATCH_ANIMATION_DURATION_MS);
    }
  }, [matchedCount, pairCount, phase, completeLevel, addLocalPoints, level, user, refreshProfile, updateProfileField]);

  const isFreePlan = entitlements?.effectivePlan === "free" || !entitlements;

  const handleSplashComplete = useCallback(() => {
    if (isGameLevelLocked(level) && isFreePlan) {
      setUpgradeOpen(true);
      return;
    }
    setPhase("reveal");
    revealTimerRef.current = setTimeout(() => {
      setPhase("playing");
    }, revealDurationMs);
  }, [level, isFreePlan, revealDurationMs]);

  const handleCardClick = useCallback(
    (id: string) => {
      if (phase !== "playing") return;

      const clickedCard = cards.find((card) => card.id === id);
      if (!clickedCard || clickedCard.isMatched || clickedCard.isFlipped) return;

    const nextSelected = [...selectedIdsRef.current, id];
    selectedIdsRef.current = nextSelected.length === 2 ? [] : nextSelected;

    // The second card's sound is the match/miss result sound. Playing the
    // flip sound here as well makes the final mission sound stack on top of it.
    if (nextSelected.length === 1) {
      sounds.flip();
    }

    setCards((prev) => prev.map((card) => (card.id === id ? { ...card, isFlipped: true } : card)));

    if (nextSelected.length === 2) {
        const [firstId, secondId] = nextSelected;
        const first = cards.find((c) => c.id === firstId);
        const second = cards.find((c) => c.id === secondId);

        if (first && second && first.pairId === second.pairId) {
          correctMatchStreakRef.current += 1;
          const matchedPairIds = new Set(
            cards.filter((card) => card.isMatched).map((card) => card.pairId),
          );
          const isFinalMatch =
            matchedPairIds.size + pendingMatchPairIdsRef.current.size + 1 >= pairCount;

          if (isFinalMatch) {
            sounds.passed();
          } else {
            sounds.correct({
              playbackRate: Math.min(
                1 + (correctMatchStreakRef.current - 1) * MEMORY_MATCH_SOUND_RATE_STEP,
                MEMORY_MATCH_SOUND_MAX_RATE,
              ),
            });
          }
          pendingMatchPairIdsRef.current.add(first.pairId);
          scheduleResolution(() => {
            pendingMatchPairIdsRef.current.delete(first.pairId);
            setCards((prev) =>
              prev.map((c) => (c.pairId === first.pairId ? { ...c, isMatched: true, isFlipped: true } : c)),
            );
            setMatchedCount((prev) => prev + 1);
          }, MEMORY_MATCH_RESOLVE_DELAY_MS);
        } else {
          correctMatchStreakRef.current = 0;
          sounds.incorrect();
          scheduleResolution(() => {
            setCards((prev) =>
              prev.map((card) =>
                card.id === firstId || card.id === secondId ? { ...card, isFlipped: false } : card,
              ),
            );
          }, MEMORY_WRONG_PAIR_RESET_DELAY_MS);
        }
      }
    },
    [phase, cards, pairCount, sounds, scheduleResolution],
  );

  const handleNextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    setCards(generateMemoryCards(pairCount, config.tiers, selectedLanguage));
    setMatchedCount(0);
    selectedIdsRef.current = [];
    pendingMatchPairIdsRef.current.clear();
    setPhase("splash");
    setShowSplash(true);
    correctMatchStreakRef.current = 0;
    clearResolutionTimers();
    if (completionTimerRef.current !== null) {
      window.clearTimeout(completionTimerRef.current);
      completionTimerRef.current = null;
    }
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    reset(config.seconds);
  }, [clearResolutionTimers, config.tiers, config.seconds, pairCount, selectedLanguage, reset]);

  useEffect(() => {
    const pendingMatchPairIds = pendingMatchPairIdsRef.current;

    return () => {
      clearResolutionTimers();
      pendingMatchPairIds.clear();
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, [clearResolutionTimers]);

  const progressLabel = t("games.memory.progress", { matched: matchedCount, total: pairCount });
  // Keep the cards face-up while the next memory board enters through the
  // shared UI transition. The reveal phase then keeps them visible until its
  // normal timer flips them back.
  const revealAll = phase === "splash" || phase === "reveal";

  return (
    <GameShell
      backgroundSrc={GAME_BACKGROUND_SOURCES.memory}
      exitButtonVisible={phase !== "completed" && phase !== "failed"}
    >
      <GameHeader
        level={phase === "completed" ? level + 1 : level}
        remainingSeconds={remaining}
        progressLabel={progressLabel}
      />

      {showSplash ? (
        <GameStartSplash
          game="memory"
          level={level}
          tier={getHighestTierForLevel(level)}
          onComplete={handleSplashComplete}
          onExited={() => setShowSplash(false)}
        />
      ) : null}

      <GameUITransition
        screenKey={phase === "completed" || phase === "failed" ? `result-${phase}` : "game"}
        direction={phase === "failed" ? "backward" : "forward"}
      >
        {phase === "completed" || phase === "failed" ? (
          <GameResultScreen
            game="memory"
            level={level}
            success={phase === "completed"}
            points={phase === "completed" ? getPointsForLevel(level) : undefined}
            onPrimary={phase === "completed" ? handleNextLevel : handleTryAgain}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-3">
            <div
              className="grid w-full max-w-2xl gap-2"
              style={{
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              {cards.map((card) => (
                <MemoryCard
                  key={card.id}
                  item={card}
                  onClick={() => handleCardClick(card.id)}
                  disabled={card.isFlipped || card.isMatched}
                  revealAll={revealAll}
                />
              ))}
            </div>
          </div>
        )}
      </GameUITransition>

      <UpgradeDialog
        open={upgradeOpen}
        errorCode={upgradeOpen ? "game_level_locked" : null}
        onOpenChange={setUpgradeOpen}
      />
    </GameShell>
  );
}
