"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";

export function LeaderboardConsentDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const phase = open ? "open" : "closed";

  return (
    <div
      className={`fixed inset-0 z-[75] flex items-end justify-center p-4 transition-opacity duration-300 ease-out sm:items-center ${
        phase === "open" ? "pointer-events-auto bg-black/55" : "pointer-events-none bg-black/0"
      }`}
      aria-hidden={phase !== "open"}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-consent-title"
        className={`w-full max-w-md rounded-xl border border-border bg-background-card p-6 shadow-sm transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          phase === "open" ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0"
        }`}
      >
        <h2
          id="leaderboard-consent-title"
          className={`text-xl font-semibold text-foreground ${canUseSuperWater(locale) ? "font-super-water" : ""}`}
        >
          {formatSuperWaterText(locale, t("leaderboard.allowTitle"))}
        </h2>
        <p className="mt-2 text-sm leading-6 text-white">
          {t("leaderboard.allowDescription")}
        </p>
        {error ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{t("leaderboard.loadFailed")}</p>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="text-white transition-[filter] hover:brightness-105"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #4da3ff 0%, #8acbff 100%)",
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? t("common.loading") : t("leaderboard.allowConfirm")}
          </Button>
          <Button type="button" disabled={busy} onClick={onClose} className="bg-red-500 text-white hover:bg-red-600">
            {t("leaderboard.allowCancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
