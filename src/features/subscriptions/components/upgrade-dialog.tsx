"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, buttonClassName } from "@/components/ui/button";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useT } from "@/i18n/locale-provider";
import { vibrate } from "@/lib/vibration";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { cn } from "@/lib/utils";
import type { LanguageCode, LimitErrorCode } from "@/types/domain";
import { SubscriptionRestrictionSurface } from "@/features/subscriptions/components/subscription-restriction-surface";

export type UpgradeDialogErrorCode =
  | LimitErrorCode
  | "learn_locale_locked"
  | "inventory_card_already_active"
  | "inventory_card_already_learned"
  | "language_match_not_allowed"
  | "learned_review_subscription_required"
  | "game_level_locked";

interface UpgradeDialogProps {
  open: boolean;
  errorCode: UpgradeDialogErrorCode | null;
  onOpenChange: (open: boolean) => void;
  selectedLanguage?: LanguageCode;
  onSwapLanguages?: () => void;
}

export function UpgradeDialog({ open, errorCode, onOpenChange, selectedLanguage, onSwapLanguages }: UpgradeDialogProps) {
  const t = useT();
  const router = useRouter();
  const requireAuthAction = useRequireAuthAction();
  const [renderedErrorCode, setRenderedErrorCode] = useState<UpgradeDialogErrorCode | null>(errorCode);
  const [isMounted, setIsMounted] = useState(Boolean(open && errorCode));
  const [isVisible, setIsVisible] = useState(false);
  const activeErrorCode = open && errorCode ? errorCode : renderedErrorCode;

  useEffect(() => {
    if (open && errorCode) {
      const frame = window.requestAnimationFrame(() => {
        setRenderedErrorCode(errorCode);
        setIsMounted(true);
        setIsVisible(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    const exitFrame = window.requestAnimationFrame(() => setIsVisible(false));
    const timer = window.setTimeout(() => setIsMounted(false), 300);

    return () => {
      window.cancelAnimationFrame(exitFrame);
      window.clearTimeout(timer);
    };
  }, [errorCode, open]);

  if (!(isMounted || (open && errorCode)) || !activeErrorCode) {
    return null;
  }

  const content = getLimitContent(activeErrorCode, t);
  const showsUpgradeCta = content.variant === "upgrade";

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm transition-opacity duration-300 ease-out",
        isVisible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <SubscriptionRestrictionSurface
        labelledBy="upgrade-dialog-title"
        className={cn(
          "origin-center transition-[opacity,transform] duration-300 ease-out",
          isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-5 scale-[0.96] opacity-0",
        )}
      >
        <div className="absolute inset-x-0 bottom-0 flex min-h-[51%] flex-col justify-end px-[7.5%] pb-[7.5%] pt-10">
          <h2
            id="upgrade-dialog-title"
            className="text-xl font-bold leading-tight text-white sm:text-2xl"
          >
            {content.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-orange-50 sm:text-base">{content.description}</p>

          <div className="mt-5 flex flex-col gap-2.5">
            {showsUpgradeCta ? (
              <Link
                href="/pricing"
                className={buttonClassName(
                  "primary",
                  "md",
                  "h-11 w-full rounded-xl bg-gradient-to-r from-[#fdf4a5] to-[#f5ac27] text-sm font-bold text-[#552000] hover:brightness-105 focus-visible:outline-[#fdf4a5]",
                )}
                onClick={() => onOpenChange(false)}
              >
                {t("limit.upgradeButtonFirstMonthFree")}
              </Link>
            ) : null}
            {activeErrorCode === "free_active_card_limit" ? (
              <Button
                className="h-11 w-full rounded-xl border-0 bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={() => {
                  vibrate("tap");
                  onOpenChange(false);
                  const nextPath = selectedLanguage
                    ? `/learn?mode=active&language=${encodeURIComponent(selectedLanguage)}`
                    : "/learn?mode=active";
                  requireAuthAction(() => {
                    navigateWithRouteTransition(() => router.push(nextPath));
                  }, { nextPath });
                }}
              >
                {t("limit.activeCardLimitLearnButton")}
              </Button>
            ) : null}
            {activeErrorCode === "language_match_not_allowed" && onSwapLanguages ? (
              <Button
                className="h-11 w-full rounded-xl border-0 bg-sky-500 text-white hover:bg-sky-600"
                onClick={() => {
                  vibrate("tap");
                  onSwapLanguages();
                  onOpenChange(false);
                }}
              >
                {t("locale.languageMatchSwap")}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="h-10 rounded-xl border border-white/30 bg-black/20 text-white hover:bg-black/35 hover:text-white"
              onClick={() => onOpenChange(false)}
            >
              {activeErrorCode === "language_match_not_allowed"
                ? t("locale.languageMatchCancel")
                : t("common.maybeLater")}
            </Button>
          </div>
        </div>
      </SubscriptionRestrictionSurface>
    </div>,
    document.body,
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
    case "language_match_not_allowed":
      return {
        title: t("locale.languageMatchTitle"),
        description: t("locale.languageMatchDescription"),
        variant: "message",
      };
    case "game_level_locked":
      return {
        title: t("games.levelLockedTitle"),
        description: t("games.levelLockedDescription"),
        variant: "upgrade",
      };
    case "learned_review_subscription_required":
      return {
        title: t("limit.learnedReviewSubscriptionTitle"),
        description: t("limit.learnedReviewSubscriptionDescription"),
        variant: "upgrade",
      };
    default:
      return {
        title: t("limit.defaultTitle"),
        description: t("limit.defaultDescription"),
        variant: "upgrade",
      };
  }
}
