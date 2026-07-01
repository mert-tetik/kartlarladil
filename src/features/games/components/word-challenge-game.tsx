"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { buildLevelConfig, getPointsForLevel, isGameLevelLocked } from "../game-levels";
import { generateWordChallengeItems, WORD_CHALLENGE_QUESTION_COUNT } from "../game-cards";
import { useGameProgressStore } from "../game-progress-store";
import { useGameSounds } from "../use-game-sounds";
import { useGameTimer } from "../game-timer";
import type { WordChallengeItem } from "../game-types";
import { GameShell } from "./game-shell";
import { GameHeader } from "./game-header";
import { GameStartSplash } from "./game-start-splash";
import { GameResultScreen } from "./game-result-screen";
import { GameButton } from "./game-button";

type WordChallengePhase = "splash" | "playing" | "completed" | "failed";

interface WordChallengeGameProps {
  initialLevel: number;
}

export function WordChallengeGame({ initialLevel }: WordChallengeGameProps) {
  const t = useT();
  const { entitlements } = useSubscription();
  const sounds = useGameSounds();
  const startLevel = useGameProgressStore((state) => state.startLevel);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);

  const [level, setLevel] = useState(initialLevel);
  const [phase, setPhase] = useState<WordChallengePhase>("splash");
  const [items, setItems] = useState<WordChallengeItem[]>(() =>
    generateWordChallengeItems(buildLevelConfig(level, "wordChallenge").tiers),
  );
  const [index, setIndex] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const config = useMemo(() => buildLevelConfig(level, "wordChallenge"), [level]);
  const currentItem = items[index];

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
    startLevel("wordChallenge", level);
    setItems(generateWordChallengeItems(config.tiers));
    setIndex(0);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [level, config.seconds, config.tiers, startLevel, reset]);

  const isFreePlan = entitlements?.effectivePlan === "free" || !entitlements;

  const handleSplashComplete = useCallback(() => {
    if (isGameLevelLocked(level) && isFreePlan) {
      setUpgradeOpen(true);
      return;
    }
    setPhase("playing");
  }, [level, isFreePlan]);

  const handleAnswer = useCallback(
    (answer: boolean) => {
      if (phase !== "playing" || !currentItem) return;

      if (answer === currentItem.isTrue) {
        sounds.correct();
        if (index + 1 >= items.length) {
          sounds.complete();
          completeLevel("wordChallenge", level);
          setPhase("completed");
        } else {
          setIndex((prev) => prev + 1);
        }
      } else {
        sounds.incorrect();
        setPhase("failed");
      }
    },
    [phase, currentItem, index, items.length, sounds, completeLevel, level],
  );

  const handleNextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    setItems(generateWordChallengeItems(config.tiers));
    setIndex(0);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [config.tiers, config.seconds, reset]);

  const progressLabel = t("games.wordChallenge.progress", { current: index + 1, total: WORD_CHALLENGE_QUESTION_COUNT });

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
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
          {currentItem ? (
            <>
              <div
                className={cn(
                  "flex w-full max-w-sm flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-background-card p-6 text-center shadow-sm",
                )}
              >
                <span className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
                  {t("games.wordChallenge.question")}
                </span>
                <h2 className="text-3xl font-black text-foreground">{currentItem.card.term}</h2>
                <div className="h-px w-16 bg-border" />
                <p className="text-lg text-foreground-secondary">{currentItem.proposedMeaning}</p>
              </div>

              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                <GameButton variant="blue" size="lg" className="w-full" onClick={() => handleAnswer(true)}>
                  {t("games.wordChallenge.correct")}
                </GameButton>
                <GameButton variant="red" size="lg" className="w-full" onClick={() => handleAnswer(false)}>
                  {t("games.wordChallenge.wrong")}
                </GameButton>
              </div>
            </>
          ) : null}
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
