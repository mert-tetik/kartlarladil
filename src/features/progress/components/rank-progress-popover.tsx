"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import { formatNumber, formatPoints, getRankLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import type { ProgressStats, RankDefinition } from "@/types/domain";

const SCORE_GAIN_ANIMATION_MS = 700;

export function RankProgressPopover({ stats, userId }: { stats: ProgressStats; userId?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { displayStats, scoreGain, rankUpRank, dismissRankUp } = useAnimatedScoreDisplay(stats, userId);
  const { locale } = useLocale();
  const t = useT();

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
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative block">
      <button
        type="button"
        aria-label={t("rank.showProgress")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-full border border-border bg-background px-2 text-xs font-semibold text-foreground-secondary transition-colors hover:bg-background-muted min-[390px]:gap-2 min-[390px]:px-3 sm:h-auto sm:py-1.5",
          open && "border-border bg-background-card ring-2 ring-border",
        )}
      >
        <RankIcon icon={displayStats.rank.icon} className={cn("size-4", getRankIconTone(displayStats.rank.icon))} />
        <span className="hidden min-[390px]:inline">{getRankLabel(displayStats.rank, locale)}</span>
        <span className="hidden text-foreground-muted min-[390px]:inline">/</span>
        <span className="relative inline-flex min-w-4 justify-start min-[390px]:min-w-10">
          {scoreGain > 0 ? (
            <span
              key={scoreGain}
              aria-live="polite"
              className="rank-score-gain absolute left-1/2 whitespace-nowrap text-[11px] font-bold text-amber-500"
            >
              +{formatNumber(locale, scoreGain)}
            </span>
          ) : null}
          <span className="min-[390px]:hidden">{formatNumber(locale, displayStats.totalPoints)}</span>
          <span className="hidden min-[390px]:inline">{formatPoints(locale, displayStats.totalPoints)}</span>
        </span>
      </button>

      {rankUpRank ? (
        <RankUpMenu
          rank={rankUpRank}
          points={displayStats.totalPoints}
          onClose={dismissRankUp}
          onViewRanks={() => {
            dismissRankUp();
            setOpen(true);
          }}
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
                  src="/mascots/mascot9.png"
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

const LAST_RANK_STORAGE_KEY = "foxiesdeck:last-rank-id";

function getRankStorageKey(userId: string) {
  return `${LAST_RANK_STORAGE_KEY}:${userId}`;
}

function readLastAcknowledgedRank(userId: string | undefined): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return window.localStorage.getItem(getRankStorageKey(userId));
}

function writeLastAcknowledgedRank(userId: string | undefined, rankId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.localStorage.setItem(getRankStorageKey(userId), rankId);
}

function useAnimatedScoreDisplay(stats: ProgressStats, userId?: string) {
  const [displayStats, setDisplayStats] = useState(stats);
  const [scoreGain, setScoreGain] = useState(0);
  const [rankUpRank, setRankUpRank] = useState<RankDefinition | null>(null);
  const displayStatsRef = useRef(stats);
  const hasInitializedRank = useRef(false);

  // On first meaningful render, ensure the current rank is considered acknowledged
  // so a refresh does not replay an old rank-up celebration.
  useEffect(() => {
    if (hasInitializedRank.current) return;
    hasInitializedRank.current = true;

    const lastAcknowledged = readLastAcknowledgedRank(userId);
    if (lastAcknowledged === null) {
      writeLastAcknowledgedRank(userId, stats.rank.id);
    }
  }, [stats.rank.id, userId]);

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
        const lastAcknowledged = readLastAcknowledgedRank(userId);
        if (lastAcknowledged !== stats.rank.id) {
          playSoundEffect("rank-up");
          setRankUpRank(stats.rank);
          writeLastAcknowledgedRank(userId, stats.rank.id);
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

function RankUpMenu({
  rank,
  points,
  onClose,
  onViewRanks,
}: {
  rank: RankDefinition;
  points: number;
  onClose: () => void;
  onViewRanks: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();

  return (
    <div
      role="dialog"
      aria-label={t("rank.up")}
      className="rank-up-menu absolute right-0 top-11 z-50 max-lg:fixed max-lg:inset-0 max-lg:flex max-lg:h-screen max-lg:w-auto max-lg:items-center max-lg:justify-center max-lg:bg-black/60 max-lg:p-4"
    >
      <div className="relative w-[min(92vw,340px)] rounded-lg border border-amber-200 bg-background-card p-4 text-sm shadow-sm">
        <button
          type="button"
          aria-label={t("rank.closeUp")}
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
            <RankIcon icon={rank.icon} className={cn("size-6", getRankIconTone(rank.icon))} />
          </div>
          <div>
            <p className="font-semibold text-foreground">{t("rank.up")}</p>
            <p className="mt-1 text-xs font-semibold text-foreground-muted">{t("rank.current")}</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{getRankLabel(rank, locale)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-xs font-semibold text-foreground-muted">{t("rank.totalPoints")}</span>
          <span className="text-xs font-bold text-brand">{formatPoints(locale, points)}</span>
        </div>

        <button
          type="button"
          onClick={onViewRanks}
          className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-background-inverse px-3 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-background-inverse"
        >
          {t("rank.viewRanks")}
        </button>
      </div>
    </div>
  );
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
