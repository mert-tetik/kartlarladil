"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { RankIcon } from "@/features/progress/rank-icons";
import { useAuthSession } from "@/features/auth/auth-client";
import { LeaderboardConsentDialog } from "@/features/leaderboard/components/leaderboard-consent-dialog";
import { useLeaderboardConsentTestMode } from "@/features/leaderboard/leaderboard-consent-test-mode";
import type {
  LeaderboardMode,
  LeaderboardViewer,
} from "@/features/leaderboard/leaderboard-types";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LocaleCode } from "@/types/domain";

function LeaderboardWorldPositions({
  locale,
  viewer,
  className,
}: {
  locale: LocaleCode;
  viewer: LeaderboardViewer | null;
  className?: string;
}) {
  const pointsPosition =
    typeof viewer?.pointsPosition === "number" ? formatNumber(locale, viewer.pointsPosition) : "—";
  const streakPosition =
    typeof viewer?.streakPosition === "number" ? formatNumber(locale, viewer.streakPosition) : "—";

  return (
    <div
      data-leaderboard-world-positions
      aria-label="Worldwide leaderboard positions"
      className={cn(
        "flex items-center justify-center gap-6 text-[2rem] font-bold leading-none text-foreground sm:text-[2.25rem]",
        canUseSuperWater(locale) && "font-super-water",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <ScoreIcon size={28} className="size-7" />
        <span>{pointsPosition}.</span>
      </span>
      <span className="inline-flex items-center gap-2">
        <Flame className="size-7 fill-red-500 text-red-500" aria-hidden="true" />
        <span>{streakPosition}.</span>
      </span>
    </div>
  );
}

function LeaderboardPositionBadge({
  locale,
  position,
}: {
  locale: LocaleCode;
  position: number;
}) {
  const digitCount = String(Math.max(0, position)).length;
  const badgeSize = 2.25 + Math.max(0, digitCount - 1) * 0.6;
  const fontSize = Math.max(0.9, 1.3 - Math.max(0, digitCount - 1) * 0.1);

  return (
    <span
      data-leaderboard-position-badge
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-transparent font-bold leading-none text-foreground",
        canUseSuperWater(locale) && "font-super-water",
      )}
      style={{
        width: `${badgeSize}rem`,
        height: `${badgeSize}rem`,
        fontSize: `${fontSize}rem`,
      }}
    >
      {formatNumber(locale, position)}.
    </span>
  );
}

