"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import Image from "next/image";
import {
  BookOpen,
  ChevronDown,
  Gamepad2,
  Layers,
  MessageCircle,
  Palette,
  RotateCcw,
  ScanText,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { SuperWaterText } from "@/components/super-water-text";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  useGooglePlayPricing,
} from "@/features/subscriptions/use-google-play-pricing";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
} from "@/features/subscriptions/components/use-localized-pricing";
import {
  PLANS,
  TWA_PLANS,
} from "@/features/subscriptions/components/pricing-page";
import { SubscriptionDetailsFrameAnimation } from "@/features/subscriptions/components/subscription-details-animation";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { useAppMessage } from "@/components/app-message-provider";
import {
  SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS,
  SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS,
  SERIOUS_LEARNER_EXIT_STAGGER_MS,
  startSeriousLearnerExitAnimations,
} from "@/features/auth/serious-learner-animation";

const SERIOUS_LEARNER_BASIC_COLOR = "#2C63E1";

type SeriousLearnerAnimationStyle = CSSProperties & {
  "--serious-learner-background-exit-delay"?: string;
  "--serious-learner-blue-exit-delay"?: string;
  "--serious-learner-exit-delay"?: string;
};

function getExitItemStyle(order: number): SeriousLearnerAnimationStyle {
  return {
    "--serious-learner-exit-delay": `${order * SERIOUS_LEARNER_EXIT_STAGGER_MS}ms`,
  };
}

interface MobileSubscriptionOfferScreenProps {
  onContinueFree: () => void;
  isTestMode?: boolean;
  isClosing?: boolean;
}

