"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
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
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragOffsetY = useRef(0);

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
      role="dialog"
      aria-modal={isOpen}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-background-card p-5 shadow-2xl",
          isOpen ? "translate-y-0" : "translate-y-full",
          isDragging ? "transition-none" : "transition-transform duration-300 ease-out",
        )}
        style={isOpen ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          onPointerDown={(event) => {
            if (!isOpen) return;
            dragStartY.current = event.clientY;
            dragOffsetY.current = 0;
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (dragStartY.current === null) return;
            const nextOffset = Math.max(0, event.clientY - dragStartY.current);
            dragOffsetY.current = nextOffset;
            setDragY(nextOffset);
          }}
          onPointerUp={() => {
            const shouldClose = dragOffsetY.current > 110;
            dragStartY.current = null;
            dragOffsetY.current = 0;
            setIsDragging(false);
            if (shouldClose) {
              setDragY(0);
              onClose();
            }
            else setDragY(0);
          }}
          onPointerCancel={() => {
            dragStartY.current = null;
            dragOffsetY.current = 0;
            setIsDragging(false);
            setDragY(0);
          }}
          className="mx-auto flex h-8 w-16 touch-none items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("home.mobile.rankInfoTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            data-tutorial-target="close-rank-menu"
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
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground-secondary">
              {formatNumber(locale, totalPoints)} <ScoreIcon size={18} className="size-[18px]" />
            </p>
          </div>

          {nextRank ? (
            <div className="space-y-2 rounded-xl bg-background p-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-foreground-secondary">{t("home.mobile.rankInfoProgress")}</span>
                <span className="inline-flex items-center gap-1 text-foreground"><span>{formatNumber(locale, pointsToNextRank)}</span><ScoreIcon size={16} className="size-4" /><span>{t("home.mobile.rankInfoRemaining")}</span></span>
              </div>
              <Progress value={rankProgressPercent} className="h-2 bg-white/20" indicatorClassName="bg-gradient-to-r from-amber-400 to-orange-500" />
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
                    "flex items-center gap-3 rounded-xl p-3 transition-colors",
                    current
                      ? "border border-amber-200/75 bg-gradient-to-r from-amber-400 to-orange-500"
                      : "bg-background",
                  )}
                >
                  <RankIcon icon={item.icon} className="size-8" sizes="32px" />
                  <div className="flex-1">
                    <p className={cn("text-sm font-bold", current ? "text-black" : "text-foreground")}>
                      {getRankLabel(item, locale)}
                    </p>
                    <p className={cn("inline-flex items-center gap-1 text-xs", current ? "text-black/70" : "text-foreground-secondary")}>
                      {formatNumber(locale, item.minPoints)} <ScoreIcon size={13} className="size-3" />
                    </p>
                  </div>
                  {current ? (
                    <span className="rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-bold text-black">
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
