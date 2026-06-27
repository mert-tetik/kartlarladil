"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { Progress } from "@/components/ui/progress";
import { useT, useLocale } from "@/i18n/locale-provider";
import { formatNumber, getRankLabel } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import type { RankDefinition } from "@/types/domain";

interface MobileRankInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rank: RankDefinition;
  nextRank: RankDefinition | null;
  totalPoints: number;
  pointsToNextRank: number;
  rankProgressPercent: number;
}

export function MobileRankInfoSheet({
  isOpen,
  onClose,
  rank,
  nextRank,
  totalPoints,
  pointsToNextRank,
  rankProgressPercent,
}: MobileRankInfoSheetProps) {
  const t = useT();
  const { locale } = useLocale();
  const mounted = useIsClient();

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-background-card p-5 shadow-2xl transition-transform duration-300",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("home.mobile.rankInfoTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex size-9 items-center justify-center rounded-full text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center py-4">
            <RankIcon icon={rank.icon} className="size-32" sizes="128px" />
            <h3 className="mt-4 text-2xl font-extrabold text-brand">{getRankLabel(rank, locale)}</h3>
            <p className="mt-1 text-sm font-semibold text-foreground-secondary">
              {formatNumber(locale, totalPoints)} {t("home.mobile.pointsLabel")}
            </p>
          </div>

          {nextRank ? (
            <div className="space-y-2 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-foreground-secondary">{t("home.mobile.rankInfoProgress")}</span>
                <span className="text-foreground">{formatNumber(locale, pointsToNextRank)} {t("home.mobile.pointsLabel")}</span>
              </div>
              <Progress value={rankProgressPercent} className="h-2" />
              <p className="text-xs text-foreground-secondary">
                {t("home.mobile.rankInfoNextRank", { rank: getRankLabel(nextRank, locale) })}
              </p>
            </div>
          ) : (
            <p className="text-center text-sm font-semibold text-foreground-secondary">
              {t("home.mobile.rankInfoMaxRank")}
            </p>
          )}

          <div className="mt-6 space-y-2">
            {RANKS.map((item) => {
              const current = item.id === rank.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                    current
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background",
                  )}
                >
                  <RankIcon icon={item.icon} className="size-8" sizes="32px" />
                  <div className="flex-1">
                    <p className={cn("text-sm font-bold", current ? "text-brand" : "text-foreground")}>
                      {getRankLabel(item, locale)}
                    </p>
                    <p className="text-xs text-foreground-secondary">
                      {formatNumber(locale, item.minPoints)} {t("home.mobile.pointsLabel")}
                    </p>
                  </div>
                  {current ? (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                      {t("home.mobile.currentRank")}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
