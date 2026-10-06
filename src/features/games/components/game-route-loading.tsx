"use client";

import Image, { type StaticImageData } from "next/image";
import hafizaIcon from "@/assets/games/hafiza_oyunu.png";
import wordChallengeIcon from "@/assets/games/kelime_meydan_okumasi.png";
import wordMatchIcon from "@/assets/games/kelime_eslestirme.png";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatSuperWaterText } from "@/lib/super-water";
import type { GameName } from "../game-types";

interface GameRouteLoadingProps {
  color: string;
  game: GameName;
}

const GAME_LOADING_ICONS: Record<GameName, StaticImageData> = {
  memory: hafizaIcon,
  wordChallenge: wordChallengeIcon,
  wordMatch: wordMatchIcon,
};

const GAME_LOADING_TITLE_KEYS = {
  memory: "games.memory.title",
  wordChallenge: "games.wordChallenge.title",
  wordMatch: "games.wordMatch.title",
} as const;

export function GameRouteLoading({ color, game }: GameRouteLoadingProps) {
  const { locale } = useLocale();
  const t = useT();
  const icon = GAME_LOADING_ICONS[game];

  return (
    <div
      aria-busy="true"
      aria-label={t(GAME_LOADING_TITLE_KEYS[game])}
      className="fixed inset-0 z-[260] flex items-center justify-center overflow-hidden"
      role="status"
      style={{ backgroundColor: color }}
    >
      <div className="flex flex-col items-center justify-center text-center text-white">
        <Image
          src={icon}
          alt=""
          width={256}
          height={256}
          priority
          className="size-[min(42vw,13rem)] animate-pulse object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.28)]"
        />
        <p className="mt-5 max-w-[80vw] font-display text-3xl font-semibold leading-tight sm:text-4xl">
          {formatSuperWaterText(locale, t(GAME_LOADING_TITLE_KEYS[game]))}
        </p>
      </div>
    </div>
  );
}
