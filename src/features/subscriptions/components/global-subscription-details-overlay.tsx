"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  Gamepad2,
  Layers,
  MessageCircle,
  MessagesSquare,
  Palette,
  ScanText,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useAppMessage } from "@/components/app-message-provider";
import { getGooglePlayErrorMessage, isGooglePlayPurchaseCancellation } from "@/features/subscriptions/google-play-errors";
import { GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@/features/subscriptions/google-play-links";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  type BillingCycle,
  type GooglePlayPricingStatus,
} from "@/features/subscriptions/use-google-play-pricing";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
  type LocalizedPricingStatus,
} from "@/features/subscriptions/components/use-localized-pricing";
import { useLocale, useT } from "@/i18n/locale-provider";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { LocaleCode, SubscriptionPlan } from "@/types/domain";

export type SubscriptionDetailsSelection = {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  ctaLabel?: string;
};

export interface GlobalSubscriptionDetailsOverlayProps {
  selection: SubscriptionDetailsSelection;
  user: AuthShellUser | null;
  currentPlan: SubscriptionPlan | null;
  isTwa: boolean;
  currencyCode: string | null;
  googlePlayPricing: GooglePlayPricingStatus;
  purchase: (sku: string) => Promise<unknown>;
  purchaseLoading: boolean;
  purchaseSupported: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void | Promise<void>;
  onPresentPurchaseSuccess: () => void;
}

const PLAN_COLOR: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "#2563eb",
  pro: "#9333ea",
};

const PLAN_BUTTON_IMAGE: Record<Exclude<SubscriptionPlan, "free">, { src: string; width: number; height: number }> = {
  basic: { src: "/subscriptions/plan-basic-v2.png", width: 1489, height: 450 },
  pro: { src: "/subscriptions/plan-pro-v2.png", width: 1338, height: 511 },
};

const FRAME_COUNT = 50;
const FRAME_FPS = 45;
const FRAME_BASE_PATH: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "/pricing-subscription-menu-frames-v2",
  pro: "/pricing-subscription-menu-pro-frames-v2",
};

