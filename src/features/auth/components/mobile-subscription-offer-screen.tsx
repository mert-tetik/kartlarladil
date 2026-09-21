"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import Image from "next/image";
import {
  BookOpen,
  ChevronDown,
  Gamepad2,
  Headset,
  Layers,
  MessageCircle,
  MessagesSquare,
  Palette,
  ScanText,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  useGooglePlayPricing,
} from "@/features/subscriptions/use-google-play-pricing";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
} from "@/features/subscriptions/components/use-localized-pricing";
import {
  PLANS,
  TWA_PLANS,
} from "@/features/subscriptions/components/pricing-page";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { useAppMessage } from "@/components/app-message-provider";

const SERIOUS_LEARNER_FRAME_COUNT = 50;
const SERIOUS_LEARNER_FRAME_FPS = 30;
const SERIOUS_LEARNER_FRAME_BASE_PATH = "/serious-learner-offer-frames-v4";
const SERIOUS_LEARNER_BASIC_COLOR = "#F4A300";

interface MobileSubscriptionOfferScreenProps {
  onContinueFree: () => void;
  isTestMode?: boolean;
}

export function MobileSubscriptionOfferScreen({
  onContinueFree,
  isTestMode = false,
}: MobileSubscriptionOfferScreenProps) {
  const t = useT();
  const { locale } = useLocale();
  const { presentPurchaseSuccess } = useSubscription();
  const isTwa = useTwaMode();
  const localizedPricing = useLocalizedPricing(null, isTwa);
  const googlePlayPricing = useGooglePlayPricing();
  const { purchase, isLoading: isGooglePlayLoading, isSupported } = useGooglePlayBilling();
  const { showMessage } = useAppMessage();
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const [showFeatureScrollHint, setShowFeatureScrollHint] = useState(false);
  const featureListRef = useRef<HTMLUListElement>(null);
  const handleIntroComplete = useCallback(() => setIsIntroComplete(true), []);

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
  }, [isIntroComplete, updateFeatureScrollHint]);

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
      presentPurchaseSuccess();
      onContinueFree();
      return;
    }

    if (isTwa) {
      try {
        await purchase(getGooglePlaySku("basic", "monthly"));
        presentPurchaseSuccess();
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
  const period = t("pricing.perMonth");

  return (
    <div
      data-mobile-subscription-offer
      className="relative h-full min-h-0 w-full max-w-none overflow-hidden bg-[#070707] text-center text-white"
    >
      <SeriousLearnerOfferFrameAnimation onComplete={handleIntroComplete} />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 z-[2] size-[52rem] -translate-x-1/2 -translate-y-[78%]"
      >
        <div
          className={cn(
            "subscription-details-intro-item subscription-details-intro-item--circle-core absolute inset-0 rounded-full bg-white",
            isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
          )}
          style={{ animationDelay: "0ms" }}
        />
      </div>

      <div
        className={cn(
          "subscription-details-shell relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col items-center overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(4.75rem,calc(env(safe-area-inset-top)+3.5rem))]",
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-col items-center">
          <div className="mx-auto flex w-full flex-none -translate-y-8 flex-col items-center">
            <div
              className={cn(
                "subscription-details-intro-item",
                isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
              )}
              style={{ animationDelay: "530ms" }}
            >
              <Image
                src="/subscriptions/serious-learner-basic.png"
                alt=""
                width={1254}
                height={1254}
                priority
                sizes="18rem"
                className="h-40 w-80 flex-none -translate-y-9 object-contain"
              />
            </div>

            <p
              className={cn(
                "subscription-details-intro-item mt-0 flex items-baseline justify-center gap-2 text-center font-display text-4xl font-semibold leading-none sm:text-5xl",
                usesSuperWater && "font-super-water",
                isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
              )}
              style={{ animationDelay: "590ms", color: SERIOUS_LEARNER_BASIC_COLOR }}
            >
              <span>{priceDisplay || "—"}</span>
              {priceDisplay ? <span className="text-xl font-semibold sm:text-2xl">{period}</span> : null}
            </p>
          </div>

          <h1
            className={cn(
              "subscription-details-intro-item relative -top-28 mt-12 w-[calc(100%+4rem)] whitespace-nowrap text-center text-[clamp(1.2rem,7vw,2.25rem)] font-semibold leading-tight",
              usesSuperWater && "font-super-water",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "650ms", color: "#ffffff" }}
          >
            {formatSuperWaterText(locale, t("pricing.seriousLearner"))}
          </h1>

          <p
            className={cn(
              "subscription-details-intro-item relative -top-28 mt-1 w-[calc(100%+4rem)] whitespace-nowrap text-center text-[clamp(1.35rem,8vw,2.75rem)] font-semibold leading-tight text-white",
              usesSuperWater && "font-super-water",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "690ms" }}
          >
            {formatSuperWaterText(locale, t("pricing.startWithPremium"))}
          </p>

          <div className="relative -mt-24 min-h-0 w-full max-w-xl flex-1">
            <ul
              ref={featureListRef}
              onScroll={updateFeatureScrollHint}
              className="h-full min-h-0 w-full overscroll-contain overflow-y-auto pb-12 pr-1"
            >
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={690} icon={Layers} locale={locale} text={t("pricing.featureCards")} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={750} icon={BookOpen} locale={locale} text={t("pricing.featureLearned")} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={810} icon={BookOpen} locale={locale} text={t("pricing.featureLearnedReview")} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={870} icon={Palette} locale={locale} text={t("pricing.featureThemes")} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={930} icon={Gamepad2} locale={locale} text={t("pricing.featureGames")} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={990} icon={MessageCircle} locale={locale} text={t("pricing.featureAiDaily", { count: PLAN_LIMITS.basic.aiDailyMessages ?? 0 })} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={1050} icon={MessagesSquare} locale={locale} text={t("pricing.featureAiMonthly", { count: PLAN_LIMITS.basic.aiMonthlyMessages ?? 0 })} />
            <SeriousLearnerOfferFeature introVisible={isIntroComplete} introDelay={1110} icon={ScanText} locale={locale} text={t("pricing.featureUnlimitedTextTranslation")} unavailable />
            </ul>
            {showFeatureScrollHint ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[-1.25rem] left-1/2 inline-flex size-10 -translate-x-1/2 items-center justify-center text-white"
              >
                <ChevronDown className="serious-learner-scroll-hint size-6" strokeWidth={2.75} />
              </span>
            ) : null}
          </div>

          <div
            className={cn(
              "subscription-details-intro-item mt-8 w-full max-w-xl shrink-0",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "1110ms" }}
          >
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
                t("common.loading")
              ) : isTestMode ? (
                <>
                  <span>{formatSuperWaterUppercaseText(locale, t("pricing.ctaStartFirstMonthFreeTrial"))}</span>
                  {priceDisplay ? (
                    <span className="text-sm font-semibold leading-none">
                      {formatSuperWaterText(locale, t("pricing.ctaTrialAfter", { price: priceDisplay, period })).replace(/\s+(?=\/)/g, "")}
                    </span>
                  ) : null}
                </>
              ) : (
                t("pricing.ctaUpgrade")
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

function SeriousLearnerOfferFrameAnimation({ onComplete }: { onComplete: () => void }) {
  const [frameIndex, setFrameIndex] = useState(1);
  const frameIndexRef = useRef(1);

  useEffect(() => {
    let cancelled = false;
    let animationFrameId: number | null = null;
    const frameDuration = 1000 / SERIOUS_LEARNER_FRAME_FPS;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const preloadFrames = Array.from({ length: SERIOUS_LEARNER_FRAME_COUNT }, (_, index) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = `${SERIOUS_LEARNER_FRAME_BASE_PATH}/${index + 1}.png`;
      return image;
    });

    if (prefersReducedMotion) {
      frameIndexRef.current = SERIOUS_LEARNER_FRAME_COUNT;
      setFrameIndex(SERIOUS_LEARNER_FRAME_COUNT);
      onComplete();
      return () => {
        cancelled = true;
        preloadFrames.forEach((image) => {
          image.onload = null;
          image.onerror = null;
        });
      };
    }

    const startedAt = window.performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const nextFrame = Math.min(
        SERIOUS_LEARNER_FRAME_COUNT,
        Math.floor((now - startedAt) / frameDuration) + 1,
      );

      if (nextFrame !== frameIndexRef.current) {
        frameIndexRef.current = nextFrame;
        setFrameIndex(nextFrame);
      }

      if (nextFrame === SERIOUS_LEARNER_FRAME_COUNT) {
        onComplete();
      } else {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [onComplete]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      <img
        src={`${SERIOUS_LEARNER_FRAME_BASE_PATH}/${frameIndex}.png`}
        alt=""
        draggable={false}
        className="block h-full w-full object-cover"
      />
    </div>
  );
}

function SeriousLearnerOfferFeature({
  introVisible,
  introDelay,
  icon: Icon,
  locale,
  text,
  unavailable,
}: {
  introVisible: boolean;
  introDelay: number;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  locale: Parameters<typeof formatSuperWaterText>[0];
  text: string;
  unavailable?: boolean;
}) {
  return (
    <li
      className={cn(
        "subscription-details-feature subscription-details-intro-item flex min-h-12 items-center gap-3 px-4 py-2 text-left text-base font-semibold leading-tight text-white sm:text-lg",
        unavailable && "opacity-45 line-through",
        introVisible ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
      )}
      style={{ animationDelay: `${introDelay}ms` }}
    >
      <Icon className="size-6 shrink-0 text-white" strokeWidth={2.4} aria-hidden="true" />
      <span className={cn(canUseSuperWater(locale) && "font-super-water")}>
        {formatSuperWaterText(locale, text)}
      </span>
    </li>
  );
}
