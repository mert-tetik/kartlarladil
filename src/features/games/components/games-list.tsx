"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, Shuffle } from "lucide-react";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { useLocale, useT } from "@/i18n/locale-provider";
import { getLanguageDisplayName } from "@/i18n/labels";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";
import type { GameName } from "../game-types";
import { useGameProgressStore } from "../game-progress-store";
import { getHighestTierForLevel } from "../game-levels";

interface GameEntry {
  name: GameName;
  href: string;
  icon: typeof Brain;
  titleKey: "games.memory.title" | "games.wordChallenge.title";
  descriptionKey: "games.memory.description" | "games.wordChallenge.description";
  variant: "red" | "blue";
}

const GAMES: GameEntry[] = [
  {
    name: "memory",
    href: "/games/memory",
    icon: Shuffle,
    titleKey: "games.memory.title",
    descriptionKey: "games.memory.description",
    variant: "red",
  },
  {
    name: "wordChallenge",
    href: "/games/word-challenge",
    icon: Brain,
    titleKey: "games.wordChallenge.title",
    descriptionKey: "games.wordChallenge.description",
    variant: "blue",
  },
];

export function GamesList() {
  const t = useT();
  const { locale } = useLocale();
  const getProgress = useGameProgressStore((state) => state.getProgress);
  const selectedLanguage = useGameProgressStore((state) => state.selectedLanguage);
  const setSelectedLanguage = useGameProgressStore((state) => state.setSelectedLanguage);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  const languageOptions = LANGUAGES.map((language) => ({ code: language.code, count: 0 }));

  function handleSelect(language: LanguageCode) {
    setSelectedLanguage(language);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:flex-row sm:gap-6">
      <div className="flex w-full max-w-sm flex-col gap-4 sm:max-w-none sm:flex-1">
        <button
          type="button"
          onClick={() => {
            vibrate("tap");
            setLanguageSheetOpen(true);
          }}
          className="flex w-full shrink-0 items-center justify-between rounded-xl border border-border bg-background-card px-4 py-1.5 text-left transition-colors hover:bg-background-muted"
        >
          <span className="flex items-center gap-3">
            <LanguageFlag code={selectedLanguage === "all" ? locale : selectedLanguage} className="h-6 w-9" />
            <span className="text-base font-semibold text-foreground">
              {selectedLanguage === "all"
                ? t("home.mobile.allTiers")
                : getLanguageDisplayName(selectedLanguage, locale)}
            </span>
          </span>
          <span className="text-xs font-semibold text-foreground-muted">{t("home.mobile.cardLanguage")}</span>
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          {GAMES.map((game) => {
            const progress = getProgress(game.name);
            const tier = getHighestTierForLevel(progress.currentLevel);
            const Icon = game.icon;

            return (
              <Link
                key={game.name}
                href={game.href}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center shadow-sm transition-transform hover:scale-[1.02] active:scale-95 sm:aspect-square sm:flex-1",
                  game.variant === "red"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-blue-500 text-white hover:bg-blue-600",
                )}
              >
                <Icon className="size-10" aria-hidden="true" />
                <div>
                  <h2 className="text-xl font-bold">{t(game.titleKey)}</h2>
                  <p className="mt-1 text-sm text-white/90">{t(game.descriptionKey)}</p>
                </div>
                <div className="mt-2 text-sm font-semibold text-white/80">
                  {t("games.level", { level: progress.currentLevel })} · {tier}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageOptions}
        selectedLanguage={selectedLanguage === "all" ? locale : selectedLanguage}
        onSelect={handleSelect}
        allowAll
        isAllSelected={selectedLanguage === "all"}
        onSelectAll={() => setSelectedLanguage("all")}
      />
    </div>
  );
}
