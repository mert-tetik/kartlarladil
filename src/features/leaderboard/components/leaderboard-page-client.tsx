"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { RankIcon } from "@/features/progress/rank-icons";
import { useAuthSession } from "@/features/auth/auth-client";
import { LeaderboardConsentDialog } from "@/features/leaderboard/components/leaderboard-consent-dialog";
import { useLeaderboardData } from "@/features/leaderboard/use-leaderboard";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function LeaderboardPageClient() {
  const { locale } = useLocale();
  const t = useT();
  const { updateProfileField } = useAuthSession();
  const { data, loading, error, refresh } = useLeaderboardData();
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

  const standingText = data
    ? t("leaderboard.yourStanding", { position: formatNumber(locale, data.viewer.position) })
    : t("leaderboard.positionLoading");

  return (
    <>
      <section
        data-leaderboard-page
        className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-3xl flex-col items-center justify-center overflow-hidden px-4 py-6 max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:max-w-none max-lg:px-3"
      >
        <div className="flex w-full max-w-xl flex-col items-center justify-center gap-4 text-center">
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-semibold text-foreground sm:text-5xl">
              {t("leaderboard.title")}
            </h1>
            <p className="text-lg font-semibold text-brand">
              {standingText}
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-border bg-background-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-foreground">
                <Trophy className="size-4 text-brand" aria-hidden="true" />
                <span className="text-sm font-semibold">{t("leaderboard.title")}</span>
              </div>
              {data?.canViewLeaderboard ? (
                <span className="text-xs font-medium text-foreground-secondary">
                  {formatNumber(locale, data.entries.length)}
                </span>
              ) : null}
            </div>

            <div
              data-leaderboard-list
              data-state={loading ? "loading" : "loaded"}
              className="h-[52dvh] min-h-[320px] overflow-y-auto px-3 py-3 sm:h-[56dvh]"
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
                        "grid grid-cols-[3rem_3rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-3 text-left",
                        entry.isViewer
                          ? "border-brand/40 bg-brand/10"
                          : "border-border bg-background",
                      )}
                    >
                      <span className="text-sm font-semibold text-foreground-secondary">
                        {entry.position}.
                      </span>
                      <div className="flex items-center justify-center">
                        <RankIcon icon={entry.rankIcon} className="size-8" sizes="32px" />
                      </div>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {entry.displayName || t("leaderboard.anonymous")}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {formatNumber(locale, entry.totalPoints)}
                      </span>
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
