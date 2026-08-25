"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { ScoreIcon } from "@/components/score-icon";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { useT, useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { formatNumber, getRankLabel } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import type { RankDefinition } from "@/types/domain";

interface MobileRankInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rank: RankDefinition;
  totalPoints: number;
}

export function MobileRankInfoSheet({
  isOpen,
  onClose,
  rank,
  totalPoints,
}: MobileRankInfoSheetProps) {
  const t = useT();
  const { locale } = useLocale();
  const rankScrollRef = useRef<HTMLDivElement | null>(null);
  const currentRankRef = useRef<HTMLDivElement | null>(null);

  const centerCurrentRank = useCallback(() => {
    const scrollViewport = rankScrollRef.current;
    const currentRank = currentRankRef.current;
    if (!scrollViewport || !currentRank) return;

    const viewportRect = scrollViewport.getBoundingClientRect();
    const rankRect = currentRank.getBoundingClientRect();
    const centeredScrollTop =
      scrollViewport.scrollTop +
      rankRect.top -
      viewportRect.top -
      (scrollViewport.clientHeight - rankRect.height) / 2;

    scrollViewport.scrollTop = Math.max(0, centeredScrollTop);
  }, []);

  useLayoutEffect(() => {
    if (isOpen) centerCurrentRank();
  }, [centerCurrentRank, isOpen, rank.id]);

  return (
    <MobileBottomSheetShell
      open={isOpen}
      onClose={onClose}
      title={t("home.mobile.rankInfoTitle")}
      titleId="mobile-rank-info-title"
      panelLabel={t("home.mobile.rankInfoTitle")}
      panelClassName="max-h-[85dvh]"
      onEntered={centerCurrentRank}
      visual={<RankIcon icon={rank.icon} className="size-[3.25rem]" sizes="52px" />}
      contentClassName="px-5"
    >
      <div className="mb-2 flex shrink-0 justify-end">
        <span className="inline-flex items-center gap-1.5 text-base font-bold text-brand-foreground">
          {formatNumber(locale, totalPoints)}
          <ScoreIcon size={21} className="size-5" />
        </span>
      </div>

      <div
        ref={rankScrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-1 pb-8"
        data-mobile-rank-scroll
      >
        <div className="flex flex-col items-center pt-2">
          {RANKS.map((item, index) => {
            const current = item.id === rank.id;
            const next = RANKS[index + 1] ?? null;
            const connectorProgress = next
              ? Math.min(100, Math.max(0, ((totalPoints - item.minPoints) / (next.minPoints - item.minPoints)) * 100))
              : 0;

            return (
              <div key={item.id} className="flex w-full flex-col items-center">
                <div
                  ref={current ? currentRankRef : undefined}
                  className="flex flex-col items-center"
                  data-current-rank={current ? "true" : undefined}
                >
                  <div className={cn("rounded-full p-1.5", current && "bg-gradient-to-b from-orange-500 via-amber-400 to-amber-300 shadow-sm")}>
                    <div className={cn("rounded-full p-2", current && "bg-background-card")}>
                      <RankIcon icon={item.icon} className="size-32" sizes="128px" />
                    </div>
                  </div>
                  <h3 className={cn("mt-3 text-center text-xl font-bold", current ? "bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent" : "text-foreground", canUseSuperWater(locale) && "font-super-water")}>
                    {formatSuperWaterText(locale, getRankLabel(item, locale))}
                  </h3>
                  <p className={cn("mt-1 inline-flex items-center gap-1.5 text-sm font-semibold", current ? "text-amber-600 dark:text-amber-400" : "text-foreground-secondary")}>
                    {formatNumber(locale, item.minPoints)}
                    <ScoreIcon size={17} className="size-4" />
                  </p>
                </div>

                {next ? (
                  <div className="relative my-4 h-20 w-full" aria-label={`${formatNumber(locale, Math.round(connectorProgress))}%`}>
                    <span className="absolute left-1/2 top-0 h-full w-3 -translate-x-1/2 overflow-hidden rounded-full bg-background-muted">
                      <span
                        className="absolute inset-x-0 top-0 rounded-full bg-gradient-to-b from-orange-500 to-amber-300 transition-[height] duration-500 ease-out"
                        style={{ height: `${connectorProgress}%` }}
                      />
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </MobileBottomSheetShell>
  );
}
