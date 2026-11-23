"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Image from "next/image";
import { Flame } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { useAuthSession } from "@/features/auth/auth-client";
import { LeaderboardConsentDialog } from "@/features/leaderboard/components/leaderboard-consent-dialog";
import { LeaderboardEntriesList } from "@/features/leaderboard/components/leaderboard-entries-list";
import { useLeaderboardConsentTestMode } from "@/features/leaderboard/leaderboard-consent-test-mode";
import type {
  LeaderboardMode,
  LeaderboardViewer,
} from "@/features/leaderboard/leaderboard-types";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { useAppMessage } from "@/components/app-message-provider";
import type { LocaleCode } from "@/types/domain";
import { RESULT_MEDAL_IMAGE_SRC } from "@/features/progress/components/reward-medal-hud";

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
    typeof viewer?.pointsPosition === "number" ? formatSuperWaterText(locale, formatNumber(locale, viewer.pointsPosition)) : "—";
  const streakPosition =
    typeof viewer?.streakPosition === "number" ? formatNumber(locale, viewer.streakPosition) : "—";

  const medalsPosition =
    typeof viewer?.medalsPosition === "number" ? formatNumber(locale, viewer.medalsPosition) : "—";

  return (
    <div
      data-leaderboard-world-positions
      aria-label="Worldwide leaderboard positions"
      className={cn(
        "flex items-center justify-center gap-4 text-[1.7rem] font-bold leading-none text-foreground sm:gap-6 sm:text-[2.25rem]",
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
      <span className="inline-flex items-center gap-2">
        <Image
          src={RESULT_MEDAL_IMAGE_SRC}
          alt=""
          aria-hidden="true"
          width={28}
          height={28}
          className="size-7 object-contain"
        />
        <span>{medalsPosition}.</span>
      </span>
    </div>
  );
}

export function LeaderboardPageClient({
  initialMode = "points",
}: {
  initialMode?: LeaderboardMode;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { showMessage } = useAppMessage();
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
    if (error) {
      showMessage(t("leaderboard.loadFailed"), "error");
    }
  }, [error, showMessage, t]);

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

  function handleOpenConsent(event: MouseEvent<HTMLButtonElement>) {
    setConsentError("");
    setConsentSourceRect(event.currentTarget.getBoundingClientRect());
    setConsentOpen(true);
  }

  return (
    <>
      <section
        data-leaderboard-page
        className={cn(
          "relative isolate mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center overflow-hidden overscroll-none box-border bg-center bg-cover bg-no-repeat px-4 py-4 transition-[background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:max-w-none max-lg:px-3 max-lg:py-4",
          selectedMode === "streaks"
            ? "max-lg:bg-red-500"
            : selectedMode === "medals"
              ? "max-lg:bg-amber-500"
              : "max-lg:bg-yellow-400",
        )}
        style={
          {
            "--leaderboard-hue": selectedMode === "streaks"
              ? "#ef4444"
              : selectedMode === "medals"
                ? "#f59e0b"
                : "#facc15",
            ...(selectedMode === "points"
              ? { backgroundImage: "url('/leaderboard/points-background.webp')" }
              : {}),
          } as CSSProperties
        }
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
                  {
                    value: "medals",
                    label: formatSuperWaterText(locale, t("medals.name")),
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

            <LeaderboardEntriesList
              data={modeData}
              mode={dataMode}
              loading={modeLoading}
              error={error}
              viewerRowRef={viewerRowRef}
              onAllow={handleOpenConsent}
            />
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