export function LeaderboardPageClient({
  initialMode = "points",
}: {
  initialMode?: LeaderboardMode;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { updateProfileField } = useAuthSession();
  const leaderboardConsentTestMode = useLeaderboardConsentTestMode();
  const [selectedMode, setSelectedMode] = useState<LeaderboardMode>(initialMode);
  const [dataMode, setDataMode] = useState<LeaderboardMode>(initialMode);
  const { data, loading, error, refresh } = useLeaderboardData({
    mode: dataMode,
    refreshOnMount: true,
  });
  const modeData = data?.mode === dataMode ? data : null;
  const modeLoading = loading || Boolean(data && !modeData);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [consentSourceRect, setConsentSourceRect] = useState<DOMRect | null>(null);
  const viewerRowRef = useRef<HTMLDivElement | null>(null);
  const modeTransitionFrameRef = useRef<number | null>(null);

  const handleModeChange = useCallback((nextMode: LeaderboardMode) => {
    if (nextMode === selectedMode) {
      return;
    }

    setSelectedMode(nextMode);

    if (modeTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(modeTransitionFrameRef.current);
    }

    modeTransitionFrameRef.current = window.requestAnimationFrame(() => {
      modeTransitionFrameRef.current = null;
      setDataMode(nextMode);
    });
  }, [selectedMode]);

  useEffect(() => {
    setSelectedMode(initialMode);
    setDataMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    return () => {
      if (modeTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(modeTransitionFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!modeData?.canViewLeaderboard) {
      return;
    }

    viewerRowRef.current?.scrollIntoView({
      block: "center",
      behavior: "auto",
    });
  }, [modeData?.canViewLeaderboard, modeData?.entries]);

  async function handleConfirmConsent() {
    if (leaderboardConsentTestMode) {
      setConsentOpen(false);
      return;
    }

    setConsentBusy(true);
    setConsentError("");

    try {
      const response = await fetch("/api/leaderboard/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      });

      if (!response.ok) {
        throw new Error("leaderboard_consent_failed");
      }

      updateProfileField({ leaderboardVisible: true });
      setConsentOpen(false);
      await refresh();
    } catch {
      setConsentError("consent_failed");
    } finally {
      setConsentBusy(false);
    }
  }

  return (
    <>
      <section
        data-leaderboard-page
        className="relative isolate mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center overflow-hidden overscroll-none box-border px-4 py-4 max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:max-w-none max-lg:bg-brand max-lg:px-3 max-lg:py-4"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[60%] top-[-180vw] z-0 size-[220vw] -translate-x-1/2 rounded-full bg-black lg:hidden"
        />
        <div className="relative z-10 flex h-full min-h-0 w-full max-w-xl flex-col items-center justify-center gap-3 text-center max-lg:justify-start max-lg:gap-4">
          <div className="hidden -translate-y-2 space-y-2 lg:block">
            <h1 className={cn("font-display text-4xl font-semibold text-foreground sm:text-5xl", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("leaderboard.title"))}
            </h1>
            <div className="space-y-1">
              <LeaderboardWorldPositions locale={locale} viewer={modeData?.viewer ?? null} />
              <p
                data-leaderboard-scope
                className="text-xs font-medium text-foreground-secondary sm:text-sm"
              >
                {t("leaderboard.scope")}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center justify-center text-foreground lg:hidden">
            <div className="flex translate-y-4 flex-col items-center gap-3">
              <h1 className={cn("font-display text-5xl font-semibold leading-none", canUseSuperWater(locale) && "font-super-water")}>
                {formatSuperWaterText(locale, t("leaderboard.title"))}
              </h1>
              <LeaderboardWorldPositions locale={locale} viewer={modeData?.viewer ?? null} />
            </div>
          </div>

          <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background-card shadow-sm max-lg:mt-auto max-lg:h-[calc(100%-10rem)] max-lg:flex-none max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
            <div className="flex justify-center px-4 pb-2 pt-3 max-lg:px-0 max-lg:pt-2">
              <SegmentedToggle
                value={selectedMode}
                onChange={handleModeChange}
                className="w-full [&>button]:flex-1"
                selectedClassName="bg-white !text-slate-950 hover:bg-white"
                ariaLabel={formatSuperWaterText(locale, t("leaderboard.metricSelector"))}
                labelClassName={cn(
                  "font-semibold",
                  canUseSuperWater(locale) && "font-super-water",
                )}
                options={[
                  {
                    value: "points",
                    label: formatSuperWaterText(locale, t("leaderboard.points")),
                  },
                  {
                    value: "streaks",
                    label: formatSuperWaterText(locale, t("leaderboard.streaks")),
                  },
                ]}
              />
            </div>
            <div className="flex items-center justify-between border-b border-border px-4 py-3 max-lg:hidden">
              <span className={cn("text-sm font-semibold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
                {formatSuperWaterText(locale, t("leaderboard.title"))}
              </span>
              {modeData?.canViewLeaderboard ? (
                <span className={cn(
                  "text-xs font-medium text-foreground-secondary",
                  canUseSuperWater(locale) && "font-super-water",
                )}>
                  {formatNumber(locale, modeData.entries.length)}
                </span>
              ) : null}
            </div>
            <div
              aria-hidden="true"
              className="mx-auto mb-2 hidden h-1 w-[calc(100%+0.75rem)] shrink-0 rounded-full bg-white max-lg:block"
            />

            <div
              data-leaderboard-list
              data-state={modeLoading ? "loading" : "loaded"}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 max-lg:px-0 max-lg:py-1"
            >
              {modeLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-secondary">
                  <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                  <p className="text-sm font-medium">{t("common.loading")}</p>
                </div>
              ) : !modeData && error ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-rose-600">
                  {t("leaderboard.loadFailed")}
                </div>
              ) : !modeData?.canViewLeaderboard ? (
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
                  <button
                    type="button"
                    onClick={(event) => {
                      setConsentError("");
                      setConsentSourceRect(event.currentTarget.getBoundingClientRect());
                      setConsentOpen(true);
                    }}
                    className={cn(
                      "inline-flex h-14 items-center justify-center rounded-full bg-black px-9 text-lg font-semibold text-white transition-colors hover:bg-black/85 sm:text-xl",
                      canUseSuperWater(locale) && "font-super-water",
                    )}
                  >
                    {formatSuperWaterText(locale, t("leaderboard.allow"))}
                  </button>
                  {consentError ? (
                    <p className="text-xs font-medium text-rose-600">
                      {t("leaderboard.loadFailed")}
                    </p>
                  ) : null}
                </div>
              ) : modeData.entries.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-foreground-secondary">
                  {t("leaderboard.empty")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {modeData.entries.map((entry) => (
                    <div
                      key={entry.userId}
                      ref={entry.isViewer ? viewerRowRef : null}
                      data-leaderboard-entry={entry.isViewer ? "viewer" : "item"}
                      className={cn(
                        "grid grid-cols-[auto_2.75rem_3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-3 text-left",
                        entry.isViewer
                          ? "border-brand/40 bg-brand/10"
                          : "border-border bg-background",
                        entry.isViewer
                          ? "max-lg:block max-lg:rounded-full max-lg:border-0 max-lg:bg-white max-lg:p-[3px]"
                          : "max-lg:block max-lg:rounded-full max-lg:border-0 max-lg:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand),black_52%)_0%,color-mix(in_oklab,var(--brand),white_30%)_100%)] max-lg:p-px",
                      )}
                    >
                      <div
                        className={cn(
                          "contents max-lg:grid max-lg:grid-cols-[auto_2.25rem_2.25rem_minmax(0,1fr)_auto] max-lg:items-center max-lg:gap-0.5 max-lg:rounded-full max-lg:px-2.5 max-lg:py-2",
                          entry.isViewer
                            ? "max-lg:bg-[color-mix(in_oklab,var(--brand),black_45%)]"
                            : "max-lg:bg-[color-mix(in_oklab,var(--brand),black_28%)]",
                        )}
                      >
                        <LeaderboardPositionBadge locale={locale} position={entry.position} />
                        <ProfilePicture
                          profilePictureIndex={entry.profilePictureIndex}
                          alt=""
                          className={cn("size-9 rounded-full", entry.isViewer && "max-lg:ring-2 max-lg:ring-white")}
                        />
                        <div className="flex items-center justify-center">
                          <RankIcon icon={entry.rankIcon} className="size-8" sizes="32px" />
                        </div>
                        <span className="truncate text-sm font-semibold text-foreground max-lg:text-brand-foreground">
                          {entry.displayName || t("leaderboard.anonymous")}
                        </span>
                        <div className={cn(
                          "flex items-center gap-1.5 justify-self-end text-base font-bold text-foreground max-lg:text-white",
                          canUseSuperWater(locale) && "font-super-water",
                        )}>
                          <span>
                            {formatNumber(
                              locale,
                              dataMode === "streaks" ? entry.streak : entry.totalPoints,
                            )}
                          </span>
                          {dataMode === "streaks" ? (
                            <Flame
                              className="size-5 fill-red-400 text-red-400"
                              aria-hidden="true"
                            />
                          ) : (
                            <ScoreIcon size={20} className="size-5" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!modeLoading && error && modeData ? (
                <p className="mt-3 text-center text-xs font-medium text-rose-600">
                  {t("leaderboard.loadFailed")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <LeaderboardConsentDialog
        open={consentOpen}
        busy={consentBusy}
        error={consentError}
        sourceRect={consentSourceRect}
        onClose={() => setConsentOpen(false)}
        onConfirm={() => {
          void handleConfirmConsent();
        }}
      />
    </>
  );
}
