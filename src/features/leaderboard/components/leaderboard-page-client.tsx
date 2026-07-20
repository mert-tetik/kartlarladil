"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { ScoreIcon } from "@/components/score-icon";
import { RankIcon } from "@/features/progress/rank-icons";
import { useAuthSession } from "@/features/auth/auth-client";
import { LeaderboardConsentDialog } from "@/features/leaderboard/components/leaderboard-consent-dialog";
import { ProfilePicture } from "@/features/auth/components/profile-picture";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

export function LeaderboardPageClient() {
  const { locale } = useLocale();
  const t = useT();
  const { updateProfileField } = useAuthSession();
  const { data, loading, error, refresh } = useLeaderboardData({ refreshOnMount: true });
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState("");
  const viewerRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!data?.canViewLeaderboard) {
      return;
    }

    viewerRowRef.current?.scrollIntoView({
      block: "center",
      behavior: "auto",
    });
  }, [data?.canViewLeaderboard, data?.entries]);

  async function handleConfirmConsent() {
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
        className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center overflow-hidden overscroll-none box-border px-4 py-4 max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:max-w-none max-lg:bg-brand max-lg:px-3 max-lg:py-4"
      >
        <div className="flex h-full min-h-0 w-full max-w-xl flex-col items-center justify-center gap-3 text-center max-lg:justify-start max-lg:gap-4">
          <div className="hidden space-y-2 lg:block">
            <h1 className={cn("font-display text-4xl font-semibold text-foreground sm:text-5xl", canUseSuperWater(locale) && "font-super-water")}>
              {formatSuperWaterText(locale, t("leaderboard.title"))}
            </h1>
            <div className="space-y-1">
              <p
                data-leaderboard-standing
                className="text-[2.25rem] font-bold leading-none text-brand sm:text-4xl"
              >
                {data
                  ? t("leaderboard.yourStanding", { position: formatNumber(locale, data.viewer.position) })
                  : t("leaderboard.positionLoading")}
              </p>
              <p
                data-leaderboard-scope
                className="text-xs font-medium text-foreground-secondary sm:text-sm"
              >
                {t("leaderboard.scope")}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-foreground lg:hidden">
            <div className="min-w-0 text-center">
              <h1 className={cn("font-display text-5xl font-semibold leading-none", canUseSuperWater(locale) && "font-super-water")}>
                {formatSuperWaterText(locale, t("leaderboard.title"))}
              </h1>
              <p data-leaderboard-scope className="mt-1 text-xs font-medium text-brand-foreground/80">
                {t("leaderboard.scope")}
              </p>
            </div>
            <div className="min-w-9 text-right">
              {data?.canViewLeaderboard ? (
                <span className="text-xs font-semibold text-brand-foreground/85">
                  {formatNumber(locale, data.entries.length)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background-card shadow-sm max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 max-lg:hidden">
              <span className={cn("text-sm font-semibold text-foreground", canUseSuperWater(locale) && "font-super-water")}>
                {formatSuperWaterText(locale, t("leaderboard.title"))}
              </span>
              {data?.canViewLeaderboard ? (
                <span className="text-xs font-medium text-foreground-secondary">
                  {formatNumber(locale, data.entries.length)}
                </span>
              ) : null}
            </div>

            <div
              data-leaderboard-list
              data-state={loading ? "loading" : "loaded"}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 max-lg:px-0 max-lg:py-1"
            >
              {loading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-secondary">
                  <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                  <p className="text-sm font-medium">{t("common.loading")}</p>
                </div>
              ) : !data && error ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-rose-600">
                  {t("leaderboard.loadFailed")}
                </div>
              ) : !data?.canViewLeaderboard ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-foreground">
                      {t("leaderboard.lockedTitle")}
                    </p>
                    <p className="text-sm leading-6 text-foreground-secondary">
                      {t("leaderboard.lockedDescription")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConsentError("");
                      setConsentOpen(true);
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
                  >
                    {t("leaderboard.allow")}
                  </button>
                  {consentError ? (
                    <p className="text-xs font-medium text-rose-600">
                      {t("leaderboard.loadFailed")}
                    </p>
                  ) : null}
                </div>
              ) : data.entries.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-foreground-secondary">
                  {t("leaderboard.empty")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.entries.map((entry) => (
                    <div
                      key={entry.userId}
                      ref={entry.isViewer ? viewerRowRef : null}
                      data-leaderboard-entry={entry.isViewer ? "viewer" : "item"}
                      className={cn(
                        "grid grid-cols-[2rem_2.75rem_3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-3 text-left",
                        entry.isViewer
                          ? "border-brand/40 bg-brand/10"
                          : "border-border bg-background",
                        "max-lg:block max-lg:rounded-full max-lg:border-0 max-lg:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand),black_52%)_0%,color-mix(in_oklab,var(--brand),white_30%)_100%)] max-lg:p-px",
                      )}
                    >
                      <div className="contents max-lg:grid max-lg:grid-cols-[1.5rem_2.25rem_2.25rem_minmax(0,1fr)_auto] max-lg:items-center max-lg:gap-0.5 max-lg:rounded-full max-lg:bg-[color-mix(in_oklab,var(--brand),black_28%)] max-lg:px-2.5 max-lg:py-2">
                        <span className="text-sm font-semibold text-foreground-secondary max-lg:text-brand-foreground/70">
                          {entry.position}.
                        </span>
                        <ProfilePicture
                          profilePictureIndex={entry.profilePictureIndex}
                          alt=""
                          className="size-9 rounded-full"
                        />
                        <div className="flex items-center justify-center">
                          <RankIcon icon={entry.rankIcon} className="size-8" sizes="32px" />
                        </div>
                        <span className="truncate text-sm font-semibold text-foreground max-lg:text-brand-foreground">
                          {entry.displayName || t("leaderboard.anonymous")}
                        </span>
                        <div className="flex items-center gap-1.5 justify-self-end text-sm font-bold text-foreground max-lg:text-brand-foreground">
                          <span>{formatNumber(locale, entry.totalPoints)}</span>
                          <ScoreIcon size={18} className="h-[1.05rem] w-auto" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && error && data ? (
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
        onClose={() => setConsentOpen(false)}
        onConfirm={() => {
          void handleConfirmConsent();
        }}
      />
    </>
  );
}
