"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuthSession } from "@/features/auth/auth-client";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { TIER_STYLES } from "@/data/tiers";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  buildLevelConfig,
  getHighestTierForLevel,
  getPointsForLevel,
  isGameLevelLocked,
} from "../game-levels";
import { generateWordMatchItems } from "../game-cards";
import { useGameProgressStore } from "../game-progress-store";
import { useGameSounds } from "../use-game-sounds";
import { useGameTimer } from "../game-timer";
import { addGamePointsAction } from "../game-actions";
import type { WordMatchItem } from "../game-types";
import { GameShell } from "./game-shell";
import { GameHeader } from "./game-header";
import { GameStartSplash } from "./game-start-splash";
import { GameResultScreen } from "./game-result-screen";

type WordMatchPhase = "splash" | "playing" | "completed" | "failed";

interface WordMatchGameProps {
  initialLevel: number;
}

interface LineDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tier: import("@/types/domain").Tier;
}

export function WordMatchGame({ initialLevel }: WordMatchGameProps) {
  const t = useT();
  const { user, refreshProfile, updateProfileField } = useAuthSession();
  const { entitlements } = useSubscription();
  const sounds = useGameSounds();
  const startLevel = useGameProgressStore((state) => state.startLevel);
  const completeLevel = useGameProgressStore((state) => state.completeLevel);
  const addLocalPoints = useGameProgressStore((state) => state.addPoints);
  const selectedLanguage = useGameProgressStore((state) => state.selectedLanguage);

  const [level, setLevel] = useState(initialLevel);
  const [phase, setPhase] = useState<WordMatchPhase>("splash");
  const [showSplash, setShowSplash] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [items, setItems] = useState<WordMatchItem[]>(() =>
    generateInitialItems(level, selectedLanguage),
  );
  const [lines, setLines] = useState<LineDef[]>([]);

  const config = useMemo(
    () => buildLevelConfig(level, "wordMatch", selectedLanguage),
    [level, selectedLanguage],
  );

  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardWrapperRef = useRef<HTMLDivElement | null>(null);

  const handleTimeExpired = useCallback(() => {
    setPhase("failed");
  }, []);

  const { remaining, reset } = useGameTimer({
    seconds: config.seconds,
    running: phase === "playing",
    onExpired: handleTimeExpired,
  });

  useEffect(() => {
    startLevel("wordMatch", level);
    const nextItems = generateInitialItems(level, selectedLanguage);
    setItems(nextItems);
    setLines([]);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [level, config.seconds, selectedLanguage, startLevel, reset]);

  const isFreePlan = entitlements?.effectivePlan === "free" || !entitlements;

  const handleSplashComplete = useCallback(() => {
    if (isGameLevelLocked(level) && isFreePlan) {
      setUpgradeOpen(true);
      return;
    }
    setPhase("playing");
  }, [level, isFreePlan]);

  const updateLines = useCallback(() => {
    const board = boardRef.current;
    const wrapper = boardWrapperRef.current;
    if (!board || !wrapper) {
      setLines([]);
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const nextLines: LineDef[] = [];

    for (const item of items) {
      if (!item.matched) continue;
      const pair = items.find(
        (other) =>
          other.card.sourceKey === item.card.sourceKey &&
          other.id !== item.id,
      );
      if (!pair) continue;

      const a = itemRefs.current[item.id];
      const b = itemRefs.current[pair.id];
      if (!a || !b) continue;

      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();

      nextLines.push({
        x1: rectA.left + rectA.width / 2 - wrapperRect.left,
        y1: rectA.top + rectA.height / 2 - wrapperRect.top,
        x2: rectB.left + rectB.width / 2 - wrapperRect.left,
        y2: rectB.top + rectB.height / 2 - wrapperRect.top,
        tier: item.card.tier,
      });
    }

    setLines(nextLines);
  }, [items]);

  useEffect(() => {
    updateLines();
  }, [updateLines]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handle = () => updateLines();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    window.visualViewport?.addEventListener("resize", handle);
    window.visualViewport?.addEventListener("scroll", handle);

    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      window.visualViewport?.removeEventListener("resize", handle);
      window.visualViewport?.removeEventListener("scroll", handle);
    };
  }, [updateLines]);

  useEffect(() => {
    if (phase !== "playing") return;

    const allMatched = items.length > 0 && items.every((item) => item.matched);
    if (allMatched) {
      sounds.complete();
      const points = getPointsForLevel(level);
      completeLevel("wordMatch", level);
      addLocalPoints("wordMatch", points);
      if (user) {
        updateProfileField({
          aiPracticePoints: (user.profile.aiPracticePoints ?? 0) + points,
        });
        void addGamePointsAction(points).then(() => refreshProfile());
      }
      setPhase("completed");
    }
  }, [items, phase, level, sounds, completeLevel, addLocalPoints, user, refreshProfile, updateProfileField]);

  const handleItemClick = useCallback(
    (id: string) => {
      if (phase !== "playing") return;

      setItems((prev) => {
        const clicked = prev.find((item) => item.id === id);
        if (!clicked || clicked.matched || clicked.selected) return prev;

        const selectedItems = prev.filter((item) => item.selected);

        if (selectedItems.length === 0) {
          sounds.flip();
          return prev.map((item) =>
            item.id === id ? { ...item, selected: true } : item,
          );
        }

        const first = selectedItems[0];
        if (first.id === id) return prev;

        const isMatch =
          first.card.sourceKey === clicked.card.sourceKey &&
          first.side !== clicked.side;

        if (isMatch) {
          sounds.correct();
          return prev.map((item) => {
            if (item.id === first.id || item.id === clicked.id) {
              return { ...item, matched: true, selected: false };
            }
            return item;
          });
        }

        sounds.incorrect();
        window.setTimeout(() => {
          setItems((current) =>
            current.map((item) =>
              item.id === first.id || item.id === clicked.id
                ? { ...item, shake: false, selected: false }
                : item,
            ),
          );
        }, 600);

        return prev.map((item) => {
          if (item.id === first.id || item.id === clicked.id) {
            return { ...item, selected: true, shake: true };
          }
          return item;
        });
      });
    },
    [phase, sounds],
  );

  const handleNextLevel = useCallback(() => {
    setLevel((prev) => prev + 1);
  }, []);

  const handleTryAgain = useCallback(() => {
    const nextItems = generateInitialItems(level, selectedLanguage);
    setItems(nextItems);
    setLines([]);
    setPhase("splash");
    setShowSplash(true);
    reset(config.seconds);
  }, [level, selectedLanguage, config.seconds, reset]);

  const { termItems, meaningItems } = useMemo(() => {
    return {
      termItems: items.filter((item) => item.side === "term"),
      meaningItems: items.filter((item) => item.side === "meaning"),
    };
  }, [items]);

  const matchedCount = useMemo(
    () => items.filter((item) => item.matched && item.side === "term").length,
    [items],
  );
  const totalPairs = config.cardCount;
  const progressLabel = t("games.wordMatch.progress", {
    matched: matchedCount,
    total: totalPairs,
  });

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
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <div
            ref={boardWrapperRef}
            className="relative flex flex-1 flex-col gap-4 sm:flex-row"
          >
            <svg
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
              style={{ overflow: "visible" }}
            >
              {lines.map((line, index) => (
                <line
                  key={index}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  className={cn("stroke-[3px]", getTierStrokeClass(line.tier))}
                  strokeLinecap="round"
                />
              ))}
            </svg>

            <div
              ref={boardRef}
              className="flex flex-1 flex-col gap-2 overflow-y-auto py-2"
            >
              <h3 className="text-center text-xs font-bold uppercase tracking-wider text-foreground-muted">
                {t("games.wordMatch.termColumn")}
              </h3>
              <div className="flex flex-1 flex-col justify-center gap-2">
                {termItems.map((item) => (
                  <MatchButton
                    key={item.id}
                    item={item}
                    ref={(el) => {
                      itemRefs.current[item.id] = el;
                    }}
                    onClick={() => handleItemClick(item.id)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto py-2">
              <h3 className="text-center text-xs font-bold uppercase tracking-wider text-foreground-muted">
                {t("games.wordMatch.meaningColumn")}
              </h3>
              <div className="flex flex-1 flex-col justify-center gap-2">
                {meaningItems.map((item) => (
                  <MatchButton
                    key={item.id}
                    item={item}
                    ref={(el) => {
                      itemRefs.current[item.id] = el;
                    }}
                    onClick={() => handleItemClick(item.id)}
                  />
                ))}
              </div>
            </div>
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

interface MatchButtonProps {
  item: WordMatchItem;
  onClick: () => void;
}

const MatchButton = ({ item, onClick, ref }: MatchButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const tierStyle = TIER_STYLES[item.card.tier];
  const label = item.side === "term" ? item.card.term : item.card.translation;

  return (
    <button
      ref={ref}
      type="button"
      disabled={item.matched}
      onClick={onClick}
      className={cn(
        "relative z-20 w-full rounded-lg px-3 py-2 text-center text-sm font-semibold text-white transition-all active:scale-95",
        "disabled:cursor-default disabled:opacity-40",
        tierStyle.accent,
        item.selected && "scale-[1.02] shadow-lg ring-2 ring-white/80 ring-offset-2 ring-offset-background",
        item.shake && "animate-word-match-shake",
      )}
    >
      {label}
    </button>
  );
};

function generateInitialItems(
  level: number,
  selectedLanguage: import("@/types/domain").LanguageCode | "all",
) {
  const config = buildLevelConfig(level, "wordMatch", selectedLanguage);
  return generateWordMatchItems(config.cardCount, config.tiers, selectedLanguage);
}

function getTierStrokeClass(tier: import("@/types/domain").Tier): string {
  const map: Record<import("@/types/domain").Tier, string> = {
    A1: "stroke-emerald-500 dark:stroke-emerald-400",
    A2: "stroke-sky-500 dark:stroke-sky-400",
    B1: "stroke-violet-500 dark:stroke-violet-400",
    B2: "stroke-amber-500 dark:stroke-amber-400",
    C1: "stroke-rose-500 dark:stroke-rose-400",
  };
  return map[tier];
}

