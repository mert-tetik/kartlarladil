"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import hafizaIcon from "@/assets/games/hafiza_oyunu.png";
import wordChallengeIcon from "@/assets/games/kelime_meydan_okumasi.png";
import wordMatchIcon from "@/assets/games/kelime_eslestirme.png";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { readLandingCardLanguage } from "@/app/components/landing-card-language";
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
import { GAME_LAUNCH_COLORS, requestGameLaunch } from "../game-launch-transition";

interface GameEntry {
  name: GameName;
  href: string;
  icon: StaticImageData;
  titleKey:
    | "games.memory.title"
    | "games.wordChallenge.title"
    | "games.wordMatch.title";
  descriptionKey:
    | "games.memory.description"
    | "games.wordChallenge.description"
    | "games.wordMatch.description";
  variant: "red" | "blue" | "green" | "lightBlue";
}

const GAMES: GameEntry[] = [
  {
    name: "memory",
    href: "/games/memory",
    icon: hafizaIcon,
    titleKey: "games.memory.title",
    descriptionKey: "games.memory.description",
    variant: "red",
  },
  {
    name: "wordChallenge",
    href: "/games/word-challenge",
    icon: wordChallengeIcon,
    titleKey: "games.wordChallenge.title",
    descriptionKey: "games.wordChallenge.description",
    variant: "green",
  },
  {
    name: "wordMatch",
    href: "/games/word-match",
    icon: wordMatchIcon,
    titleKey: "games.wordMatch.title",
    descriptionKey: "games.wordMatch.description",
    variant: "lightBlue",
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
  const displayedLanguage = selectedLanguage === "all" ? readLandingCardLanguage() ?? locale : selectedLanguage;

  useEffect(() => {
    const landingLanguage = readLandingCardLanguage() ?? locale;
    setSelectedLanguage(landingLanguage);
  }, [locale, setSelectedLanguage]);

  function handleSelect(language: LanguageCode) {
    setSelectedLanguage(language);
  }

  function handleGameLaunch(event: MouseEvent<HTMLButtonElement>, game: GameEntry) {
    vibrate("tap");
    const rect = event.currentTarget.getBoundingClientRect();
    requestGameLaunch({
      game: game.name,
      href: game.href,
      color: GAME_LAUNCH_COLORS[game.name],
      origin: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      },
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:flex-row sm:gap-6">
      <div className="flex w-full max-w-sm flex-col gap-4 sm:max-w-none sm:flex-1">
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("games.title")}</h1>
          <button
            type="button"
            onClick={() => {
              vibrate("tap");
              setLanguageSheetOpen(true);
            }}
            className="flex w-40 shrink-0 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-black transition-colors hover:bg-slate-100"
          >
            <LanguageFlag code={displayedLanguage} className="h-5 w-7" />
            <span className="truncate text-sm font-semibold text-black">
              {getLanguageDisplayName(displayedLanguage, locale)}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          {GAMES.map((game) => {
            const progress = getProgress(game.name);
            const tier = getHighestTierForLevel(progress.currentLevel);

            return (
              <button
                key={game.name}
                type="button"
                data-game-launch={game.name}
                onClick={(event) => handleGameLaunch(event, game)}
                className={cn(
                  "flex w-full flex-col items-start justify-start gap-3 rounded-2xl p-6 text-left transition-[transform,box-shadow] hover:scale-[1.02] active:scale-95 sm:aspect-[1.3/1] sm:flex-1",
                  game.variant === "red"
                    ? "bg-red-500 text-white shadow-[0_18px_44px_rgba(239,68,68,0.58)] hover:bg-red-600 hover:shadow-[0_22px_50px_rgba(239,68,68,0.68)]"
                    : game.variant === "green"
                      ? "bg-emerald-500 text-white shadow-[0_18px_44px_rgba(16,185,129,0.58)] hover:bg-emerald-600 hover:shadow-[0_22px_50px_rgba(16,185,129,0.68)]"
                      : game.variant === "lightBlue"
                        ? "bg-sky-400 text-white shadow-[0_18px_44px_rgba(56,189,248,0.58)] hover:bg-sky-500 hover:shadow-[0_22px_50px_rgba(56,189,248,0.68)]"
                        : "bg-blue-500 text-white shadow-[0_18px_44px_rgba(59,130,246,0.58)] hover:bg-blue-600 hover:shadow-[0_22px_50px_rgba(59,130,246,0.68)]",
                )}
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={game.icon}
                    alt={t(game.titleKey)}
                    width={32}
                    height={32}
                    className="size-8 object-contain"
                  />
                  <h2 className="text-xl font-bold text-slate-950">{t(game.titleKey)}</h2>
                </div>
                <p className="text-sm text-slate-950/80">{t(game.descriptionKey)}</p>
                <div className="mt-2 text-sm font-semibold text-slate-950/70">
                  {t("games.level", { level: progress.currentLevel })} · {tier}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageOptions}
        selectedLanguage={displayedLanguage}
        onSelect={handleSelect}
        showCounts={false}
      />
    </div>
  );
}
