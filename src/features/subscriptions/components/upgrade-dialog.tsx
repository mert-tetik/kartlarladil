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
import type { ActiveCardLimitDetails, LanguageCode, LimitErrorCode } from "@/types/domain";
import { SubscriptionRestrictionSurface } from "@/features/subscriptions/components/subscription-restriction-surface";

export type UpgradeDialogErrorCode =
  | LimitErrorCode
  | "learn_locale_locked"
  | "inventory_card_already_active"
  | "inventory_card_already_learned"
  | "language_match_not_allowed"
  | "game_language_match_not_allowed"
  | "learned_review_subscription_required"
  | "game_level_locked";

interface UpgradeDialogProps {
  open: boolean;
  errorCode: UpgradeDialogErrorCode | null;
  onOpenChange: (open: boolean) => void;
  selectedLanguage?: LanguageCode;
  onSwapLanguages?: () => void;
  activeCardLimitDetails?: ActiveCardLimitDetails | null;
}

export function UpgradeDialog({
  open,
  errorCode,
  onOpenChange,
  selectedLanguage,
  onSwapLanguages,
  activeCardLimitDetails,
}: UpgradeDialogProps) {
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

  const content = getLimitContent(activeErrorCode, t, activeCardLimitDetails);
  const showsUpgradeCta = content.variant === "upgrade";
  const isLanguageMatchDialog =
    activeErrorCode === "language_match_not_allowed" || activeErrorCode === "game_language_match_not_allowed";
  const surfaceAnimationClass = cn(
    "origin-center transition-[opacity,transform] duration-300 ease-out",
    isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-5 scale-[0.96] opacity-0",
  );

  const contentBody = (
    <div
      className={cn(
        "flex flex-col",
        isLanguageMatchDialog
          ? "relative px-6 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-8"
          : "absolute inset-x-0 bottom-0 min-h-[51%] justify-end px-[7.5%] pb-[7.5%] pt-10",
      )}
    >
      <h2
        id="upgrade-dialog-title"
        className="text-xl font-bold leading-tight text-white sm:text-2xl"
      >
        {content.title}
      </h2>
      <p className={cn("mt-2 text-sm leading-6 sm:text-base", isLanguageMatchDialog ? "text-white" : "text-orange-50")}>
        {content.description}
      </p>

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
            className="h-11 w-full rounded-xl border-0 bg-action-learn text-white hover:bg-action-learn-hover"
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
            className={cn(
              "h-12 w-full rounded-full border-0 font-semibold text-brand transition-colors",
              isLanguageMatchDialog ? "bg-white hover:bg-white/90" : "bg-action-learned text-white hover:bg-action-review-hover",
            )}
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
          className={cn(
            isLanguageMatchDialog
              ? "h-12 rounded-full border-0 bg-black text-brand hover:bg-black/85 hover:text-brand"
              : "h-10 rounded-xl border border-white/30 bg-black/20 text-white hover:bg-black/35 hover:text-white",
          )}
          onClick={() => onOpenChange(false)}
        >
          {isLanguageMatchDialog
            ? t("locale.languageMatchCancel")
            : t("common.maybeLater")}
        </Button>
      </div>
    </div>
  );

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
      {isLanguageMatchDialog ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-dialog-title"
          className={cn(
            "relative isolate w-[min(92vw,28rem)] overflow-hidden rounded-[2.25rem] bg-brand text-white shadow-lg",
            surfaceAnimationClass,
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" aria-hidden="true" />
          {contentBody}
        </section>
      ) : (
        <SubscriptionRestrictionSurface labelledBy="upgrade-dialog-title" className={surfaceAnimationClass}>
          {contentBody}
        </SubscriptionRestrictionSurface>
      )}
    </div>,
    document.body,
  );
}

function getLimitContent(
  errorCode: UpgradeDialogErrorCode,
  t: ReturnType<typeof useT>,
  activeCardLimitDetails?: ActiveCardLimitDetails | null,
): { title: string; description: string; variant: "upgrade" | "message" } {
  switch (errorCode) {
    case "free_active_card_limit":
      return {
        title: t("limit.activeCardLimitTitle"),
        description: activeCardLimitDetails
          ? t("limit.activeCardLimitGroupDescription", {
              addedCount: activeCardLimitDetails.addedCount,
              skippedCount: activeCardLimitDetails.skippedCount,
            })
          : t("limit.activeCardLimitDescription"),
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
    case "game_language_match_not_allowed":
      return {
        title: t("games.languageMatchTitle"),
        description: t("games.languageMatchDescription"),
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
