"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import {
  acknowledgeRankUp,
  isQuizRankUpDeferred,
  readLastAcknowledgedRank,
} from "@/features/progress/rank-up-flow";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { formatNumber, formatPoints, getRankLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import type { ProgressStats, RankDefinition } from "@/types/domain";

const SCORE_GAIN_ANIMATION_MS = 700;
const RANK_UP_TEST_PARAM = "rank-up-test";

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
  const { displayStats, scoreGain, rankUpRank, dismissRankUp } = useAnimatedScoreDisplay(stats, userId);
  const tutorialVisible = useTutorialStore((state) => state.testMode || (state.active && !state.completed));
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
                className="rank-score-gain absolute left-1/2 whitespace-nowrap text-[11px] font-bold text-brand"
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
          points={displayStats.totalPoints}
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
              <div className="px-3 py-1 text-sm font-bold text-brand md:px-4 md:py-1.5 md:text-base">
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
    if (!forceRankUpTestMode) {
      return;
    }

    setRankUpRank(stats.rank);
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
          playSoundEffect("rank-up");
          sendTwaAnalyticsEvent("fd_rank_up", {
            params: {
              rank_id: stats.rank.id,
              rank_icon: stats.rank.icon,
              total_points: stats.totalPoints,
              rank_min_points: stats.rank.minPoints,
            },
          });
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
    dismissRankUp: () => setRankUpRank(null),
  };
}

export function RankUpMenu({
  rank,
  points,
  onClose,
}: {
  rank: RankDefinition;
  points: number;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  return createPortal(
    <div
      role="dialog"
      aria-label={t("rank.up")}
      className="rank-up-menu fixed inset-0 z-50 flex bg-background"
    >
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-0 h-1/2 overflow-hidden">
        <Image
          src="/rank-up-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.22)_38%,rgba(15,23,42,0.54)_100%)]"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/92 via-48% to-transparent" aria-hidden="true" />
      </div>

      <div
        className="relative z-10 flex min-h-full w-full items-stretch justify-center lg:items-start lg:justify-end lg:p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="relative flex h-full w-full flex-col bg-transparent px-6 pb-[calc(env(safe-area-inset-bottom)+56px)] pt-[calc(env(safe-area-inset-top)+24px)] lg:h-auto lg:w-[min(92vw,420px)] lg:rounded-lg lg:border lg:border-border/70 lg:bg-background/96 lg:px-6 lg:pb-6 lg:pt-6">
          <button
            type="button"
            aria-label={t("rank.closeUp")}
            onClick={onClose}
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] inline-flex size-10 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground lg:top-4"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <RankIcon icon={rank.icon} className={cn("size-44 sm:size-48 lg:size-40", getRankIconTone(rank.icon))} sizes="224px" />

            <p className="mt-7 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">{t("rank.up")}</p>
            <p className="mt-4 text-3xl font-bold text-foreground sm:text-4xl">{getRankLabel(rank, locale)}</p>
            <p className="mt-3 text-base font-semibold text-foreground-secondary">{t("rank.current")}</p>

            <div className="mt-7 flex w-full max-w-sm flex-col items-center px-4 py-3">
              <p className="text-xs font-semibold text-foreground-muted">{t("rank.totalPoints")}</p>
              <div data-rank-up-total-score className="mt-2 flex origin-center scale-125 items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-2xl font-bold text-transparent">
                <span>{formatNumber(locale, points)}</span>
                <ScoreIcon size={28} className="size-7" />
              </div>
            </div>
          </div>

          <div className="w-full shrink-0 lg:mt-6">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-sm font-semibold text-white transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
            >
              {t("auth.onboarding.continue")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
      <p className={cn("mt-1 text-sm font-semibold md:text-base", current ? "text-brand" : "text-foreground-muted")}>
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
        <p className={cn("text-base font-semibold", current ? "text-brand-foreground" : "text-foreground-muted")}>
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
