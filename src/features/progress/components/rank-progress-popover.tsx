"use client";

import { useEffect, useRef, useState } from "react";
import { RANKS } from "@/features/progress/progress-stats";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import { cn } from "@/lib/utils";
import type { ProgressStats, RankDefinition } from "@/types/domain";

export function RankProgressPopover({ stats }: { stats: ProgressStats }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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
        <RankIcon icon={stats.rank.icon} className={cn("size-4", getRankIconTone(stats.rank.icon))} />
        <span>{stats.rank.label}</span>
        <span className="text-slate-400">/</span>
        <span>{stats.totalPoints.toLocaleString("tr-TR")} puan</span>
      </button>

      {open ? (
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
