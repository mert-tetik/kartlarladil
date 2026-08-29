"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import Image from "next/image";
import { ScoreIcon } from "@/components/score-icon";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { RANKS, RANK_ACCENT_COLORS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { useT, useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { formatNumber, getRankLabel } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { RankDefinition } from "@/types/domain";

interface MobileRankInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rank: RankDefinition;
  totalPoints: number;
}

function getRankIndex(rankId: RankDefinition["id"]) {
  const index = RANKS.findIndex((item) => item.id === rankId);
  return index < 0 ? 0 : index;
}

export function MobileRankInfoSheet({
  isOpen,
  onClose,
  rank,
  totalPoints,
}: MobileRankInfoSheetProps) {
  const t = useT();
  const { locale } = useLocale();
  const currentRankIndex = getRankIndex(rank.id);
  const rankTrackRef = useRef<HTMLDivElement | null>(null);
  const rankCardRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRankIndexRef = useRef(getRankIndex(rank.id));
  const settleTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const mouseDragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [highlightRankIndex, setHighlightRankIndex] = useState(() => getRankIndex(rank.id));

  const handleRankMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const track = rankTrackRef.current;
    if (!track) return;

    mouseDragRef.current = {
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
    };
    setIsMouseDragging(true);
  }, []);

  const getNearestRankIndex = useCallback(() => {
    const track = rankTrackRef.current;
    if (!track) return -1;

    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + track.clientWidth / 2;
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    rankCardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }, []);

  const updateHighlight = useCallback((nearestIndex: number) => {
    if (nearestIndex < 0 || activeRankIndexRef.current === nearestIndex) return;

    activeRankIndexRef.current = nearestIndex;
    setHighlightRankIndex(nearestIndex);

    if (initializedRef.current) {
      vibrate("tap");
      playSoundEffect("quiz-select");
    }
  }, []);

  const centerRank = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = rankTrackRef.current;
    const card = rankCardRefs.current[index];
    if (!track || !card) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const targetLeft = track.scrollLeft +
      (cardRect.left + cardRect.width / 2 - (trackRect.left + track.clientWidth / 2));
    const nextScrollLeft = Math.max(0, targetLeft);

    if (Math.abs(track.scrollLeft - nextScrollLeft) < 1) return;

    if (behavior === "auto") {
      track.scrollLeft = nextScrollLeft;
      return;
    }

    track.scrollTo({ left: nextScrollLeft, behavior });
  }, []);

  const settleRank = useCallback(() => {
    const nearestIndex = getNearestRankIndex();
    if (nearestIndex < 0) return;

    updateHighlight(nearestIndex);
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }

    settleTimerRef.current = window.setTimeout(() => {
      centerRank(nearestIndex, "smooth");
    }, 140);
  }, [centerRank, getNearestRankIndex, updateHighlight]);

  useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      const drag = mouseDragRef.current;
      const track = rankTrackRef.current;
      if (!drag || !track) return;

      if ((event.buttons & 1) === 0) {
        mouseDragRef.current = null;
        setIsMouseDragging(false);
        settleRank();
        return;
      }

      event.preventDefault();
      track.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX);
      updateHighlight(getNearestRankIndex());
    };

    const handleWindowMouseUp = () => {
      if (!mouseDragRef.current) return;
      mouseDragRef.current = null;
      setIsMouseDragging(false);
      settleRank();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      mouseDragRef.current = null;
    };
  }, [getNearestRankIndex, settleRank, updateHighlight]);

  const centerCurrentRank = useCallback(() => {
    const index = getRankIndex(rank.id);
    activeRankIndexRef.current = index;
    setHighlightRankIndex(index);
    centerRank(index, "auto");
  }, [centerRank, rank.id]);

  useEffect(() => {
    const track = rankTrackRef.current;
    if (!track || !isOpen) return;

    initializedRef.current = false;
    const initialFrame = window.requestAnimationFrame(() => {
      centerCurrentRank();
      initializedRef.current = true;
    });

    const handleScroll = () => {
      const nearestIndex = getNearestRankIndex();
      if (nearestIndex < 0) return;

      updateHighlight(nearestIndex);

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }

      settleTimerRef.current = window.setTimeout(() => {
        centerRank(nearestIndex, "smooth");
      }, 140);
    };

    const handleResize = () => {
      centerRank(activeRankIndexRef.current, "auto");
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      track.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [centerCurrentRank, centerRank, getNearestRankIndex, isOpen, updateHighlight]);

  return (
    <MobileBottomSheetShell
      open={isOpen}
      onClose={onClose}
      title={t("home.mobile.rankInfoTitle")}
      titleId="mobile-rank-info-title"
      panelLabel={t("home.mobile.rankInfoTitle")}
      panelClassName="max-h-[96dvh]"
      onEntered={centerCurrentRank}
      visual={<RankIcon icon={rank.icon} className="size-[4.5rem]" sizes="72px" />}
      contentClassName="min-h-0"
    >
      <div className="relative flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-t-[1.75rem] bg-[#121212] text-white">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 justify-center px-5 pb-3 pt-5">
            <span className="inline-flex items-center gap-2 text-xl font-extrabold leading-none text-white">
              {formatNumber(locale, totalPoints)}
              <ScoreIcon size={26} className="size-[1.625rem]" />
            </span>
          </div>

          <div
            ref={rankTrackRef}
            className={cn(
              "min-h-0 flex-1 select-none overflow-x-auto overscroll-x-contain px-[18vw] touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              isMouseDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            data-mobile-rank-scroll
            data-mobile-rank-carousel
            aria-label={t("home.mobile.rankInfoTitle")}
            onMouseDown={handleRankMouseDown}
          >
            <div className="flex h-full w-max snap-x snap-mandatory gap-2">
            {RANKS.map((item, index) => {
              const isHighlighted = index === highlightRankIndex;
              const achieved = item.minPoints <= totalPoints;
              const isLocked = index > currentRankIndex;
              const isCurrentRank = index === currentRankIndex;
              const isCurrentRankHighlight = isHighlighted && isCurrentRank;
              const rankAccentColor = RANK_ACCENT_COLORS[item.id as keyof typeof RANK_ACCENT_COLORS];
              const nextRank = RANKS[index + 1] ?? null;
              const connectorProgress = nextRank
                ? index < currentRankIndex
                  ? 100
                  : index === currentRankIndex
                    ? Math.min(100, Math.max(0, ((totalPoints - item.minPoints) / (nextRank.minPoints - item.minPoints)) * 100))
                    : 0
                : 0;

              return (
                <div key={item.id} className="flex h-full shrink-0 items-center">
                  <article
                    ref={(element) => {
                      rankCardRefs.current[index] = element;
                    }}
                    data-rank-index={index}
                    data-current-rank={item.id === rank.id ? "true" : undefined}
                    data-highlighted={isHighlighted ? "true" : "false"}
                    className="flex h-full w-[70vw] max-w-[18rem] snap-center snap-always items-center justify-center"
                  >
                    <div
                      className={cn(
                        "flex flex-col items-center text-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isHighlighted ? "scale-100" : "scale-[0.76]",
                      )}
                    >
                      <div data-rank-highlight-ring={isCurrentRankHighlight ? "true" : "false"}>
                        <div className="relative isolate size-56">
                          {!isLocked ? (
                            <div className={cn("relative z-10 size-full transition-opacity duration-500", isCurrentRankHighlight ? "opacity-100" : "opacity-45")}>
                              <RankIcon icon={item.icon} className="size-56" sizes="224px" />
                            </div>
                          ) : null}
                          {isLocked ? (
                            <Image
                              src="/missions/mission-lock-icon-v3.png"
                              alt=""
                              width={512}
                              height={512}
                              sizes="224px"
                              unoptimized
                              className="absolute inset-0 z-20 size-56 shrink-0 object-contain opacity-100"
                              aria-hidden="true"
                              draggable={false}
                              data-rank-lock="true"
                            />
                          ) : null}
                          </div>
                      </div>
                      <h3
                        className={cn(
                          "mt-3 text-center text-xl font-bold",
                          "text-white",
                          canUseSuperWater(locale) && "font-super-water",
                        )}
                      >
                        {formatSuperWaterText(locale, getRankLabel(item, locale))}
                      </h3>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                        {formatNumber(locale, item.minPoints)}
                        <ScoreIcon size={17} className={cn("size-4", !achieved && "grayscale opacity-60")} />
                      </p>
                    </div>
                  </article>

                  {nextRank ? (
                    <div
                      className="flex h-full w-16 shrink-0 items-center justify-center"
                      aria-label={`${formatNumber(locale, Math.round(connectorProgress))}%`}
                      data-current-rank-progress={index === currentRankIndex ? "true" : undefined}
                    >
                      <span className="relative h-3 w-full overflow-hidden rounded-full bg-white/15">
                        <span
                          className="absolute inset-0 rounded-full transition-[clip-path] duration-500 ease-out"
                          style={{
                            backgroundImage: `linear-gradient(to right, ${rankAccentColor}, ${RANK_ACCENT_COLORS[nextRank.id as keyof typeof RANK_ACCENT_COLORS]})`,
                            clipPath: `inset(0 ${100 - connectorProgress}% 0 0 round 9999px)`,
                          }}
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
    </MobileBottomSheetShell>
  );
}
