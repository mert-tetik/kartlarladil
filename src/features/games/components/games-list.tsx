"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image, { type StaticImageData } from "next/image";
import { useSearchParams } from "next/navigation";
import hafizaIcon from "@/assets/games/hafiza_oyunu.png";
import wordChallengeIcon from "@/assets/games/kelime_meydan_okumasi.png";
import wordMatchIcon from "@/assets/games/kelime_eslestirme.png";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { readLandingCardLanguage } from "@/app/components/landing-card-language";
import { LanguageFlag } from "@/components/language-flag";
import { ScoreIcon } from "@/components/score-icon";
import { LANGUAGES } from "@/data/languages";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber, getLanguageDisplayName } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";
import type { GameName } from "../game-types";
import { useGameProgressStore } from "../game-progress-store";
import { getHighestTierForLevel } from "../game-levels";
import { GAME_LAUNCH_COLORS, requestGameLaunch } from "../game-launch-transition";
import {
  MISSION_AUTO_START_QUERY_KEY,
  MISSION_GAME_QUERY_KEY,
  parseMissionGame,
} from "@/features/missions/mission-navigation";
import { useProgressStats } from "@/features/progress/progress-client";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";

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
}

const GAMES: GameEntry[] = [
  {
    name: "memory",
    href: "/games/memory",
    icon: hafizaIcon,
    titleKey: "games.memory.title",
    descriptionKey: "games.memory.description",
  },
  {
    name: "wordChallenge",
    href: "/games/word-challenge",
    icon: wordChallengeIcon,
    titleKey: "games.wordChallenge.title",
    descriptionKey: "games.wordChallenge.description",
  },
  {
    name: "wordMatch",
    href: "/games/word-match",
    icon: wordMatchIcon,
    titleKey: "games.wordMatch.title",
    descriptionKey: "games.wordMatch.description",
  },
];

const GAME_SELECTION_BACKGROUND_SOURCES: Partial<Record<GameName, string>> = {
  wordChallenge: "/game-backgrounds/dogru-yanlis.png",
  wordMatch: "/game-backgrounds/kelime-eslestirme.png",
};

const TIER_TEXT_COLORS: Record<Tier, string> = {
  A1: "text-[var(--tier-a1-text)]",
  A2: "text-[var(--tier-a2-text)]",
  B1: "text-[var(--tier-b1-text)]",
  B2: "text-[var(--tier-b2-text)]",
  C1: "text-[var(--tier-c1-text)]",
};

const GAME_CONTENT_TRANSITION_DURATION_MS = 700;

function renderGameTitle(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return title;
  }

  const splitAt = Math.ceil(words.length / 2);

  return (
    <>
      <span className="block">{words.slice(0, splitAt).join(" ")}</span>
      <span className="block">{words.slice(splitAt).join(" ")}</span>
    </>
  );
}

interface SelectedGameContentProps {
  game: GameEntry;
  currentLevel: number;
  tier: Tier;
  locale: LocaleCode;
  superWaterFont: boolean;
  t: ReturnType<typeof useT>;
  className?: string;
  "aria-hidden"?: boolean;
}

