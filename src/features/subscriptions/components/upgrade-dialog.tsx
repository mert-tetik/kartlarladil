"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import type { LimitErrorCode } from "@/types/domain";

interface UpgradeDialogProps {
  open: boolean;
  errorCode: LimitErrorCode | null;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({ open, errorCode, onOpenChange }: UpgradeDialogProps) {
  const t = useT();

  if (!open || !errorCode) {
    return null;
  }

  const content = getLimitContent(errorCode, t);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
    >
      <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950"
          aria-label={t("common.close")}
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2
          id="upgrade-dialog-title"
          className="pr-8 text-lg font-semibold text-slate-950"
        >
          {content.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{content.description}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.maybeLater")}
          </Button>
          <Link
            href="/pricing"
            className={buttonClassName("primary")}
            onClick={() => onOpenChange(false)}
          >
            {t("limit.upgradeButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function getLimitContent(
  errorCode: LimitErrorCode,
  t: ReturnType<typeof useT>,
): { title: string; description: string } {
  switch (errorCode) {
    case "free_active_card_limit":
      return {
        title: t("limit.activeCardLimitTitle"),
        description: t("limit.activeCardLimitDescription"),
      };
    case "free_learned_card_limit":
      return {
        title: t("limit.learnedCardLimitTitle"),
        description: t("limit.learnedCardLimitDescription"),
      };
    case "ai_daily_limit":
      return {
        title: t("limit.aiDailyLimitTitle"),
        description: t("limit.aiDailyLimitDescription"),
      };
    case "ai_monthly_limit":
      return {
        title: t("limit.aiMonthlyLimitTitle"),
        description: t("limit.aiMonthlyLimitDescription"),
      };
    default:
      return {
        title: t("limit.defaultTitle"),
        description: t("limit.defaultDescription"),
      };
  }
}