export function MobileSubscriptionOfferScreen({
  onContinueFree,
  isTestMode = false,
  isClosing = false,
}: MobileSubscriptionOfferScreenProps) {
  const t = useT();
  const { locale } = useLocale();
  const isTwa = useTwaMode();
  const localizedPricing = useLocalizedPricing(null, isTwa);
  const googlePlayPricing = useGooglePlayPricing();
  const { purchase, isLoading: isGooglePlayLoading, isSupported } = useGooglePlayBilling();
  const { showMessage } = useAppMessage();
  const [showFeatureScrollHint, setShowFeatureScrollHint] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const featureListRef = useRef<HTMLUListElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  const handleIntroComplete = useCallback(() => setIsIntroComplete(true), []);

  useEffect(() => {
    if (!isClosing || !screenRef.current) return;

    const root = screenRef.current;
    const animations = startSeriousLearnerExitAnimations(root);
    return () => {
      animations.forEach((animation) => animation.cancel());
      delete root.dataset.seriousLearnerWaapi;
    };
  }, [isClosing]);

  const updateFeatureScrollHint = useCallback(() => {
    const list = featureListRef.current;
    if (!list) return;

    const hasMoreContent = list.scrollHeight > list.clientHeight + 4;
    const isAtBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
    setShowFeatureScrollHint(hasMoreContent && !isAtBottom);
  }, []);

  useEffect(() => {
    const list = featureListRef.current;
    if (!list) return;

    updateFeatureScrollHint();
    list.addEventListener("scroll", updateFeatureScrollHint, { passive: true });
    window.addEventListener("resize", updateFeatureScrollHint);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(updateFeatureScrollHint);
    resizeObserver?.observe(list);

    return () => {
      list.removeEventListener("scroll", updateFeatureScrollHint);
      window.removeEventListener("resize", updateFeatureScrollHint);
      resizeObserver?.disconnect();
    };
  }, [updateFeatureScrollHint]);

  const plans = isTwa ? TWA_PLANS : PLANS;
  const basicPlan = plans.find((item) => item.plan === "basic");
  const fallbackPrice = basicPlan?.monthlyPrice;
  const googlePlayDetails = getGooglePlayPricingDetails(googlePlayPricing, "basic", "monthly");
  const localized = getLocalizedPrice(localizedPricing, "basic", "monthly");

  const priceDisplay = useMemo(() => {
    if (googlePlayDetails) {
      const amount = Number.parseFloat(googlePlayDetails.price.value);
      return formatCurrency(amount, googlePlayDetails.price.currency, locale);
    }

    if (localized) {
      return formatCurrency(localized.amount, localized.currencyCode, locale);
    }

    return fallbackPrice != null ? `$${fallbackPrice}` : "";
  }, [fallbackPrice, googlePlayDetails, localized, locale]);

  async function handlePurchase() {
    if (isTestMode) {
      showMessage(t("pricing.purchaseSuccessDescription"), "success");
      onContinueFree();
      return;
    }

    if (isTwa || isSupported) {
      try {
        await purchase(getGooglePlaySku("basic", "monthly"));
        showMessage(t("pricing.purchaseSuccessDescription"), "success");
        onContinueFree();
      } catch (error) {
        showMessage(
          getGooglePlayErrorMessage(
            error,
            t("pricing.error.checkoutFailed"),
            t("pricing.error.clientAppUnavailable"),
          ),
          "error",
        );
      }
      return;
    }

    window.location.assign(
      `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`,
    );
  }

  const isLoading = isGooglePlayLoading;
  const usesSuperWater = canUseSuperWater(locale);

  return (
    <div
      ref={screenRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("pricing.seriousLearner")}
      aria-hidden={isClosing}
      data-gateway-flow-screen
      data-mobile-subscription-offer
      style={{
        "--serious-learner-background-exit-delay": `${SERIOUS_LEARNER_BACKGROUND_EXIT_DELAY_MS}ms`,
        "--serious-learner-blue-exit-delay": `${SERIOUS_LEARNER_BLUE_BACKGROUND_EXIT_DELAY_MS}ms`,
      } as SeriousLearnerAnimationStyle}
      className={cn(
        "subscription-details-overlay relative h-full min-h-0 w-full max-w-none overflow-hidden bg-transparent text-center text-white",
        isClosing && "pointer-events-none",
        isClosing && "serious-learner-offer--closing",
      )}
    >
      <div
        aria-hidden="true"
        className="serious-learner-offer-circle pointer-events-none absolute left-1/2 z-[2] size-[52rem]"
      >
        <div
          className={cn(
            "subscription-details-intro-item subscription-details-intro-item--circle-core absolute inset-0 rounded-full bg-white",
            isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
          )}
          style={{ animationDelay: "0ms" }}
        />
      </div>

      <SubscriptionDetailsFrameAnimation
        isClosing={isClosing}
        onComplete={handleIntroComplete}
        plan="basic"
      />

      <div
        className={cn(
          "subscription-details-shell relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col items-center overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.75rem,calc(env(safe-area-inset-top)+3.5rem))]",
        )}
      >
        <div className="flex h-full min-h-0 w-full translate-y-[30px] flex-col items-center">
          <div className="mx-auto flex w-full flex-none -translate-y-[62px] flex-col items-center">
            <div
              className={cn(
                "subscription-details-intro-item",
                isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
              )}
              data-serious-learner-exit-item
              style={{ animationDelay: "530ms", ...getExitItemStyle(0) }}
            >
              <Image
                src="/subscriptions/serious-learner-basic-v2.webp"
                alt=""
                width={1254}
                height={1254}
                priority
                sizes="18rem"
                className="h-40 w-80 flex-none -translate-y-9 object-contain"
              />
            </div>

          </div>

          <p
            className={cn(
              "subscription-details-intro-item relative -top-[57px] mt-1 w-[calc(100%+2rem)] whitespace-normal text-balance text-center text-[clamp(1.2rem,7.5vw,2.5rem)] font-semibold leading-tight text-white",
              usesSuperWater && "font-super-water",
            isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
          )}
            data-serious-learner-exit-item
            style={{ animationDelay: "630ms", ...getExitItemStyle(1) }}
          >
            {formatSuperWaterText(locale, t("pricing.startWithPremium"))}
          </p>

          <div className="relative mt-0 min-h-0 w-full max-w-xl flex-1 -translate-y-[43px]">
            <ul
              ref={featureListRef}
              onScroll={updateFeatureScrollHint}
              className="h-[calc(100%_+_19px)] min-h-0 w-full overscroll-contain overflow-y-auto pb-12 pr-1 pt-0"
            >
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={650} exitOrder={2} icon={Layers} locale={locale} text={t("pricing.featureCards")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={710} exitOrder={3} icon={BookOpen} locale={locale} text={t("pricing.featureLearned")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={770} exitOrder={4} icon={RotateCcw} locale={locale} text={t("pricing.featureLearnedReview")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={830} exitOrder={5} icon={Palette} locale={locale} text={t("pricing.featureThemes")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={890} exitOrder={6} icon={Gamepad2} locale={locale} text={t("pricing.featureGames")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={950} exitOrder={7} icon={MessageCircle} locale={locale} text={t("pricing.featureAiPractice")} />
              <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={1010} exitOrder={8} icon={ScanText} locale={locale} text={t("pricing.featureUnlimitedTextTranslation")} unavailable />
            </ul>
            {showFeatureScrollHint ? (
              <span
                aria-hidden="true"
                className={cn(
                  "subscription-details-intro-item pointer-events-none absolute bottom-[-45px] left-1/2 inline-flex size-10 -translate-x-1/2 items-center justify-center text-white",
                  isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
                )}
                data-serious-learner-exit-item
                style={{ animationDelay: "1070ms", ...getExitItemStyle(9) }}
              >
                <ChevronDown className="serious-learner-scroll-hint size-6" strokeWidth={2.75} />
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              "subscription-details-intro-item subscription-details-intro-item--cta mt-8 w-full max-w-xl shrink-0 -translate-y-3",
            isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            data-serious-learner-exit-item
            style={{ animationDelay: "1090ms", ...getExitItemStyle(10) }}
          >
            <p
              data-serious-learner-price-message
              className={cn(
                "mb-3 w-full text-center text-[clamp(1rem,4.8vw,1.35rem)] font-semibold leading-tight text-white",
                usesSuperWater && "font-super-water",
              )}
            >
              {formatSuperWaterText(locale, t("pricing.seriousLearnerPriceMessage"))}
            </p>
            <Button
              type="button"
              size="lg"
              onClick={handlePurchase}
              disabled={isLoading || (isTwa && !isSupported)}
              className={cn(
                "flex h-16 w-full flex-col gap-1 rounded-full border-0 !bg-white !text-2xl leading-none hover:brightness-95",
                usesSuperWater && "font-super-water",
              )}
              style={{ color: SERIOUS_LEARNER_BASIC_COLOR }}
            >
              {isLoading ? (
                <SuperWaterText>{t("common.loading")}</SuperWaterText>
              ) : (
                <>
                  <span>{formatSuperWaterUppercaseText(locale, t("pricing.ctaStartFirstMonthFreeTrial"))}</span>
                  {priceDisplay ? (
                    <span className="text-sm font-semibold leading-none">
                      {formatSuperWaterText(locale, t("pricing.ctaTrialAfter", { price: priceDisplay }))}
                    </span>
                  ) : null}
                </>
              )}
            </Button>

            {isTwa && !isSupported ? (
              <p className="mt-2 text-center text-xs text-foreground-muted">
                {t("pricing.googlePlayUnavailable")}
              </p>
            ) : null}

            <button
              type="button"
              onClick={onContinueFree}
              className={buttonClassName(
                "ghost",
                "lg",
                "mt-3 h-12 w-full text-xl font-semibold text-white hover:text-white",
              )}
            >
              {t("pricing.ctaSkip")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeriousLearnerOfferFeature({
  introVisible,
  introDelay,
  exitOrder,
  icon: Icon,
  locale,
  text,
  unavailable,
}: {
  introVisible: boolean;
  introDelay: number;
  exitOrder: number;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  locale: Parameters<typeof formatSuperWaterText>[0];
  text: string;
  unavailable?: boolean;
}) {
  return (
    <li
      className={cn(
        "subscription-details-feature subscription-details-intro-item flex min-h-12 items-center gap-3 px-4 py-2 text-left text-lg font-semibold leading-tight text-white sm:text-xl",
        unavailable && "opacity-45 line-through",
        introVisible ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
      )}
      data-serious-learner-exit-item
      style={{ animationDelay: `${introDelay}ms`, ...getExitItemStyle(exitOrder) }}
    >
      <Icon className="size-6 shrink-0 text-white" strokeWidth={2.4} aria-hidden="true" />
      <span className={cn(canUseSuperWater(locale) && "font-super-water")}>
        {formatSuperWaterText(locale, text)}
      </span>
    </li>
  );
}