function SelectedGameContent({
  game,
  currentLevel,
  tier,
  locale,
  superWaterFont,
  t,
  className,
  "aria-hidden": ariaHidden,
}: SelectedGameContentProps) {
  return (
    <div className={cn("flex w-full flex-col items-center", className)} aria-hidden={ariaHidden}>
      <div className="mb-2 max-w-md text-center">
        <h2 className={cn("font-display text-[clamp(2rem,8vw,3.25rem)] font-semibold leading-[0.95] text-white", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t(game.titleKey))}
        </h2>
      </div>

      <div
        role="img"
        aria-label={t(game.titleKey)}
        className="relative flex size-[min(40vw,14rem)] max-h-[24vh] max-w-[14rem] items-center justify-center"
      >
        <Image
          src={game.icon}
          alt=""
          width={512}
          height={512}
          className="relative size-full object-contain drop-shadow-[0_10px_16px_rgba(0,0,0,0.34)]"
        />
      </div>

      <div className="mt-3 flex items-baseline justify-center gap-3 text-center">
        <p className={cn("font-display text-[clamp(2.25rem,8vw,4rem)] font-semibold leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t("games.level", { level: currentLevel }))}
        </p>
        <p className={cn("text-xl font-bold", TIER_TEXT_COLORS[tier], superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, tier)}
        </p>
      </div>
    </div>
  );
}

export function GamesList() {
  const t = useT();
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const { stats } = useProgressStats();
  const getProgress = useGameProgressStore((state) => state.getProgress);
  const selectedLanguage = useGameProgressStore((state) => state.selectedLanguage);
  const setSelectedLanguage = useGameProgressStore((state) => state.setSelectedLanguage);
  const [selectedGameName, setSelectedGameName] = useState<GameName>("memory");
  const [visibleGameName, setVisibleGameName] = useState<GameName>("memory");
  const [exitingGameName, setExitingGameName] = useState<GameName | null>(null);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [showLanguageMatchDialog, setShowLanguageMatchDialog] = useState(false);
  const contentTransitionTimerRef = useRef<number | null>(null);
  const consumedAutoStartRef = useRef<string | null>(null);

  const languageOptions = LANGUAGES.map((language) => ({ code: language.code, count: 0 }));
  const displayedLanguage = selectedLanguage === "all" ? readLandingCardLanguage() ?? locale : selectedLanguage;
  const selectedGame = GAMES.find((game) => game.name === selectedGameName) ?? GAMES[0];
  const visibleGame = GAMES.find((game) => game.name === visibleGameName) ?? GAMES[0];
  const incomingGame = selectedGame;
  const outgoingGame = exitingGameName
    ? GAMES.find((game) => game.name === exitingGameName) ?? GAMES[0]
    : null;
  const visibleProgress = getProgress(visibleGame.name);
  const incomingProgress = getProgress(incomingGame.name);
  const outgoingProgress = outgoingGame ? getProgress(outgoingGame.name) : null;
  const visibleTier = getHighestTierForLevel(visibleProgress.currentLevel);
  const incomingTier = getHighestTierForLevel(incomingProgress.currentLevel);
  const outgoingTier = outgoingProgress ? getHighestTierForLevel(outgoingProgress.currentLevel) : null;
  const superWaterFont = canUseSuperWater(locale);

  const missionGame = parseMissionGame(searchParams.get(MISSION_GAME_QUERY_KEY));
  const missionAutoStart = searchParams.get(MISSION_AUTO_START_QUERY_KEY) === "1";

  useEffect(() => {
    const landingLanguage = readLandingCardLanguage() ?? locale;
    setSelectedLanguage(landingLanguage);
  }, [locale, setSelectedLanguage]);

  useEffect(() => {
    return () => {
      if (contentTransitionTimerRef.current !== null) {
        window.clearTimeout(contentTransitionTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!missionAutoStart || !missionGame) return;

    if (selectedGameName !== missionGame) {
      setSelectedGameName(missionGame);
      setVisibleGameName(missionGame);
      setExitingGameName(null);
      return;
    }

    const autoStartKey = `${missionGame}:1`;
    if (consumedAutoStartRef.current === autoStartKey) return;

    const frameId = window.requestAnimationFrame(() => {
      const launchButton = document.querySelector<HTMLButtonElement>(`[data-game-launch="${missionGame}"]`);
      const rect = launchButton?.getBoundingClientRect();

      if (!rect) return;

      consumedAutoStartRef.current = autoStartKey;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete(MISSION_GAME_QUERY_KEY);
      cleanUrl.searchParams.delete(MISSION_AUTO_START_QUERY_KEY);
      window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

      requestGameLaunch({
        game: missionGame,
        href: selectedGame.href,
        color: GAME_LAUNCH_COLORS[missionGame],
        origin: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [missionAutoStart, missionGame, selectedGame.href, selectedGameName]);

  function handleSelect(language: LanguageCode) {
    setLanguageSheetOpen(false);

    if (language === locale) {
      setShowLanguageMatchDialog(true);
      return;
    }

    setSelectedLanguage(language);
  }

  function handleSelectGame(game: GameEntry) {
    if (game.name === selectedGame.name) return;
    vibrate("tap");
    if (contentTransitionTimerRef.current !== null) {
      window.clearTimeout(contentTransitionTimerRef.current);
    }
    setExitingGameName(visibleGameName);
    setSelectedGameName(game.name);
    contentTransitionTimerRef.current = window.setTimeout(() => {
      setVisibleGameName(game.name);
      setExitingGameName(null);
      contentTransitionTimerRef.current = null;
    }, GAME_CONTENT_TRANSITION_DURATION_MS);
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
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-5 sm:py-8">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        {Object.entries(GAME_SELECTION_BACKGROUND_SOURCES).map(([gameName, source]) => (
          <div
            key={gameName}
            data-game-selection-background={gameName}
            className={cn(
              "absolute inset-0 bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              selectedGame.name === gameName && "opacity-100",
            )}
            style={{
              backgroundImage: `linear-gradient(rgb(2 6 23 / 0.16), rgb(2 6 23 / 0.16)), url(${source})`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
        <h1 className="sr-only">{t("games.title")}</h1>

        <div className="flex w-full flex-col items-center">
          <div className="relative mb-2 w-full max-w-md" data-game-content-stage>
            {exitingGameName ? (
              <>
                <SelectedGameContent
                  game={visibleGame}
                  currentLevel={visibleProgress.currentLevel}
                  tier={visibleTier}
                  locale={locale}
                  superWaterFont={superWaterFont}
                  t={t}
                  className="invisible"
                  aria-hidden
                />
                {outgoingGame && outgoingTier ? (
                  <SelectedGameContent
                    key={`outgoing-${outgoingGame.name}`}
                    game={outgoingGame}
                    currentLevel={outgoingProgress?.currentLevel ?? 1}
                    tier={outgoingTier}
                    locale={locale}
                    superWaterFont={superWaterFont}
                    t={t}
                    className="pointer-events-none absolute inset-0 animate-games-selected-content-out-right"
                    aria-hidden
                  />
                ) : null}
                <SelectedGameContent
                  key={`incoming-${incomingGame.name}`}
                  game={incomingGame}
                  currentLevel={incomingProgress.currentLevel}
                  tier={incomingTier}
                  locale={locale}
                  superWaterFont={superWaterFont}
                  t={t}
                  className="pointer-events-none absolute inset-0 animate-games-selected-content-in-left"
                />
              </>
            ) : (
              <SelectedGameContent
                game={incomingGame}
                currentLevel={incomingProgress.currentLevel}
                tier={incomingTier}
                locale={locale}
                superWaterFont={superWaterFont}
                t={t}
              />
            )}
          </div>

          <div className="mt-4 flex w-full max-w-md items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                vibrate("tap");
                setLanguageSheetOpen(true);
              }}
              aria-label={getLanguageDisplayName(displayedLanguage, locale)}
              title={getLanguageDisplayName(displayedLanguage, locale)}
              className="flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <LanguageFlag code={displayedLanguage} className="h-10 w-12" />
            </button>

            <button
              type="button"
              data-game-launch={selectedGame.name}
              onClick={(event) => handleGameLaunch(event, selectedGame)}
              className="relative isolate inline-flex h-16 w-44 shrink-0 items-center justify-center overflow-hidden rounded-full border border-transparent px-3 text-center transition-transform duration-300 hover:scale-[1.02] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-52"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full border border-transparent [background:linear-gradient(var(--pricing-mobile-surface),var(--pricing-mobile-surface))_padding-box,linear-gradient(180deg,var(--pricing-mobile-surface-outline-top),var(--pricing-mobile-surface-outline-bottom))_border-box]"
              />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                <Image
                  src="/pricing-buttons/pricing-active-button-v2.png"
                  alt=""
                  fill
                  sizes="208px"
                  className="object-fill"
                />
              </span>
              <span className={cn("relative z-10 text-3xl font-semibold leading-none sm:text-4xl", superWaterFont && "font-super-water")}>
                {formatSuperWaterText(locale, t("games.play")).toUpperCase()}
              </span>
            </button>

            <div
              className="flex shrink-0 items-center gap-1.5 text-[1.45rem] font-bold leading-none text-white"
              aria-label={`${formatNumber(locale, stats.totalPoints)} ${t("home.mobile.pointsLabel")}`}
              data-games-points
            >
              <span className={cn("text-[var(--score-start)]", superWaterFont && "font-super-water")}>
                {formatNumber(locale, stats.totalPoints)}
              </span>
              <ScoreIcon size={28} className="h-7 w-auto drop-shadow-[0_6px_16px_rgba(0,0,0,0.22)]" />
            </div>
          </div>

          <div className="mt-16 grid w-full max-w-md grid-cols-3 items-end gap-3">
          {GAMES.map((game) => {
            const selected = game.name === selectedGame.name;
            return (
              <button
                key={game.name}
                type="button"
                data-game-select={game.name}
                data-selected={selected}
                onClick={() => handleSelectGame(game)}
                aria-pressed={selected}
                aria-label={t(game.titleKey)}
                className={cn(
                  "group relative flex min-h-36 min-w-0 origin-center transform-gpu items-center justify-end overflow-visible rounded-3xl border px-2.5 pb-3 pt-8 text-center outline-none transition-[scale,transform,background-color,border-color,box-shadow,filter,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[scale,transform,background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-white/90",
                  selected
                    ? "scale-[1.07] border-white bg-white text-slate-900 shadow-[0_8px_20px_rgba(255,255,255,0.18)]"
                    : "scale-100 border-white/40 bg-white/45 text-slate-800/75 hover:border-white/70 hover:bg-white/60",
                )}
              >
                <Image
                  src={game.icon}
                  alt=""
                  width={128}
                  height={128}
                  className={cn(
                    "absolute left-1/2 top-0 size-[clamp(4rem,19vw,7rem)] -translate-x-1/2 -translate-y-[42%] object-contain transition-[scale,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[scale,transform,filter]",
                    selected
                      ? "scale-[1.15] brightness-110 drop-shadow-[0_5px_8px_rgba(0,0,0,0.25)]"
                      : "scale-[0.92] brightness-75 grayscale-[0.15]",
                  )}
                />
                <span className={cn("relative z-10 block w-full translate-y-4 text-center text-xl font-semibold leading-tight transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:text-2xl", superWaterFont && "font-super-water")}>
                  {renderGameTitle(formatSuperWaterText(locale, t(game.titleKey)))}
                </span>
              </button>
            );
          })}
          </div>
      </div>

        </div>

      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageOptions}
        selectedLanguage={displayedLanguage}
        onSelect={handleSelect}
        showCounts={false}
        optionStyle="navbar"
      />

      <UpgradeDialog
        open={showLanguageMatchDialog}
        errorCode="game_language_match_not_allowed"
        onOpenChange={setShowLanguageMatchDialog}
      />
    </div>
  );
}
