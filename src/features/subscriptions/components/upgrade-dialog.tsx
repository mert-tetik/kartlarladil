"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import type { LimitErrorCode } from "@/types/domain";

export type UpgradeDialogErrorCode =
  | LimitErrorCode
  | "learn_locale_locked"
  | "inventory_card_already_active"
  | "inventory_card_already_learned";

interface UpgradeDialogProps {
  open: boolean;
  errorCode: UpgradeDialogErrorCode | null;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({ open, errorCode, onOpenChange }: UpgradeDialogProps) {
  const t = useT();

  if (!open || !errorCode) {
    return null;
  }

  const content = getLimitContent(errorCode, t);
  const showsUpgradeCta = content.variant === "upgrade";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background-inverse/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
    >
      <div className="animate-menu-pop origin-center relative w-full max-w-md rounded-lg border border-border bg-background-card p-6 shadow-lg">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
          aria-label={t("common.close")}
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2
          id="upgrade-dialog-title"
          className="pr-8 text-lg font-semibold text-foreground"
        >
          {content.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">{content.description}</p>

        {errorCode === "free_active_card_limit" ? (
          <Link
            href="/learn"
            className={buttonClassName("primary", "md", "mt-4 w-full")}
            onClick={() => onOpenChange(false)}
          >
            {t("limit.activeCardLimitLearnButton")}
          </Link>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.maybeLater")}
          </Button>
          {showsUpgradeCta ? (
            <Link
              href="/pricing"
              className={buttonClassName("primary", "md")}
              onClick={() => onOpenChange(false)}
            >
              {t("limit.upgradeButton")}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getLimitContent(
  errorCode: UpgradeDialogErrorCode,
  t: ReturnType<typeof useT>,
): { title: string; description: string; variant: "upgrade" | "message" } {
  switch (errorCode) {
    case "free_active_card_limit":
      return {
        title: t("limit.activeCardLimitTitle"),
        description: t("limit.activeCardLimitDescription"),
        variant: "upgrade",
      };
    case "free_learned_card_limit":
      return {
        title: t("limit.learnedCardLimitTitle"),
        description: t("limit.learnedCardLimitDescription"),
        variant: "upgrade",
      };
    case "ai_daily_limit":
      return {
        title: t("limit.aiDailyLimitTitle"),
        description: t("limit.aiDailyLimitDescription"),
        variant: "upgrade",
      };
    case "ai_monthly_limit":
      return {
        title: t("limit.aiMonthlyLimitTitle"),
        description: t("limit.aiMonthlyLimitDescription"),
        variant: "upgrade",
      };
    case "learn_locale_locked":
      return {
        title: t("locale.lockedOnLearnTitle"),
        description: t("locale.lockedOnLearnDescription"),
        variant: "message",
      };
    case "inventory_card_already_active":
      return {
        title: t("limit.cardAlreadyActiveTitle"),
        description: t("limit.cardAlreadyActiveDescription"),
        variant: "message",
      };
    case "inventory_card_already_learned":
      return {
        title: t("limit.cardAlreadyLearnedTitle"),
        description: t("limit.cardAlreadyLearnedDescription"),
        variant: "message",
      };
    default:
      return {
        title: t("limit.defaultTitle"),
        description: t("limit.defaultDescription"),
        variant: "upgrade",
      };
  }
}