export function GlobalSubscriptionDetailsOverlay({
  selection,
  user,
  currentPlan,
  isTwa,
  currencyCode,
  googlePlayPricing,
  purchase,
  purchaseLoading,
  purchaseSupported,
  onClose,
  onPurchaseSuccess,
  onPresentPurchaseSuccess,
}: GlobalSubscriptionDetailsOverlayProps) {
  const t = useT();
  const { locale } = useLocale();
  const { showMessage } = useAppMessage();
  const localizedPricing = useLocalizedPricing(currencyCode, isTwa);
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const featureListRef = useRef<HTMLUListElement | null>(null);
  const [showFeatureScrollHint, setShowFeatureScrollHint] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const planColor = PLAN_COLOR[selection.plan];
  const planImage = PLAN_BUTTON_IMAGE[selection.plan];
  const price = getPlanPrice({
    plan: selection.plan,
    cycle: selection.cycle,
    localizedPricing,
    googlePlayPricing,
    locale,
    isTwa,
  });
  const ctaLabel = selection.ctaLabel ?? t("pricing.ctaSubscribe");
  const period = selection.cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth");
  const usesSuperWater = canUseSuperWater(locale);

  const handleClose = useCallback((purchased = false) => {
    if (isClosingRef.current || (purchaseLoading && !purchased)) return;
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      if (!purchased) return;

      try {
        const pendingSuccess = onPurchaseSuccess?.();
        if (pendingSuccess && typeof (pendingSuccess as Promise<void>).catch === "function") {
          void (pendingSuccess as Promise<void>).catch((error: unknown) => {
            console.error("Could not finish post-purchase restriction cleanup:", error);
          });
        }
      } catch (error) {
        console.error("Could not finish post-purchase restriction cleanup:", error);
      }

      if (!onPurchaseSuccess) onPresentPurchaseSuccess();
    }, 300);
  }, [onClose, onPresentPurchaseSuccess, onPurchaseSuccess, purchaseLoading]);

  const handleIntroComplete = useCallback(() => setIsIntroComplete(true), []);

  useEffect(() => {
    const list = featureListRef.current;
    if (!list) return;

    const updateScrollHint = () => {
      const hasMore = list.scrollHeight > list.clientHeight + 4;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
      setShowFeatureScrollHint(hasMore && !atBottom);
    };

    updateScrollHint();
    list.addEventListener("scroll", updateScrollHint, { passive: true });
    window.addEventListener("resize", updateScrollHint);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollHint);
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", updateScrollHint);
      window.removeEventListener("resize", updateScrollHint);
      observer?.disconnect();
    };
  }, [isIntroComplete]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [handleClose]);

  const handlePurchase = async () => {
    if (currentPlan && currentPlan !== "free") {
      window.open(GOOGLE_PLAY_SUBSCRIPTIONS_URL, "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await purchase(getGooglePlaySku(selection.plan, selection.cycle));
      handleClose(true);
    } catch (error) {
      if (isGooglePlayPurchaseCancellation(error)) return;
      console.error("Google Play purchase failed:", error);
      showMessage(
        getGooglePlayErrorMessage(
          error,
          t("pricing.error.checkoutFailed"),
          t("pricing.error.clientAppUnavailable"),
        ),
        "error",
      );
    }
  };

  const content = (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-subscription-details-title"
      data-pricing-subscription-details
      data-tutorial-subscription-overlay
      className={cn(
        "subscription-details-overlay fixed inset-0 z-[10001] isolate overflow-hidden overscroll-none text-white",
        isClosing && "subscription-details-overlay--closing",
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 z-[2] size-[52rem] -translate-x-1/2 -translate-y-[73%]">
        <div
          className={cn(
            "subscription-details-intro-item subscription-details-intro-item--circle-core absolute inset-0 rounded-full bg-white",
            isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
          )}
          style={{ animationDelay: "0ms" }}
        />
      </div>

      <SubscriptionDetailsFrameAnimation isClosing={isClosing} onComplete={handleIntroComplete} plan={selection.plan} />

      <button
        type="button"
        disabled={purchaseLoading}
        onClick={() => handleClose()}
        className={cn(
          "subscription-details-intro-item absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 inline-flex size-11 items-center justify-center rounded-full bg-transparent text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95",
          isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
        )}
        style={{ animationDelay: "470ms", color: planColor }}
        aria-label={t("common.close")}
      >
        <X className="size-8" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <div className="subscription-details-shell relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col items-center overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.75rem,calc(env(safe-area-inset-top)+3.5rem))]">
        <div className="flex h-full min-h-0 w-full flex-col items-center">
          <h2 id="pricing-subscription-details-title" className="sr-only">
            {formatSuperWaterText(locale, t(`pricing.${selection.plan}`))}
          </h2>

          <div className="mx-auto flex w-full flex-none -translate-y-6 flex-col items-center">
            <div
              className={cn("subscription-details-intro-item", isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending")}
              style={{ animationDelay: "530ms" }}
            >
              <Image src={planImage.src} alt="" width={planImage.width} height={planImage.height} priority sizes="18rem" className="h-24 w-64 flex-none object-contain" />
            </div>
            <p
              className={cn(
                "subscription-details-intro-item mt-0 flex items-baseline justify-center gap-2 text-center font-display text-4xl font-semibold leading-none sm:text-5xl",
                usesSuperWater && "font-super-water",
                isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
              )}
              style={{ animationDelay: "590ms", color: planColor }}
            >
              <span>{price ?? "—"}</span>
              {price ? <span className="text-xl font-semibold sm:text-2xl">{period}</span> : null}
            </p>
          </div>

          <p
            className={cn(
              "subscription-details-intro-item mt-2 mb-0 w-full max-w-xl translate-y-[40px] px-4 text-center font-display text-xl font-semibold leading-tight text-white sm:text-2xl",
              usesSuperWater && "font-super-water",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "630ms" }}
          >
            {formatSuperWaterText(locale, t(selection.plan === "pro" ? "pricing.subscriptionDetailsTaglinePro" : "pricing.subscriptionDetailsTagline"))}
          </p>

          <div className="relative mt-0 mb-[60px] min-h-0 w-full max-w-xl flex-1 translate-y-15">
            <ul ref={featureListRef} className="flex h-full min-h-0 w-full flex-col overscroll-contain overflow-y-auto pb-0 pr-1">
              {selection.plan === "pro" ? (
                <>
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={650} index={1} icon={ScanText} locale={locale} text={t("pricing.featureUnlimitedTextTranslation")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={710} index={2} icon={MessageCircle} locale={locale} text={t("pricing.featureUnlimitedAiPractice")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={770} index={3} icon={Layers} locale={locale} text={t("pricing.featureCards")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={830} index={4} icon={BookOpen} locale={locale} text={t("pricing.featureLearned")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={890} index={5} icon={BookOpen} locale={locale} text={t("pricing.featureLearnedReview")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={950} index={6} icon={Palette} locale={locale} text={t("pricing.featureThemes")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={1010} index={7} icon={Gamepad2} locale={locale} text={t("pricing.featureGames")} />
                </>
              ) : (
                <>
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={650} index={1} icon={Layers} locale={locale} text={t("pricing.featureCards")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={710} index={2} icon={BookOpen} locale={locale} text={t("pricing.featureLearned")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={770} index={3} icon={BookOpen} locale={locale} text={t("pricing.featureLearnedReview")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={830} index={4} icon={Palette} locale={locale} text={t("pricing.featureThemes")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={890} index={5} icon={Gamepad2} locale={locale} text={t("pricing.featureGames")} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={950} index={6} icon={MessageCircle} locale={locale} text={t("pricing.featureAiDaily", { count: PLAN_LIMITS.basic.aiDailyMessages ?? 0 })} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={1010} index={7} icon={MessagesSquare} locale={locale} text={t("pricing.featureAiMonthly", { count: PLAN_LIMITS.basic.aiMonthlyMessages ?? 0 })} />
                  <SubscriptionDetailsFeature introVisible={isIntroComplete} introDelay={1070} index={8} icon={ScanText} locale={locale} text={t("pricing.featureUnlimitedTextTranslation")} unavailable />
                </>
              )}
            </ul>
            {showFeatureScrollHint ? (
              <span aria-hidden="true" className="pointer-events-none absolute bottom-[-1.25rem] left-1/2 inline-flex size-10 -translate-x-1/2 items-center justify-center text-white">
                <ChevronDown className="serious-learner-scroll-hint size-6" strokeWidth={2.75} />
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              "subscription-details-intro-item subscription-details-intro-item--cta mt-8 w-full max-w-xl shrink-0 -translate-y-3",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "1090ms" }}
          >
            {!user ? (
              <Link
                href={`/register?next=${encodeURIComponent("/pricing")}`}
                onClick={() => handleClose()}
                className={buttonClassName("primary", "lg", "flex h-16 w-full items-center justify-center rounded-full border-0 !bg-white !text-2xl hover:brightness-95")}
                style={{ color: planColor }}
              >
                <span className={cn("relative z-10", usesSuperWater && "font-super-water")}>{formatPricingCtaText(locale, ctaLabel)}</span>
              </Link>
            ) : isTwa ? (
              <Button
                type="button"
                disabled={purchaseLoading || !purchaseSupported || isClosing}
                className={cn("relative isolate h-16 w-full overflow-hidden rounded-full border-0 !bg-white !text-2xl hover:brightness-105", usesSuperWater && "font-super-water")}
                onClick={() => void handlePurchase()}
              >
                <span className="relative z-10" style={{ color: planColor }}>
                  {purchaseLoading
                    ? t("common.loading")
                    : formatPricingCtaText(locale, currentPlan && currentPlan !== "free" ? t("pricing.ctaManage") : ctaLabel)}
                </span>
              </Button>
            ) : (
              <a
                href={currentPlan && currentPlan !== "free" ? GOOGLE_PLAY_SUBSCRIPTIONS_URL : `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName("primary", "lg", "flex h-16 w-full items-center justify-center rounded-full border-0 !bg-white !text-2xl hover:brightness-95")}
                style={{ color: planColor }}
              >
                <span className={cn("relative z-10", usesSuperWater && "font-super-water")}>
                  {formatPricingCtaText(locale, currentPlan && currentPlan !== "free" ? t("pricing.ctaManage") : ctaLabel)}
                </span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  return typeof document === "undefined" ? null : createPortal(content, document.body);
}

function SubscriptionDetailsFrameAnimation({
  isClosing,
  onComplete,
  plan,
}: {
  isClosing: boolean;
  onComplete: () => void;
  plan: Exclude<SubscriptionPlan, "free">;
}) {
  const [frameIndex, setFrameIndex] = useState(1);
  const frameIndexRef = useRef(1);
  const frameBasePath = FRAME_BASE_PATH[plan];

  useEffect(() => {
    let cancelled = false;
    let frameId: number | null = null;
    const frameDuration = 1000 / FRAME_FPS;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const images = Array.from({ length: FRAME_COUNT }, (_, index) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = `${frameBasePath}/${index + 1}.png`;
      return image;
    });

    if (prefersReducedMotion) {
      frameId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        frameIndexRef.current = FRAME_COUNT;
        setFrameIndex(FRAME_COUNT);
        onComplete();
      });
      return () => {
        cancelled = true;
        images.forEach((image) => {
          image.onload = null;
          image.onerror = null;
        });
      };
    }

    const startedAt = window.performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const next = Math.min(FRAME_COUNT, Math.floor((now - startedAt) / frameDuration) + 1);
      if (next !== frameIndexRef.current) {
        frameIndexRef.current = next;
        setFrameIndex(next);
      }
      if (next === FRAME_COUNT) onComplete();
      if (next < FRAME_COUNT) frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, [frameBasePath, onComplete]);

  return (
    <div aria-hidden="true" className={cn("subscription-details-frame-layer", plan === "pro" && "subscription-details-frame-layer--pro", isClosing && "subscription-details-frame-layer--closing")}>
      {/* This frame strip is intentionally swapped at 45 FPS; optimizing each frame would add request latency. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${frameBasePath}/${frameIndex}.png`} alt="" draggable={false} style={{ filter: "none" }} />
    </div>
  );
}

function SubscriptionDetailsFeature({
  unavailable = false,
  introVisible,
  introDelay,
  index,
  icon: Icon,
  locale,
  text,
}: {
  unavailable?: boolean;
  introVisible: boolean;
  introDelay: number;
  index: number;
  icon: LucideIcon;
  locale: LocaleCode;
  text: string;
}) {
  return (
    <li
      data-pricing-details-feature={index}
      className={cn(
        "subscription-details-feature subscription-details-intro-item flex min-h-12 flex-1 items-center gap-3 px-4 py-2 text-left text-lg font-semibold leading-tight text-white sm:text-xl",
        unavailable && "opacity-45 line-through",
        introVisible ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
      )}
      style={{ animationDelay: `${introDelay}ms` }}
    >
      <Icon className="size-6 shrink-0 text-white" strokeWidth={2.4} aria-hidden="true" />
      <span className={cn(canUseSuperWater(locale) && "font-super-water")}>{formatSuperWaterText(locale, text)}</span>
    </li>
  );
}

function getPlanPrice({
  plan,
  cycle,
  localizedPricing,
  googlePlayPricing,
  locale,
  isTwa,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  locale: string;
  isTwa: boolean;
}) {
  const playPrice = getGooglePlayPricingDetails(googlePlayPricing, plan, cycle);
  if (playPrice) {
    const amount = Number.parseFloat(playPrice.price.value);
    return formatCurrency(amount, playPrice.price.currency, locale);
  }

  const localized = getLocalizedPrice(localizedPricing, plan, cycle);
  if (localized) return formatCurrency(localized.amount, localized.currencyCode, locale);

  const usdPrice = isTwa
    ? plan === "basic" ? (cycle === "yearly" ? 20 : 2) : (cycle === "yearly" ? 60 : 6)
    : plan === "basic" ? (cycle === "yearly" ? 30 : 3) : (cycle === "yearly" ? 90 : 9);
  return `$${usdPrice}`;
}

function formatPricingCtaText(locale: LocaleCode, text: string) {
  return canUseSuperWater(locale) ? formatSuperWaterUppercaseText(locale, text) : text;
}
