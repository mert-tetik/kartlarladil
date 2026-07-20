"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { useT, useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { formatNumber, getRankLabel } from "@/i18n/labels";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={cn("text-lg font-semibold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
            {formatSuperWaterText(locale, t("home.mobile.rankInfoTitle"))}
          </h2>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-base font-bold text-foreground">
              {formatNumber(locale, totalPoints)}
              <ScoreIcon size={21} className="size-5" />
            </span>
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
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-1 pb-8">
          <div className="flex flex-col items-center pt-2">
            {RANKS.map((item, index) => {
              const current = item.id === rank.id;
              const next = RANKS[index + 1] ?? null;
              const connectorProgress = next
                ? Math.min(100, Math.max(0, ((totalPoints - item.minPoints) / (next.minPoints - item.minPoints)) * 100))
                : 0;

              return (
                <div key={item.id} className="flex w-full flex-col items-center">
                  <div className="flex flex-col items-center">
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
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
