"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type Ref } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import {
  acknowledgeRankUp,
  isQuizRankUpDeferred,
  readLastAcknowledgedRank,
} from "@/features/progress/rank-up-flow";
import { isTutorialVisibleState, useTutorialStore } from "@/features/tutorial/tutorial-store";
import { formatNumber, formatPoints, getRankLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import type { ProgressStats, RankDefinition } from "@/types/domain";

const SCORE_GAIN_ANIMATION_MS = 700;
const RANK_UP_TEST_PARAM = "rank-up-test";
const RANK_UP_TEST_DELAY_MS = 1000;
const RANK_UP_TEST_REPEAT_DELAY_MS = 2000;
const RANK_UP_REVEAL_DELAY_MS = 3000;
const RANK_UP_CLOSE_ANIMATION_MS = 360;

export function RankProgressPopover({
  stats,
  userId,
  hideTrigger = false,
  navbar = false,
  forceRankUpRank,
}: {
  stats: ProgressStats;
  userId?: string;
  hideTrigger?: boolean;
  navbar?: boolean;
  forceRankUpRank?: RankDefinition;
}) {
  const [open, setOpen] = useState(false);
  const [forcedRankUpOpen, setForcedRankUpOpen] = useState(Boolean(forceRankUpRank));
  const rootRef = useRef<HTMLDivElement>(null);
  const { displayStats, scoreGain, rankUpRank, rankUpPreviousRank, dismissRankUp } = useAnimatedScoreDisplay(stats, userId);
  const tutorialVisible = useTutorialStore(isTutorialVisibleState);
  const pendingRankUp = forceRankUpRank ? (forcedRankUpOpen ? forceRankUpRank : null) : rankUpRank;
  const visibleRankUp = tutorialVisible ? null : pendingRankUp;
  const { locale } = useLocale();
  const t = useT();

  useEffect(() => {
    setForcedRankUpOpen(Boolean(forceRankUpRank));
  }, [forceRankUpRank]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open || visibleRankUp) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open, visibleRankUp]);

  return (
    <div ref={rootRef} className="relative block">
      {hideTrigger ? null : (
        <button
          type="button"
          aria-label={t("rank.showProgress")}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-2 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-background-muted min-[390px]:gap-2 min-[390px]:px-3 sm:h-auto sm:py-1.5",
            navbar && "border-white/15 bg-white/5 text-white hover:bg-white/10",
            open && "border-border bg-background-card ring-2 ring-border",
            navbar && open && "border-white/15 bg-white/10 ring-white/20",
          )}
        >
          <RankIcon icon={displayStats.rank.icon} className={cn("size-4", getRankIconTone(displayStats.rank.icon))} />
          <span className={cn("hidden min-[390px]:inline", navbar && "text-white")}>{getRankLabel(displayStats.rank, locale)}</span>
          <span className={cn("hidden text-foreground-muted min-[390px]:inline", navbar && "text-white/45")}>/</span>
          <span className="relative inline-flex min-w-4 justify-start min-[390px]:min-w-10">
            {scoreGain > 0 ? (
              <span
                key={scoreGain}
                aria-live="polite"
                className="rank-score-gain absolute left-1/2 whitespace-nowrap text-[11px] font-bold text-[var(--score-start)]"
              >
                +{formatNumber(locale, scoreGain)}
              </span>
            ) : null}
            <span className={cn("min-[390px]:hidden", navbar && "text-white")}>{formatNumber(locale, displayStats.totalPoints)}</span>
            <span className={cn("hidden min-[390px]:inline", navbar && "text-white")}>{formatPoints(locale, displayStats.totalPoints)}</span>
          </span>
        </button>
      )}

      {visibleRankUp ? (
        <RankUpMenu
          rank={visibleRankUp}
          fromRank={rankUpPreviousRank ?? getPreviousRank(visibleRankUp)}
          onClose={forceRankUpRank ? () => setForcedRankUpOpen(false) : dismissRankUp}
        />
      ) : open ? (
        <RankLadderDialog stats={stats} onClose={() => setOpen(false)} />
      ) : null}
    </div>
  );
}

