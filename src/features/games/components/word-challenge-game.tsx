"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { buildLevelConfig, getHighestTierForLevel, getPointsForLevel, isGameLevelLocked } from "../game-levels";
import { generateWordChallengeItems } from "../game-cards";
import { useGameProgressStore } from "../game-progress-store";
import { useGameSounds } from "../use-game-sounds";
import { useGameTimer } from "../game-timer";
import type { WordChallengeItem } from "../game-types";
import { addGamePointsAction } from "../game-actions";
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
  const { user, refreshProfile } = useAuthSession();
  const { entitlements } = useSubscription();
  const sounds = useGameSounds();
  const startLevel = useGameProgressStore((state) => state.startLevel);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const addLocalPoints = useGameProgressStore((state) => state.addPoints);

  const [level, setLevel] = useState(initialLevel);
  const [phase, setPhase] = useState<WordChallengePhase>("splash");
  const selectedLanguage = useGameProgressStore((state) => state.selectedLanguage);
  const config = useMemo(() => buildLevelConfig(level, "wordChallenge", selectedLanguage), [level, selectedLanguage]);
  const questionCount = config.cardCount;
  const [items, setItems] = useState<WordChallengeItem[]>(() =>
    generateWordChallengeItems(questionCount, config.tiers, selectedLanguage),
  );
  const [index, setIndex] = useState(0);
  const [showSplash, setShowSplash] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const currentItem = items[index];

  const handleTimeExpired = useCallback(() => {
    setPhase("failed");
  }, []);

  const { remaining, reset } = useGameTimer({
    seconds: config.seconds,
    running: phase === "playing",
    onExpired: handleTimeExpired,
  });

  useEffect(() => {
    startLevel("wordChallenge", level);
    setItems(generateWordChallengeItems(questionCount, config.tiers, selectedLanguage));
    setIndex(0);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [level, config.seconds, config.tiers, questionCount, selectedLanguage, startLevel, reset]);

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
          const points = getPointsForLevel(level);
          completeLevel("wordChallenge", level);
          addLocalPoints("wordChallenge", points);
          if (user) {
            void addGamePointsAction(points).then(() => refreshProfile());
          }
          setPhase("completed");
        } else {
          setIndex((prev) => prev + 1);
        }
      } else {
        sounds.incorrect();
        setPhase("failed");
      }
    },
    [phase, currentItem, index, items.length, sounds, completeLevel, addLocalPoints, level, user, refreshProfile],
  );

  const handleNextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    setItems(generateWordChallengeItems(questionCount, config.tiers, selectedLanguage));
    setIndex(0);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [config.tiers, config.seconds, questionCount, selectedLanguage, reset]);

  const progressLabel = t("games.wordChallenge.progress", { current: index + 1, total: questionCount });

  return (
    <GameShell>
      <GameHeader
        level={level}
        tiers={[getHighestTierForLevel(level)]}
        remainingSeconds={remaining}
        progressLabel={progressLabel}
      />

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
