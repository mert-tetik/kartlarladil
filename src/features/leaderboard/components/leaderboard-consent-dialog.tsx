"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

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
  const t = useT();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-consent-title"
        className="w-full max-w-md rounded-xl border border-border bg-background-card p-6 shadow-xl"
      >
        <h2 id="leaderboard-consent-title" className="text-xl font-semibold text-foreground">
          {t("leaderboard.allowTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">
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
            className="bg-gradient-to-r from-blue-500 to-emerald-500 text-white hover:from-blue-600 hover:to-emerald-600"
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