function RankLadderDialog({ stats, onClose }: { stats: ProgressStats; onClose: () => void }) {
  const { locale } = useLocale();
  const t = useT();
  const currentRankRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    currentRankRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-label={t("rank.progress")}
      className="fixed inset-0 z-50 flex flex-col"
    >
      <div className="absolute inset-0 z-0 bg-black/80" onClick={onClose} aria-hidden="true" />

      <div className="pointer-events-none relative z-10 flex min-h-0 flex-1 items-center justify-center p-0 md:p-4">
        <div
          className="animate-menu-pop origin-center pointer-events-auto relative z-10 flex max-h-full w-full flex-col bg-background-card md:max-h-[90vh] md:max-w-[90vw] md:rounded-2xl md:shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-background-card px-4 py-4 md:px-8 md:py-6">
            <div className="flex items-center gap-4">
              <div className="relative hidden h-16 w-16 shrink-0 md:block">
                <Image
                  src="/mascots/mascot9.webp"
                  alt=""
                  fill
                  sizes="64px"
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground md:text-2xl">
                  {getRankLabel(stats.rank, locale)}
                </p>
                <p className="mt-1 text-sm text-foreground-muted md:text-base">
                  {stats.nextRank
                    ? t("rank.next", {
                        rank: getRankLabel(stats.nextRank, locale),
                        points: formatNumber(locale, stats.pointsToNextRank),
                      })
                    : t("rank.completed")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 text-sm font-bold text-[var(--score-start)] md:px-4 md:py-1.5 md:text-base">
                {formatPoints(locale, stats.totalPoints)}
              </div>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={onClose}
                className="inline-flex size-9 items-center justify-center rounded-full bg-background-muted text-foreground-secondary transition-colors hover:bg-border hover:text-foreground md:size-10"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
            <ol className="relative hidden grid-cols-10 gap-2 md:grid">
              <div
                className="absolute left-14 right-14 top-14 h-2 rounded-full bg-border"
                aria-hidden="true"
              />
              <div
                className="absolute left-14 top-14 h-2 rounded-full bg-background-inverse"
                style={{
                  width: `calc((100% - 7rem) * ${getTotalRankProgress(stats.totalPoints) / 100})`,
                }}
                aria-hidden="true"
              />
              {RANKS.map((rank) => (
                <RankStepDesktop
                  key={rank.id}
                  rank={rank}
                  currentRankId={stats.rank.id}
                  points={stats.totalPoints}
                />
              ))}
            </ol>

            <ol className="space-y-8 md:hidden">
              {RANKS.map((rank) => (
                <RankStepMobile
                  key={rank.id}
                  rank={rank}
                  currentRankId={stats.rank.id}
                  points={stats.totalPoints}
                  ref={rank.id === stats.rank.id ? currentRankRef : undefined}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function useAnimatedScoreDisplay(stats: ProgressStats, userId?: string) {
  const [displayStats, setDisplayStats] = useState(stats);
  const [scoreGain, setScoreGain] = useState(0);
  const [rankUpRank, setRankUpRank] = useState<RankDefinition | null>(null);
  const [rankUpPreviousRank, setRankUpPreviousRank] = useState<RankDefinition | null>(null);
  const rankUpTestRepeatTimerRef = useRef<number | null>(null);
  const displayStatsRef = useRef(stats);
  const hasInitializedRank = useRef(false);
  const forceRankUpTestMode = useRankUpTestMode();

  // On first meaningful render, ensure the current rank is considered acknowledged
  // so a refresh does not replay an old rank-up celebration.
  useEffect(() => {
    if (hasInitializedRank.current) return;
    hasInitializedRank.current = true;

    const lastAcknowledged = readLastAcknowledgedRank(userId);
    if (lastAcknowledged === null) {
      acknowledgeRankUp(userId, stats.rank.id);
    }
  }, [stats.rank.id, userId]);

  useEffect(() => {
    return () => {
      if (rankUpTestRepeatTimerRef.current !== null) {
        window.clearTimeout(rankUpTestRepeatTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!forceRankUpTestMode) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRankUpRank(stats.rank);
    }, RANK_UP_TEST_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [forceRankUpTestMode, stats.rank]);

  useEffect(() => {
    const previousStats = displayStatsRef.current;
    const gainedPoints = stats.totalPoints - previousStats.totalPoints;
    const didRankUp = stats.rank.minPoints > previousStats.rank.minPoints;

    if (gainedPoints === 0) {
      displayStatsRef.current = stats;
      return;
    }

    if (gainedPoints < 0) {
      const resetTimer = window.setTimeout(() => {
        displayStatsRef.current = stats;
        setDisplayStats(stats);
        setScoreGain(0);
        setRankUpRank(null);
        setRankUpPreviousRank(null);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    const startTimer = window.setTimeout(() => {
      setScoreGain(gainedPoints);
    }, 0);
    const finishTimer = window.setTimeout(() => {
      displayStatsRef.current = stats;
      setDisplayStats(stats);
      setScoreGain(0);

      if (didRankUp) {
        if (isQuizRankUpDeferred()) {
          return;
        }

        const lastAcknowledged = readLastAcknowledgedRank(userId);
        if (lastAcknowledged !== stats.rank.id) {
          sendTwaAnalyticsEvent("fd_rank_up", {
            params: {
              rank_id: stats.rank.id,
              rank_icon: stats.rank.icon,
              total_points: stats.totalPoints,
              rank_min_points: stats.rank.minPoints,
            },
          });
          setRankUpPreviousRank(previousStats.rank);
          setRankUpRank(stats.rank);
          acknowledgeRankUp(userId, stats.rank.id);
        }
      }
    }, SCORE_GAIN_ANIMATION_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(finishTimer);
    };
  }, [stats, userId]);

  return {
    displayStats,
    scoreGain,
    rankUpRank,
    rankUpPreviousRank,
    dismissRankUp: () => {
      setRankUpRank(null);
      setRankUpPreviousRank(null);

      if (!forceRankUpTestMode) {
        return;
      }

      if (rankUpTestRepeatTimerRef.current !== null) {
        window.clearTimeout(rankUpTestRepeatTimerRef.current);
      }

      rankUpTestRepeatTimerRef.current = window.setTimeout(() => {
      rankUpTestRepeatTimerRef.current = null;
        setRankUpRank(stats.rank);
      }, RANK_UP_TEST_REPEAT_DELAY_MS);
    },
  };
}

export function RankUpMenu({
  rank,
  fromRank,
  onClose,
}: {
  rank: RankDefinition;
  fromRank?: RankDefinition;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const usesSuperWater = canUseSuperWater(locale);
  const continueLabel = t("auth.onboarding.continue");
  const previousRank = fromRank ?? getPreviousRank(rank);
  const [revealed, setRevealed] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  function handleClose() {
    if (closing) {
      return;
    }

    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, RANK_UP_CLOSE_ANIMATION_MS);
  }

  useEffect(() => {
    playSoundEffect("rank-up-opening");

    const timer = window.setTimeout(() => {
      playSoundEffect("rank-up-reveal");
      setRevealed(true);
    }, RANK_UP_REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [rank.id]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-label={t("rank.up")}
      className={cn("rank-up-menu fixed inset-0 z-50 flex bg-black", closing && "rank-up-menu--closing")}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-0 overflow-hidden transition-opacity duration-700 ease-out",
          revealed ? "opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      >
        <Image
          src="/rank-up/rank-up-background-v1.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>
      <RankUpConfetti revealed={revealed} />
      <div
        className="relative z-10 flex min-h-full w-full items-stretch justify-center lg:items-start lg:justify-end lg:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            handleClose();
          }
        }}
      >
        <div className="relative flex h-full w-full flex-col bg-transparent px-6 pb-[calc(env(safe-area-inset-bottom)+56px)] pt-[calc(env(safe-area-inset-top)+24px)] lg:h-auto lg:w-[min(92vw,420px)] lg:rounded-lg lg:border lg:border-border/70 lg:bg-background/96 lg:px-6 lg:pb-6 lg:pt-6">
          <button
            type="button"
            aria-label={t("rank.closeUp")}
            onClick={handleClose}
            className={cn(
              "absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] inline-flex size-10 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground",
              "rank-up-close-control",
              revealed && "rank-up-close-control--visible",
              "lg:top-4",
            )}
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className={cn("rank-up-sequence-item rank-up-sequence-title w-full", revealed && "rank-up-sequence-item--visible")}>
              <ConvexRankTitle
                text={usesSuperWater ? formatSuperWaterText(locale, t("rank.up")) : t("rank.up")}
                accessibleText={t("rank.up")}
                usesSuperWater={usesSuperWater}
              />
            </div>
            <div className="relative mt-8 size-44 shrink-0 sm:size-48 lg:size-40">
              <div className={cn("absolute inset-0 flex items-center justify-center rank-up-old-rank", revealed && "rank-up-old-rank--exit")}>
                <RankIcon icon={previousRank.icon} className={cn("size-full", getRankIconTone(previousRank.icon))} sizes="224px" />
              </div>
              <div className={cn("absolute inset-0 flex items-center justify-center rank-up-new-rank", revealed && "rank-up-new-rank--visible")}>
                <RankIcon icon={rank.icon} className={cn("size-full", getRankIconTone(rank.icon))} sizes="224px" />
              </div>
            </div>
            <p className={cn("rank-up-sequence-item rank-up-sequence-name mt-6 text-4xl font-bold text-foreground sm:text-5xl", revealed && "rank-up-sequence-item--visible", usesSuperWater && "font-super-water")}>
              {usesSuperWater ? (
                <>
                  <span className="sr-only">{getRankLabel(rank, locale)}</span>
                  <span aria-hidden="true">{formatSuperWaterText(locale, getRankLabel(rank, locale))}</span>
                </>
              ) : (
                getRankLabel(rank, locale)
              )}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "rank-up-sequence-item rank-up-sequence-action relative isolate mt-8 inline-flex h-16 w-[12.38rem] shrink-0 items-center justify-center overflow-hidden rounded-full border border-transparent px-4 text-center text-2xl font-semibold text-white transition-[filter,transform] hover:brightness-105 active:scale-[0.98]",
                revealed && "rank-up-sequence-item--visible",
                usesSuperWater && "font-super-water",
              )}
              style={{ aspectRatio: "1000 / 323" }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0">
                <Image
                  src="/pricing-buttons/pricing-active-button-v2.png"
                  alt=""
                  fill
                  sizes="(max-width: 1023px) calc(100vw - 3rem), 420px"
                  className="object-fill"
                />
              </span>
              <span className="relative z-10">{formatSuperWaterText(locale, continueLabel)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const RANK_UP_CONFETTI = [
  { x: "-40vw", y: "58vh", rotate: "-430deg", delay: "0ms", size: "0.7rem", color: "#ffd43b" },
  { x: "-32vw", y: "76vh", rotate: "320deg", delay: "35ms", size: "0.46rem", color: "#ffffff" },
  { x: "-25vw", y: "48vh", rotate: "-260deg", delay: "80ms", size: "0.58rem", color: "#fff3a6" },
  { x: "-19vw", y: "88vh", rotate: "390deg", delay: "120ms", size: "0.8rem", color: "#f8c531" },
  { x: "-14vw", y: "64vh", rotate: "-520deg", delay: "165ms", size: "0.52rem", color: "#ffffff" },
  { x: "-10vw", y: "40vh", rotate: "280deg", delay: "220ms", size: "0.72rem", color: "#ffd43b" },
  { x: "-7vw", y: "96vh", rotate: "-350deg", delay: "70ms", size: "0.44rem", color: "#ffffff" },
  { x: "-4vw", y: "72vh", rotate: "480deg", delay: "250ms", size: "0.6rem", color: "#fff3a6" },
  { x: "-2vw", y: "52vh", rotate: "-300deg", delay: "105ms", size: "0.82rem", color: "#f8c531" },
  { x: "3vw", y: "62vh", rotate: "410deg", delay: "45ms", size: "0.5rem", color: "#ffffff" },
  { x: "6vw", y: "92vh", rotate: "-460deg", delay: "185ms", size: "0.68rem", color: "#ffd43b" },
  { x: "9vw", y: "44vh", rotate: "290deg", delay: "95ms", size: "0.44rem", color: "#fff3a6" },
  { x: "13vw", y: "74vh", rotate: "-380deg", delay: "140ms", size: "0.78rem", color: "#ffffff" },
  { x: "17vw", y: "52vh", rotate: "500deg", delay: "20ms", size: "0.54rem", color: "#f8c531" },
  { x: "21vw", y: "84vh", rotate: "-300deg", delay: "230ms", size: "0.68rem", color: "#ffd43b" },
  { x: "26vw", y: "62vh", rotate: "430deg", delay: "60ms", size: "0.48rem", color: "#ffffff" },
  { x: "31vw", y: "94vh", rotate: "-520deg", delay: "155ms", size: "0.76rem", color: "#fff3a6" },
  { x: "39vw", y: "70vh", rotate: "340deg", delay: "100ms", size: "0.52rem", color: "#f8c531" },
  { x: "-47vw", y: "82vh", rotate: "-620deg", delay: "45ms", size: "0.92rem", color: "#ffffff" },
  { x: "-43vw", y: "38vh", rotate: "360deg", delay: "190ms", size: "0.64rem", color: "#ffd43b" },
  { x: "-36vw", y: "98vh", rotate: "-470deg", delay: "270ms", size: "0.5rem", color: "#fff8cc" },
  { x: "-29vw", y: "56vh", rotate: "540deg", delay: "125ms", size: "0.86rem", color: "#f8c531" },
  { x: "-23vw", y: "90vh", rotate: "-330deg", delay: "210ms", size: "0.62rem", color: "#ffffff" },
  { x: "-17vw", y: "46vh", rotate: "450deg", delay: "15ms", size: "0.94rem", color: "#ffd43b" },
  { x: "-11vw", y: "82vh", rotate: "-580deg", delay: "175ms", size: "0.56rem", color: "#fff8cc" },
  { x: "-6vw", y: "100vh", rotate: "390deg", delay: "300ms", size: "0.9rem", color: "#ffffff" },
  { x: "7vw", y: "48vh", rotate: "-410deg", delay: "115ms", size: "0.9rem", color: "#ffd43b" },
  { x: "12vw", y: "100vh", rotate: "570deg", delay: "280ms", size: "0.58rem", color: "#fff8cc" },
  { x: "18vw", y: "42vh", rotate: "-490deg", delay: "30ms", size: "0.96rem", color: "#ffffff" },
  { x: "24vw", y: "96vh", rotate: "350deg", delay: "200ms", size: "0.62rem", color: "#ffd43b" },
  { x: "29vw", y: "54vh", rotate: "-560deg", delay: "135ms", size: "0.88rem", color: "#fff8cc" },
  { x: "36vw", y: "86vh", rotate: "430deg", delay: "260ms", size: "0.52rem", color: "#ffffff" },
  { x: "46vw", y: "46vh", rotate: "-390deg", delay: "85ms", size: "0.82rem", color: "#ffd43b" },
] as const;

function RankUpConfetti({ revealed }: { revealed: boolean }) {
  return (
    <div className={cn("rank-up-confetti", revealed && "rank-up-confetti--visible")} aria-hidden="true">
      {RANK_UP_CONFETTI.map((piece, index) => (
        <span
          key={index}
          className="rank-up-confetti-piece"
          style={
            {
              "--confetti-x": piece.x,
              "--confetti-y": piece.y,
              "--confetti-rotate": piece.rotate,
              "--confetti-delay": piece.delay,
              "--confetti-size": piece.size,
              "--confetti-color": piece.color,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function getPreviousRank(rank: RankDefinition) {
  const rankIndex = RANKS.findIndex((candidate) => candidate.id === rank.id);
  return rankIndex > 0 ? RANKS[rankIndex - 1] : rank;
}

function ConvexRankTitle({
  text,
  accessibleText,
  usesSuperWater,
}: {
  text: string;
  accessibleText: string;
  usesSuperWater: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const curveId = `${id}-rank-up-curve`;

  return (
    <div className="relative w-full max-w-[22rem]" style={{ aspectRatio: "1325 / 395" }}>
      <Image
        src="/rank-up/kurdele-v1.png"
        alt=""
        fill
        sizes="(max-width: 640px) calc(100vw - 3rem), 352px"
        className="pointer-events-none object-contain"
        priority
      />
      <svg
        role="heading"
        aria-level={2}
        aria-label={accessibleText}
        viewBox="0 0 360 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full overflow-visible"
      >
        <defs>
          <path id={curveId} d="M 18 76 Q 180 14 342 76" fill="none" />
        </defs>
        <text
          aria-hidden="true"
          className={cn("font-display", usesSuperWater && "font-super-water")}
          fill="#ffffff"
          fontSize="32"
          fontWeight="700"
          textAnchor="middle"
          transform="translate(0 -4)"
        >
          <textPath
            href={`#${curveId}`}
            startOffset="50%"
            textAnchor="middle"
            textLength="232"
            lengthAdjust="spacingAndGlyphs"
          >
            {text}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

function useRankUpTestMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const value = params.get(RANK_UP_TEST_PARAM);
    setEnabled(value === "1" || value === "true");
  }, []);

  return enabled;
}

function RankStepDesktop({
  rank,
  currentRankId,
  points,
}: {
  rank: RankDefinition;
  currentRankId: string;
  points: number;
}) {
  const { locale } = useLocale();
  const achieved = points >= rank.minPoints;
  const current = rank.id === currentRankId;
  const label = getRankLabel(rank, locale);

  return (
    <li className="relative z-10 flex min-w-0 flex-col items-center text-center">
      <div
        className={cn(
          "flex size-20 items-center justify-center rounded-full border bg-background-card shadow-sm md:size-24 lg:size-28",
          achieved ? "border-foreground text-foreground" : "border-border text-foreground-muted",
          current && "border-brand ring-4 ring-brand ring-offset-4",
        )}
        title={`${label}: ${formatPoints(locale, rank.minPoints)}`}
      >
        <RankIcon
          icon={rank.icon}
          className={cn("size-12 md:size-14 lg:size-16", achieved && getRankIconTone(rank.icon))}
          sizes="(max-width: 1024px) 80px, 128px"
        />
        <span className="sr-only">{label}</span>
      </div>
      <p
        className={cn(
          "mt-4 text-sm font-semibold leading-4 md:text-base",
          current ? "text-brand" : "text-foreground-muted",
        )}
      >
        {label}
      </p>
      <p className={cn("mt-1 text-sm font-semibold md:text-base", current ? "text-[var(--score-end)]" : "text-foreground-muted")}>
        {formatNumber(locale, rank.minPoints)}
      </p>
    </li>
  );
}

function RankStepMobile({
  rank,
  currentRankId,
  points,
  ref,
}: {
  rank: RankDefinition;
  currentRankId: string;
  points: number;
  ref?: Ref<HTMLLIElement>;
}) {
  const { locale } = useLocale();
  const achieved = points >= rank.minPoints;
  const current = rank.id === currentRankId;
  const label = getRankLabel(rank, locale);

  return (
    <li ref={ref} className={cn("flex items-center gap-5", current && "rounded-2xl bg-brand p-4 text-brand-foreground")}>
      <div
        className={cn(
          "relative flex size-24 shrink-0 items-center justify-center rounded-full border bg-background-card shadow-sm",
          achieved ? "border-foreground text-foreground" : "border-border text-foreground-muted",
          current && "border-brand bg-transparent shadow-none ring-0",
        )}
      >
        <RankIcon
          icon={rank.icon}
          className={cn("size-16", achieved && getRankIconTone(rank.icon))}
          sizes="96px"
        />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-lg font-semibold",
            current ? "text-brand-foreground" : "text-foreground",
          )}
        >
          {label}
        </p>
        <p className={cn("text-base font-semibold", current ? "text-white" : "text-foreground-muted")}>
          {formatNumber(locale, rank.minPoints)} puan
        </p>

      </div>
    </li>
  );
}

function getTotalRankProgress(points: number) {
  const first = RANKS[0]!;
  const last = RANKS[RANKS.length - 1]!;
  const range = last.minPoints - first.minPoints;

  if (range <= 0) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round(((points - first.minPoints) / range) * 100)));
}
