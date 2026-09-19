"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RANKS, RANK_ACCENT_COLORS } from "@/features/progress/progress-stats";
import { RankIcon } from "@/features/progress/rank-icons";
import { useT, useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { formatNumber, getRankLabel } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { RankDefinition } from "@/types/domain";

const RANK_DETAILS_CLOSE_DURATION = 420;
const RANK_DETAILS_SWIPE_THRESHOLD = 48;

interface MobileRankInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rank: RankDefinition;
  totalPoints: number;
}

interface RankPointerDrag {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  moved: boolean;
}

function getRankIndex(rankId: RankDefinition["id"]) {
  const index = RANKS.findIndex((item) => item.id === rankId);
  return index < 0 ? 0 : index;
}

function getAccentColor(rankId: RankDefinition["id"]) {
  return RANK_ACCENT_COLORS[rankId as keyof typeof RANK_ACCENT_COLORS] ?? RANK_ACCENT_COLORS.baslangic;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function lightenHex(hex: string, amount: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((character) => `${character}${character}`).join("")
    : normalized;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const lightened = channels.map((channel) => Math.round(channel + (255 - channel) * amount));

  return `rgb(${lightened[0]}, ${lightened[1]}, ${lightened[2]})`;
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
  const activeRankIndexRef = useRef(currentRankIndex);
  const pointerDragRef = useRef<RankPointerDrag | null>(null);
  const initializedRef = useRef(false);
  const hasBeenOpenedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [isDragging, setIsDragging] = useState(false);
  const [highlightRankIndex, setHighlightRankIndex] = useState(currentRankIndex);
  const highlightedRank = RANKS[highlightRankIndex] ?? rank;
  const highlightedAccentColor = getAccentColor(highlightedRank.id);

  const getTrackWidth = useCallback(() => {
    const track = rankTrackRef.current;
    if (!track) return 0;

    return track.clientWidth || track.getBoundingClientRect().width || window.innerWidth;
  }, []);

  const centerRank = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = rankTrackRef.current;
    const trackWidth = getTrackWidth();
    if (!track || !trackWidth) return;

    const nextScrollLeft = Math.max(0, Math.min(index, RANKS.length - 1) * trackWidth);
    if (Math.abs(track.scrollLeft - nextScrollLeft) < 1) return;

    if (behavior === "auto") {
      track.scrollLeft = nextScrollLeft;
      return;
    }

    try {
      track.scrollTo({ left: nextScrollLeft, behavior });
    } catch {
      track.scrollLeft = nextScrollLeft;
    }
  }, [getTrackWidth]);

  const getNearestRankIndex = useCallback(() => {
    const trackWidth = getTrackWidth();
    const track = rankTrackRef.current;
    if (!track || !trackWidth) return -1;

    return Math.max(0, Math.min(RANKS.length - 1, Math.round(track.scrollLeft / trackWidth)));
  }, [getTrackWidth]);

  const updateHighlight = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= RANKS.length || activeRankIndexRef.current === nextIndex) return;

    activeRankIndexRef.current = nextIndex;
    setHighlightRankIndex(nextIndex);

    if (initializedRef.current) {
      vibrate("tap");
      playSoundEffect("rank-highlight");
    }
  }, []);

  const settleRank = useCallback(() => {
    const nearestIndex = getNearestRankIndex();
    if (nearestIndex < 0) return;

    updateHighlight(nearestIndex);
    centerRank(nearestIndex, "smooth");
  }, [centerRank, getNearestRankIndex, updateHighlight]);

  const moveHighlight = useCallback((direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(RANKS.length - 1, activeRankIndexRef.current + direction));
    updateHighlight(nextIndex);
    centerRank(nextIndex, "smooth");
  }, [centerRank, updateHighlight]);

  useEffect(() => {
    if (isOpen) {
      hasBeenOpenedRef.current = true;
      pointerDragRef.current = null;

      let openFrame: number | null = null;
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
        setPhase("opening");
        setIsDragging(false);
        openFrame = window.requestAnimationFrame(() => setPhase("open"));
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (openFrame !== null) window.cancelAnimationFrame(openFrame);
      };
    }

    if (!hasBeenOpenedRef.current) return;

    const closeFrame = window.requestAnimationFrame(() => setPhase("closing"));
    const closeTimer = window.setTimeout(() => {
      setMounted(false);
      hasBeenOpenedRef.current = false;
      pointerDragRef.current = null;
      setIsDragging(false);
    }, RANK_DETAILS_CLOSE_DURATION);

    return () => {
      window.cancelAnimationFrame(closeFrame);
      window.clearTimeout(closeTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    initializedRef.current = false;
    activeRankIndexRef.current = currentRankIndex;

    const frame = window.requestAnimationFrame(() => {
      setHighlightRankIndex(currentRankIndex);
      centerRank(currentRankIndex, "auto");
      initializedRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [centerRank, currentRankIndex, isOpen, mounted]);

  useEffect(() => {
    const track = rankTrackRef.current;
    if (!track || !isOpen || !mounted) return;

    const handleScroll = () => {
      updateHighlight(getNearestRankIndex());
    };
    const handleResize = () => {
      centerRank(activeRankIndexRef.current, "auto");
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      track.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [centerRank, getNearestRankIndex, isOpen, mounted, updateHighlight]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveHighlight(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveHighlight(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, moveHighlight, onClose]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const track = rankTrackRef.current;
    if (!track) return;

    event.preventDefault();
    track.style.scrollBehavior = "auto";

    pointerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
      moved: false,
    };
    setIsDragging(true);

    if (typeof track.setPointerCapture === "function") {
      track.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current;
    const track = rankTrackRef.current;
    if (!drag || !track || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) >= 6) drag.moved = true;
    if (!drag.moved) return;

    event.preventDefault();
    const trackWidth = getTrackWidth();
    const measuredMaxScrollLeft = track.scrollWidth - track.clientWidth;
    const maxScrollLeft = Math.max(
      0,
      measuredMaxScrollLeft > 0
        ? measuredMaxScrollLeft
        : trackWidth * RANKS.length - track.clientWidth,
    );
    track.scrollLeft = Math.max(0, Math.min(maxScrollLeft, drag.startScrollLeft - deltaX));
    updateHighlight(getNearestRankIndex());
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current;
    const track = rankTrackRef.current;
    if (!drag || !track || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    pointerDragRef.current = null;
    setIsDragging(false);
    track.style.scrollBehavior = "smooth";

    if (typeof track.releasePointerCapture === "function" && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) >= RANK_DETAILS_SWIPE_THRESHOLD) {
      const trackWidth = getTrackWidth();
      const startIndex = trackWidth > 0
        ? Math.round(drag.startScrollLeft / trackWidth)
        : activeRankIndexRef.current;
      const nextIndex = Math.max(0, Math.min(RANKS.length - 1, startIndex + (deltaX < 0 ? 1 : -1)));
      updateHighlight(nextIndex);
      centerRank(nextIndex, "smooth");
      return;
    }

    if (drag.moved) {
      const nextIndex = getNearestRankIndex();
      updateHighlight(nextIndex);
      centerRank(nextIndex, "smooth");
      return;
    }

    settleRank();
  }

  function handlePointerCancel() {
    if (!pointerDragRef.current) return;
    const track = rankTrackRef.current;
    pointerDragRef.current = null;
    setIsDragging(false);
    if (track) track.style.scrollBehavior = "smooth";
    settleRank();
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("home.mobile.rankInfoTitle")}
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "fixed inset-0 z-[70] isolate overflow-hidden bg-black text-white lg:hidden",
        phase === "opening" && "rank-details-overlay-enter",
        phase === "closing" && "rank-details-overlay-exit pointer-events-none",
      )}
      data-rank-details-overlay
      data-rank-details-phase={phase}
    >
      <div className="pointer-events-none absolute inset-0 bg-black" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        data-rank-details-gradient
        style={{
          backgroundImage: `linear-gradient(to top, ${hexToRgba(highlightedAccentColor, 0.82)} 0%, ${hexToRgba(highlightedAccentColor, 0.34)} 25%, transparent 70%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 48%, ${hexToRgba(highlightedAccentColor, 0.14)} 0%, transparent 42%)`,
        }}
      />

      <div
        ref={rankTrackRef}
        className={cn(
          "absolute inset-0 z-10 flex w-full overflow-x-auto overscroll-x-none select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
        data-mobile-rank-scroll
        data-mobile-rank-carousel
        data-mobile-rank-dragging={isDragging ? "true" : "false"}
        aria-label={t("home.mobile.rankInfoTitle")}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerCancel}
      >
        <div className="flex h-full w-max">
          {RANKS.map((item, index) => {
            const isHighlighted = index === highlightRankIndex;
            const achieved = item.minPoints <= totalPoints;
            const isLocked = index > currentRankIndex;
            const progressToRank = item.minPoints > 0
              ? Math.min(100, Math.max(0, (totalPoints / item.minPoints) * 100))
              : 0;

            return (
              <article
                key={item.id}
                data-rank-index={index}
                data-current-rank={item.id === rank.id ? "true" : undefined}
                data-highlighted={isHighlighted ? "true" : "false"}
                className="relative h-full w-screen shrink-0"
              >
                <div
                  className={cn(
                    "absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center transition-transform duration-500 ease-[cubic-bezier(0.85,0,0.15,1)]",
                    isHighlighted ? "scale-100" : "scale-[0.76]",
                  )}
                  data-rank-visual
                >
                  <div className={cn("flex flex-col items-center", isLocked && "translate-y-6")}>
                    <p
                      data-rank-label={item.id}
                      data-mobile-current-rank-label={isHighlighted ? true : undefined}
                      className={cn(
                        "mb-4 max-w-[calc(100vw-2rem)] text-[clamp(2rem,11vw,3.5rem)] font-bold leading-none",
                        canUseSuperWater(locale) && "font-super-water",
                      )}
                      style={{ color: getAccentColor(item.id) }}
                    >
                      {formatSuperWaterText(locale, getRankLabel(item, locale))}
                    </p>

                    <div className="relative size-64">
                      {!isLocked ? (
                        <div
                          className={cn(
                            "relative z-10 size-full transition-opacity duration-300",
                            isHighlighted ? "opacity-100" : "opacity-35",
                          )}
                        >
                          <RankIcon icon={item.icon} className="size-full" sizes="256px" />
                        </div>
                      ) : null}
                      {isLocked ? (
                        <Image
                          src="/missions/mission-lock-icon-v3.png"
                          alt=""
                          width={512}
                          height={512}
                          sizes="256px"
                          unoptimized
                          className="absolute inset-0 z-20 size-full object-contain"
                          aria-hidden="true"
                          draggable={false}
                          data-rank-lock="true"
                        />
                      ) : null}
                    </div>

                    <p
                      className={cn(
                        "mt-4 inline-flex items-center gap-2 text-2xl font-semibold leading-none text-white/90",
                        canUseSuperWater(locale) && "font-super-water",
                      )}
                      data-rank-requirement={item.id}
                    >
                      {formatNumber(locale, item.minPoints)}
                      <ScoreIcon size={27} className={cn("size-7", !achieved && "grayscale opacity-60")} />
                    </p>
                  </div>

                  {isLocked ? (
                    <div
                      role="progressbar"
                      aria-label={getRankLabel(item, locale)}
                      aria-valuemin={0}
                      aria-valuemax={item.minPoints}
                      aria-valuenow={Math.min(totalPoints, item.minPoints)}
                      className="mt-8 translate-y-6 flex w-52 flex-col items-center"
                      data-rank-progress={item.id}
                    >
                      <span
                        className={cn(
                          "mb-2 text-lg font-semibold leading-none text-white",
                          canUseSuperWater(locale) && "font-super-water",
                        )}
                        data-rank-progress-percent={item.id}
                      >
                        {formatNumber(locale, Math.round(progressToRank))}%
                      </span>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.85,0,0.15,1)]"
                          style={{
                            width: `${progressToRank}%`,
                            backgroundColor: lightenHex(getAccentColor(item.id), 0.24),
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-start px-6 pt-[max(1.75rem,env(safe-area-inset-top)+1rem)] text-left">
        <p
          className={cn(
            "text-[clamp(1.5rem,7vw,2.4rem)] font-bold leading-none text-white",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterText(locale, t("home.mobile.rankInfoTitle"))}
        </p>
        <span
          data-mobile-rank-total-points
          className={cn(
            "mt-3 inline-flex items-center gap-2 text-[clamp(1.3rem,6vw,1.8rem)] font-semibold leading-none text-white",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatNumber(locale, totalPoints)}
          <ScoreIcon size={25} className="size-6" />
        </span>
      </header>

      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-50 inline-flex size-12 items-center justify-center text-white transition-transform duration-200 active:scale-90"
        data-rank-details-close
      >
        <X className="size-9 stroke-[3]" aria-hidden="true" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom)+1rem)] z-30 flex justify-center px-6">
        <p
          className={cn(
            "text-xl font-semibold text-white/75",
            canUseSuperWater(locale) && "font-super-water",
          )}
          aria-live="polite"
          data-rank-details-position
        >
          {formatNumber(locale, highlightRankIndex + 1)} / {formatNumber(locale, RANKS.length)}
        </p>
      </div>
    </div>,
    document.body,
  );
}
