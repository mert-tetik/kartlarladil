"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import { cn } from "@/lib/utils";
import type { ProgressStats, RankDefinition } from "@/types/domain";

const SCORE_GAIN_ANIMATION_MS = 700;

export function RankProgressPopover({ stats }: { stats: ProgressStats }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { displayStats, scoreGain, rankUpRank, dismissRankUp } = useAnimatedScoreDisplay(stats);

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

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-label="Rank ilerlemesini göster"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100",
          open && "border-slate-300 bg-white ring-2 ring-slate-200",
        )}
      >
        <RankIcon icon={displayStats.rank.icon} className={cn("size-4", getRankIconTone(displayStats.rank.icon))} />
        <span>{displayStats.rank.label}</span>
        <span className="text-slate-400">/</span>
        <span className="relative inline-flex min-w-10 justify-start">
          {scoreGain > 0 ? (
            <span
              key={scoreGain}
              aria-live="polite"
              className="rank-score-gain absolute left-1/2 whitespace-nowrap text-[11px] font-bold text-amber-500"
            >
              +{scoreGain.toLocaleString("tr-TR")}
            </span>
          ) : null}
          <span>{displayStats.totalPoints.toLocaleString("tr-TR")} puan</span>
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
        <div
          role="dialog"
          aria-label="Rank ilerlemesi"
          className="absolute right-0 top-11 z-50 w-[min(92vw,560px)] rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-950">{stats.rank.label}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {stats.nextRank
                  ? `${stats.nextRank.label} için ${stats.pointsToNextRank.toLocaleString("tr-TR")} puan kaldı`
                  : "En yüksek rank tamamlandı"}
              </p>
            </div>
            <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
              {stats.totalPoints.toLocaleString("tr-TR")} puan
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="relative min-w-[720px] px-2 pt-2">
              <div className="absolute left-8 right-8 top-8 h-1 rounded-full bg-slate-200" aria-hidden="true" />
              <div
                className="absolute left-8 top-8 h-1 rounded-full bg-slate-950"
                style={{ width: `calc((100% - 4rem) * ${getTotalRankProgress(stats.totalPoints) / 100})` }}
                aria-hidden="true"
              />
              <ol className="relative grid grid-cols-10 gap-2">
                {RANKS.map((rank) => (
                  <RankStep key={rank.id} rank={rank} currentRankId={stats.rank.id} points={stats.totalPoints} />
                ))}
              </ol>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useAnimatedScoreDisplay(stats: ProgressStats) {
  const [displayStats, setDisplayStats] = useState(stats);
  const [scoreGain, setScoreGain] = useState(0);
  const [rankUpRank, setRankUpRank] = useState<RankDefinition | null>(null);
  const displayStatsRef = useRef(stats);

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
        setRankUpRank(stats.rank);
      }
    }, SCORE_GAIN_ANIMATION_MS);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(finishTimer);
    };
  }, [stats]);

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
  return (
    <div
      role="dialog"
      aria-label="Rank atladın"
      className="rank-up-menu absolute right-0 top-11 z-50 w-[min(92vw,340px)] rounded-lg border border-amber-200 bg-white p-4 text-sm shadow-sm"
    >
      <button
        type="button"
        aria-label="Rank atlama menüsünü kapat"
        onClick={onClose}
        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
      >
        <X className="size-4" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
          <RankIcon icon={rank.icon} className={cn("size-6", getRankIconTone(rank.icon))} />
        </div>
        <div>
          <p className="font-semibold text-slate-950">Rank atladın</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Şu anki rankin</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{rank.label}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">Toplam puan</span>
        <span className="text-xs font-bold text-slate-950">{points.toLocaleString("tr-TR")} puan</span>
      </div>

      <button
        type="button"
        onClick={onViewRanks}
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
      >
        Rankleri gör
      </button>
    </div>
  );
}

function RankStep({
  rank,
  currentRankId,
  points,
}: {
  rank: RankDefinition;
  currentRankId: string;
  points: number;
}) {
  const achieved = points >= rank.minPoints;
  const current = rank.id === currentRankId;

  return (
    <li className="flex min-w-0 flex-col items-center text-center">
      <div
        className={cn(
          "relative z-10 flex size-12 items-center justify-center rounded-full border bg-white",
          achieved ? "border-slate-950 text-slate-950" : "border-slate-200 text-slate-400",
          current && "ring-2 ring-slate-950 ring-offset-2",
        )}
        title={`${rank.label}: ${rank.minPoints.toLocaleString("tr-TR")} puan`}
      >
        <RankIcon icon={rank.icon} className={cn("size-5", achieved && getRankIconTone(rank.icon))} />
        <span className="sr-only">{rank.label}</span>
      </div>
      <p className={cn("mt-3 text-[11px] font-semibold leading-4", current ? "text-slate-950" : "text-slate-500")}>
        {rank.label}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-400">{rank.minPoints.toLocaleString("tr-TR")}</p>
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
