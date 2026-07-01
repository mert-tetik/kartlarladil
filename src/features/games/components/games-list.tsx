"use client";

import Link from "next/link";
import { Brain, Shuffle } from "lucide-react";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { GameName } from "../game-types";
import { useGameProgressStore } from "../game-progress-store";
import { getHighestTierForLevel } from "../game-levels";

interface GameEntry {
  name: GameName;
  href: string;
  icon: typeof Brain;
  titleKey: "games.memory.title" | "games.wordChallenge.title";
  descriptionKey: "games.memory.description" | "games.wordChallenge.description";
}

const GAMES: GameEntry[] = [
  {
    name: "memory",
    href: "/games/memory",
    icon: Shuffle,
    titleKey: "games.memory.title",
    descriptionKey: "games.memory.description",
  },
  {
    name: "wordChallenge",
    href: "/games/word-challenge",
    icon: Brain,
    titleKey: "games.wordChallenge.title",
    descriptionKey: "games.wordChallenge.description",
  },
];

export function GamesList() {
  const t = useT();
  const getProgress = useGameProgressStore((state) => state.getProgress);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:flex-row sm:gap-6">
      {GAMES.map((game) => {
        const progress = getProgress(game.name);
        const tier = getHighestTierForLevel(progress.currentLevel);
        const Icon = game.icon;

        return (
          <Link
            key={game.name}
            href={game.href}
            className={cn(
              "flex w-full max-w-sm flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-background-card p-8 text-center shadow-sm transition-transform hover:scale-[1.02] active:scale-95 sm:aspect-square sm:max-w-none sm:flex-1",
            )}
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon className="size-8" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{t(game.titleKey)}</h2>
              <p className="mt-1 text-sm text-foreground-secondary">{t(game.descriptionKey)}</p>
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground-muted">
              {t("games.level", { level: progress.currentLevel })} · {tier}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
