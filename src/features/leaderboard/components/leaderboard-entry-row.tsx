"use client";

import Image from "next/image";
import type { CSSProperties, Ref } from "react";
import { Flame } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RankIcon } from "@/features/progress/rank-icons";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import { RANKS, RANK_ACCENT_COLORS } from "@/features/progress/progress-stats";
import type { LeaderboardEntry, LeaderboardMode } from "@/features/leaderboard/leaderboard-types";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { RESULT_MEDAL_IMAGE_SRC } from "@/features/progress/components/reward-medal-hud";

export type LeaderboardEntryRowPresentation = "standard" | "quiz-flow";

export function LeaderboardEntryRow({
  entry,
  mode,
  pulsePosition = false,
  viewerRowRef,
  presentation = "standard",
}: {
  entry: LeaderboardEntry;
  mode: LeaderboardMode;
  pulsePosition?: boolean;
  viewerRowRef?: Ref<HTMLDivElement>;
  presentation?: LeaderboardEntryRowPresentation;
}) {
  const { locale } = useLocale();
  const t = useT();
  const isQuizFlow = presentation === "quiz-flow";
  const rank = RANKS.find((candidate) => candidate.icon === entry.rankIcon) ?? RANKS[0];
  const rankColor = RANK_ACCENT_COLORS[rank.id as keyof typeof RANK_ACCENT_COLORS]
    ?? RANK_ACCENT_COLORS.baslangic;
  const viewerNameColor = entry.isViewer ? getContrastingRankTextClass(rankColor) : "text-white";
  const quizFlowRowColor = entry.isViewer
    ? rankColor
    : `color-mix(in srgb, color-mix(in hsl, ${rankColor} 35%, #808080) 55%, #222222)`;

  return (
    <div
      ref={viewerRowRef}
      data-leaderboard-entry={entry.isViewer ? "viewer" : "item"}
      data-leaderboard-entry-key={entry.userId}
      style={isQuizFlow ? {
        "--quiz-leaderboard-rank-color": rankColor,
        "--quiz-leaderboard-row-color": quizFlowRowColor,
      } as CSSProperties : undefined}
      className={cn(
        "grid items-center gap-2 rounded-lg border px-3 py-3 text-left",
        isQuizFlow
          ? "grid-cols-[auto_2.75rem_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_2.75rem_3rem_minmax(0,1fr)_auto]",
        isQuizFlow
          ? entry.isViewer
            ? "border-[var(--quiz-leaderboard-row-color)] bg-[var(--quiz-leaderboard-row-color)] text-black ring-2 ring-[var(--quiz-leaderboard-rank-color)]"
            : "border-[var(--quiz-leaderboard-row-color)] bg-[var(--quiz-leaderboard-row-color)] text-white"
          : entry.isViewer
            ? "border-brand/40 bg-brand/10"
            : "border-border bg-background",
        isQuizFlow
          ? entry.isViewer
            ? "max-lg:block max-lg:rounded-full max-lg:border max-lg:border-[var(--quiz-leaderboard-row-color)] max-lg:bg-[var(--quiz-leaderboard-row-color)] max-lg:p-px"
            : "max-lg:block max-lg:rounded-full max-lg:border max-lg:border-[var(--quiz-leaderboard-row-color)] max-lg:bg-[var(--quiz-leaderboard-row-color)] max-lg:p-px"
          : entry.isViewer
            ? "max-lg:block max-lg:rounded-full max-lg:border-0 max-lg:bg-white max-lg:p-[3px]"
            : "max-lg:block max-lg:rounded-full max-lg:border-0 max-lg:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--leaderboard-hue),black_52%)_0%,color-mix(in_oklab,var(--leaderboard-hue),white_30%)_100%)] max-lg:p-px",
        isQuizFlow && entry.isViewer && pulsePosition &&
          "relative z-10 animate-quiz-leaderboard-viewer-row-rank-pulse",
      )}
    >
      <div
        className={cn(
          "contents max-lg:grid max-lg:items-center max-lg:rounded-full",
          isQuizFlow
            ? "max-lg:grid-cols-[auto_2.75rem_minmax(0,1fr)_auto] max-lg:gap-1 max-lg:bg-transparent max-lg:px-2.5 max-lg:py-2.5"
            : "max-lg:grid-cols-[auto_2.25rem_2.25rem_minmax(0,1fr)_auto] max-lg:gap-0.5 max-lg:px-2.5 max-lg:py-2",
          !isQuizFlow && (entry.isViewer
            ? "max-lg:bg-[color-mix(in_oklab,var(--leaderboard-hue),black_45%)]"
            : "max-lg:bg-[color-mix(in_oklab,var(--leaderboard-hue),black_28%)]"),
        )}
      >
        <LeaderboardPositionBadge
          position={entry.position}
          rankIcon={entry.rankIcon}
          pulse={pulsePosition}
          presentation={presentation}
        />
        <ProfilePicture
          profilePictureIndex={entry.profilePictureIndex}
          alt=""
          className={cn(
            isQuizFlow ? "size-11 rounded-full" : "size-9 rounded-full",
            entry.isViewer && (isQuizFlow
              ? "max-lg:ring-2 max-lg:ring-[var(--quiz-leaderboard-rank-color)]"
              : "max-lg:ring-2 max-lg:ring-white"),
          )}
        />
        {!isQuizFlow && (
          <div className="flex items-center justify-center">
            <RankIcon
              icon={entry.rankIcon}
              className={isQuizFlow ? "size-10" : "size-8"}
              sizes={isQuizFlow ? "40px" : "32px"}
            />
          </div>
        )}
        <span className={cn(
          "min-w-0 truncate font-semibold",
          isQuizFlow
            ? `text-base ${viewerNameColor}`
            : "text-sm text-foreground max-lg:text-brand-foreground",
        )}>
          {entry.displayName || t("leaderboard.anonymous")}
        </span>
        <div className={cn(
          "flex items-center justify-self-end font-bold",
          isQuizFlow
            ? "gap-1.5 rounded-full bg-black/25 px-3 py-1.5 text-lg text-white"
            : "gap-1.5 text-base text-foreground max-lg:text-white",
          canUseSuperWater(locale) && "font-super-water",
        )}>
          <span>
            {mode === "points"
              ? formatSuperWaterText(locale, formatNumber(locale, entry.totalPoints))
              : formatNumber(locale, mode === "streaks" ? entry.streak : entry.medals)}
          </span>
          {mode === "streaks" ? (
            <Flame className={cn(isQuizFlow ? "size-6" : "size-5", "fill-red-500 text-red-500")} aria-hidden="true" />
          ) : mode === "medals" ? (
            <Image
              src={RESULT_MEDAL_IMAGE_SRC}
              alt=""
              aria-hidden="true"
              width={isQuizFlow ? 24 : 20}
              height={isQuizFlow ? 24 : 20}
              className={cn(isQuizFlow ? "size-6" : "size-5", "object-contain")}
            />
          ) : (
            <ScoreIcon
              size={isQuizFlow ? 24 : 20}
              className={cn(
                isQuizFlow ? "size-6" : "size-5",
                isQuizFlow && entry.isViewer && "brightness-0 invert",
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getContrastingRankTextClass(hexColor: string) {
  const hex = hexColor.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) return "text-white";

  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linearChannels = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = 0.2126 * linearChannels[0] + 0.7152 * linearChannels[1] + 0.0722 * linearChannels[2];

  return luminance > 0.179 ? "text-black" : "text-white";
}

function LeaderboardPositionBadge({
  position,
  rankIcon,
  pulse,
  presentation,
}: {
  position: number;
  rankIcon: LeaderboardEntry["rankIcon"];
  pulse: boolean;
  presentation: LeaderboardEntryRowPresentation;
}) {
  const { locale } = useLocale();
  const digitCount = String(Math.max(0, position)).length;
  const badgeHeight = presentation === "quiz-flow" ? 3.15 : 3.45;
  const includesRankIcon = presentation === "quiz-flow";
  const badgeWidth = Math.max(badgeHeight, 2.25 + Math.max(0, digitCount - 1) * 0.6)
    + (includesRankIcon ? 2.25 : 0);
  const fontSize = Math.max(0.9, (presentation === "quiz-flow" ? 1.45 : 1.3) - Math.max(0, digitCount - 1) * 0.1);

  return (
    <span
      data-leaderboard-position-badge
      data-rank-position-pulse={pulse ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-transparent font-bold leading-none",
        includesRankIcon && "gap-1.5 px-2",
        presentation === "quiz-flow"
          ? "bg-black/25 text-white"
          : "text-foreground",
        canUseSuperWater(locale) && "font-super-water",
        pulse && "animate-quiz-leaderboard-rank-pulse",
      )}
      style={{
        width: `${badgeWidth}rem`,
        height: `${badgeHeight}rem`,
        fontSize: `${fontSize}rem`,
      }}
    >
      <span>{formatNumber(locale, position)}.</span>
      {includesRankIcon && (
        <RankIcon
          icon={rankIcon}
          className="size-8"
          sizes="32px"
        />
      )}
    </span>
  );
}
