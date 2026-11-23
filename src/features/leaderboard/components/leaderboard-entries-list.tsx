"use client";

import type { MouseEvent, Ref } from "react";
import { Loader2 } from "lucide-react";
import { SuperWaterText } from "@/components/super-water-text";
import {
  LeaderboardEntryRow,
  type LeaderboardEntryRowPresentation,
} from "@/features/leaderboard/components/leaderboard-entry-row";
import type {
  LeaderboardEntry,
  LeaderboardMode,
  LeaderboardPayload,
} from "@/features/leaderboard/leaderboard-types";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

export function LeaderboardEntriesList({
  data,
  mode,
  loading,
  error,
  entries,
  pulsePositionForUserIds,
  className,
  listRef,
  viewerRowRef,
  onAllow,
  rowPresentation = "standard",
}: {
  data: LeaderboardPayload | null;
  mode: LeaderboardMode;
  loading: boolean;
  error: string;
  entries?: readonly LeaderboardEntry[];
  pulsePositionForUserIds?: ReadonlySet<string>;
  className?: string;
  listRef?: Ref<HTMLDivElement>;
  viewerRowRef?: Ref<HTMLDivElement>;
  onAllow?: (event: MouseEvent<HTMLButtonElement>) => void;
  rowPresentation?: LeaderboardEntryRowPresentation;
}) {
  const { locale } = useLocale();
  const t = useT();
  const visibleEntries = entries ?? data?.entries ?? [];

  return (
    <div
      ref={listRef}
      data-leaderboard-list
      data-state={loading ? "loading" : "loaded"}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 max-lg:px-0 max-lg:py-1",
        className,
      )}
    >
      {loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-secondary">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium"><SuperWaterText>{t("common.loading")}</SuperWaterText></p>
        </div>
      ) : !data && error ? (
        <div className="h-full" aria-hidden="true" />
      ) : !data?.canViewLeaderboard ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="space-y-2">
            <p
              className={cn(
                "text-3xl font-semibold leading-tight text-foreground sm:text-4xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, t("leaderboard.lockedTitle"))}
            </p>
            <p
              className={cn(
                "text-lg font-medium leading-7 text-white sm:text-xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, t("leaderboard.lockedDescription"))}
            </p>
          </div>
          {onAllow ? (
            <button
              type="button"
              onClick={onAllow}
              className={cn(
                "inline-flex h-14 items-center justify-center rounded-full bg-black px-9 text-lg font-semibold text-white transition-colors hover:bg-black/85 sm:text-xl",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, t("leaderboard.allow"))}
            </button>
          ) : null}
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-foreground-secondary">
          {t("leaderboard.empty")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleEntries.map((entry) => (
            <LeaderboardEntryRow
              key={entry.userId}
              entry={entry}
              mode={mode}
              pulsePosition={pulsePositionForUserIds?.has(entry.userId) ?? false}
              viewerRowRef={entry.isViewer ? viewerRowRef : null}
              presentation={rowPresentation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
