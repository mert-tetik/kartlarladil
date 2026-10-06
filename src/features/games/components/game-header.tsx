"use client";

import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { formatGameTime } from "../game-timer";

const GAME_HEADER_ITEM_STYLE = {
  backgroundImage: "url('/game-backgrounds/plank-var-bg.png')",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%",
} as const;

const GAME_HEADER_PLANK_STYLE = {
  backgroundImage: "url('/game-backgrounds/plank.png')",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%",
} as const;

interface GameHeaderProps {
  level: number;
  remainingSeconds: number;
  progressLabel: string;
}

export function GameHeader({ level, remainingSeconds, progressLabel }: GameHeaderProps) {
  const { locale } = useLocale();
  const t = useT();
  const superWaterFont = canUseSuperWater(locale);

  return (
    <div
      className="relative top-5 mx-auto flex min-h-14 w-[calc(100%_-_1rem)] max-w-[820px] items-center justify-between gap-3 px-3 py-3 [aspect-ratio:1140/174]"
      data-game-header
      style={GAME_HEADER_PLANK_STYLE}
    >
      <div
        className={cn("relative left-5 flex h-10 min-w-[4.25rem] items-center justify-center whitespace-nowrap px-3 font-mono text-base font-bold", remainingSeconds <= 5 && "text-rose-500", superWaterFont && "font-super-water")}
        data-game-header-item="timer"
        style={GAME_HEADER_ITEM_STYLE}
      >
        {formatSuperWaterText(locale, formatGameTime(remainingSeconds))}
      </div>

      <div
        className="absolute left-1/2 top-1/2 flex h-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap px-3"
        data-game-header-item="level"
      >
        <span className={cn("text-2xl font-bold leading-none text-foreground sm:text-3xl", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t("games.level", { level }))}
        </span>
      </div>

      <div
        className={cn("relative right-5 flex h-10 min-w-[5rem] items-center justify-center whitespace-nowrap px-3 text-base font-semibold text-white", superWaterFont && "font-super-water")}
        data-game-header-item="progress"
        style={GAME_HEADER_ITEM_STYLE}
      >
        {formatSuperWaterText(locale, progressLabel)}
      </div>
    </div>
  );
}
