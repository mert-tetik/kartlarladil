"use client";

import { TIER_STYLES } from "@/data/tiers";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { Tier } from "@/types/domain";
import { formatGameTime } from "../game-timer";

const GAME_HEADER_ITEM_STYLE = {
  backgroundImage: "url('/game-backgrounds/plank-var-bg.png')",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "100% 100%",
} as const;

const GAME_HEADER_LEVEL_STYLE = {
  backgroundImage: "url('/game-backgrounds/plank-var-bg-long.png')",
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
  tiers: Tier[];
  remainingSeconds: number;
  progressLabel: string;
}

export function GameHeader({ level, tiers, remainingSeconds, progressLabel }: GameHeaderProps) {
  const { locale } = useLocale();
  const t = useT();
  const superWaterFont = canUseSuperWater(locale);

  return (
    <div
      className="mx-auto flex min-h-14 w-[calc(100%_-_1rem)] max-w-[820px] items-center justify-between gap-3 border-b border-border bg-transparent px-3 py-3 [aspect-ratio:1140/174]"
      data-game-header
      style={GAME_HEADER_PLANK_STYLE}
    >
      <div
        className={cn("flex h-10 min-w-[4.25rem] items-center justify-center whitespace-nowrap px-3 font-mono text-base font-bold", remainingSeconds <= 5 && "text-rose-500", superWaterFont && "font-super-water")}
        data-game-header-item="timer"
        style={GAME_HEADER_ITEM_STYLE}
      >
        {formatSuperWaterText(locale, formatGameTime(remainingSeconds))}
      </div>

      <div
        className="flex h-10 items-center justify-center gap-3 whitespace-nowrap px-3"
        data-game-header-item="level"
        style={GAME_HEADER_LEVEL_STYLE}
      >
        <span className={cn("text-base font-bold text-foreground", superWaterFont && "font-super-water")}>
          {formatSuperWaterText(locale, t("games.level", { level }))}
        </span>
        <div className="flex items-center gap-1">
          {tiers.map((tier) => (
            <span
              key={tier}
              className={cn(
                "inline-flex min-w-[2.5rem] items-center justify-center rounded px-2 py-1 text-xs font-bold uppercase tracking-wider text-white",
                superWaterFont && "font-super-water",
                TIER_STYLES[tier].accent,
              )}
            >
              {formatSuperWaterText(locale, tier)}
            </span>
          ))}
        </div>
      </div>

      <div
        className={cn("flex h-10 min-w-[5rem] items-center justify-center whitespace-nowrap px-3 text-base font-semibold text-white", superWaterFont && "font-super-water")}
        data-game-header-item="progress"
        style={GAME_HEADER_ITEM_STYLE}
      >
        {formatSuperWaterText(locale, progressLabel)}
      </div>
    </div>
  );
}
