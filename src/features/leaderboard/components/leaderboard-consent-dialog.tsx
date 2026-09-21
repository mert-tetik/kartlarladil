"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { useAppMessage } from "@/components/app-message-provider";

export function LeaderboardConsentDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
  sourceRect = null,
}: {
  open: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
  sourceRect?: DOMRect | null;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { showMessage } = useAppMessage();
  const phase = open ? "open" : "closed";
  const [hasOpened, setHasOpened] = useState(open);
  const [transformOrigin, setTransformOrigin] = useState("0px 0px");

  useEffect(() => {
    if (error) {
      showMessage(t("leaderboard.loadFailed"), "error");
    }
  }, [error, showMessage, t]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const origin = sourceRect
      ? {
          x: sourceRect.left + sourceRect.width / 2,
          y: sourceRect.top + sourceRect.height / 2,
        }
      : {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };

    setTransformOrigin(`${origin.x}px ${origin.y}px`);
  }, [open, sourceRect]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => setHasOpened(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[75] flex items-end justify-center p-4 sm:items-center",
        open && hasOpened && "leaderboard-consent-overlay",
        open && !hasOpened && "leaderboard-consent-overlay--preparing",
        !open && hasOpened && "leaderboard-consent-overlay--closing",
        !hasOpened && "invisible pointer-events-none",
        open && hasOpened ? "pointer-events-auto" : "pointer-events-none",
        hasOpened ? "bg-black/55" : "bg-black/0",
      )}
      style={{ transformOrigin }}
      aria-hidden={phase !== "open"}
    >
      <div
        key={phase}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-consent-title"
        className="leaderboard-consent-overlay__item w-full max-w-md rounded-xl border border-border bg-background-card p-6 shadow-sm"
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
