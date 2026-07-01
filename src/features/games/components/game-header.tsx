"use client";

import { TIER_STYLES } from "@/data/tiers";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { Tier } from "@/types/domain";
import { formatGameTime } from "../game-timer";

interface GameHeaderProps {
  level: number;
  tiers: Tier[];
  remainingSeconds: number;
  progressLabel: string;
}

export function GameHeader({ level, tiers, remainingSeconds, progressLabel }: GameHeaderProps) {
  const t = useT();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background-card px-4 py-3">
      <div className={cn("font-mono text-sm font-bold", remainingSeconds <= 5 && "text-rose-500")}>
        {formatGameTime(remainingSeconds)}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-foreground">{t("games.level", { level })}</span>
        <div className="flex items-center gap-1">
          {tiers.map((tier) => (
            <span
              key={tier}
              className={cn(
                "inline-flex min-w-[2rem] items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white",
                TIER_STYLES[tier].accent,
              )}
            >
              {tier}
            </span>
          ))}
        </div>
      </div>

      <div className="text-sm font-semibold text-foreground-secondary">{progressLabel}</div>
    </div>
  );
}
