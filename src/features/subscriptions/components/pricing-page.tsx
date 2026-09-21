"use client";

import { useActionState, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  MessageCircle,
  MessagesSquare,
  Headset,
  Layers,
  Palette,
  ScanText,
  X,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import { createCustomerPortalAction } from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import {
  getGooglePlayErrorMessage,
  isGooglePlayPurchaseCancellation,
} from "@/features/subscriptions/google-play-errors";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  useGooglePlayPricing,
  type GooglePlayPricingStatus,
  type BillingCycle as GooglePlayBillingCycle,
} from "@/features/subscriptions/use-google-play-pricing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { TWA_PACKAGE_NAME } from "@/features/install-app/twa-mode";
import { GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@/features/subscriptions/google-play-links";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { playSoundEffect } from "@/lib/sound-effects";
import { useAppMessage } from "@/components/app-message-provider";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
  type LocalizedPricingStatus,
} from "@/features/subscriptions/components/use-localized-pricing";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { LocaleCode, SubscriptionPlan } from "@/types/domain";

type BillingCycle = GooglePlayBillingCycle;

interface PricingPageProps {
  user: AuthShellUser | null;
  currencyCode: string | null;
}

export interface PricingPlan {
  plan: SubscriptionPlan;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  popular?: boolean;
  mascot?: string;
}

const MOBILE_PLAN_ORDER_CLASSNAME: Record<SubscriptionPlan, string> = {
  basic: "order-1 md:order-none",
  free: "order-2 md:order-none",
  pro: "order-3 md:order-none",
};

const PRICING_CARD_CTA_CLASS = "h-12 whitespace-nowrap text-sm";
const PRICING_GRADIENT_BUTTON_CLASS =
  "bg-gradient-to-r from-[var(--premium-start)] via-[var(--reward-start)] to-[var(--premium-end)] !text-slate-950 hover:brightness-105";
const PRICING_PURCHASE_BUTTON_CLASS =
  "relative isolate overflow-hidden !bg-transparent !text-white hover:brightness-105";
const PRICING_PURCHASE_CTA_CLASS = "h-16 !text-2xl";

const PRICING_ACTIVE_BUTTON_IMAGE = "/pricing-buttons/pricing-active-button-v2.png";
const PRICING_PLAN_BUTTON_IMAGES: Record<Exclude<SubscriptionPlan, "free">, { src: string; width: number; height: number }> = {
  basic: {
    src: "/subscriptions/plan-basic-v2.png",
    width: 1489,
    height: 450,
  },
  pro: {
    src: "/subscriptions/plan-pro-v2.png",
    width: 1338,
    height: 511,
  },
};
const PRICING_PLAN_BUTTON_BACKGROUND_IMAGES: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "/pricing-buttons/pricing-pro-basic-button-v2.png",
  pro: "/pricing-buttons/pricing-pro-active-button-v2.png",
};

const ACTIVE_SUBSCRIPTION_SURFACE_CLASS: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "bg-gradient-to-t from-[#173b91] to-[#2563eb]",
  pro: "bg-gradient-to-t from-[#4c1d95] to-[#9333ea]",
};

const ACTIVE_SUBSCRIPTION_BUTTON_CLASS: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "!bg-white !text-[#2563eb] hover:!bg-blue-50",
  pro: "!bg-white !text-[#9333ea] hover:!bg-purple-50",
};

const SUBSCRIPTION_PLAN_COLOR: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "#2563eb",
  pro: "#9333ea",
};

const SUBSCRIPTION_DETAILS_FRAME_COUNT = 50;
const SUBSCRIPTION_DETAILS_FRAME_FPS = 30;
const SUBSCRIPTION_DETAILS_FRAME_BASE_PATH = "/pricing-subscription-menu-frames-v2";
const SUBSCRIPTION_DETAILS_PRO_FRAME_BASE_PATH = "/pricing-subscription-menu-pro-frames-v2";

type CheckoutSelection = {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  ctaLabel?: string;
};

export const PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null, mascot: "/mascots/mascot14.webp" },
  { plan: "basic", monthlyPrice: 3, yearlyPrice: 30, mascot: "/mascots/mascot15.webp" },
  { plan: "pro", monthlyPrice: 9, yearlyPrice: 90, popular: true, mascot: "/mascots/mascot16.webp" },
];

export const TWA_PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null, mascot: "/mascots/mascot14.webp" },
  { plan: "basic", monthlyPrice: 2, yearlyPrice: 20, mascot: "/mascots/mascot15.webp" },
  { plan: "pro", monthlyPrice: 6, yearlyPrice: 60, popular: true, mascot: "/mascots/mascot16.webp" },
];

export function getReferenceUsdPrice(
  plan: SubscriptionPlan,
  cycle: BillingCycle,
  isTwa: boolean,
): number | null {
  const sourcePlans = isTwa ? TWA_PLANS : PLANS;
  const sourcePlan = sourcePlans.find((item) => item.plan === plan);
  if (!sourcePlan) return null;
  return cycle === "yearly" ? sourcePlan.yearlyPrice : sourcePlan.monthlyPrice;
}

export function PricingPage({ user, currencyCode }: PricingPageProps) {
  const t = useT();
  const { locale } = useLocale();
  const { entitlements } = useSubscription();
  const searchParams = useSearchParams();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [checkoutSelection, setCheckoutSelection] = useState<CheckoutSelection | null>(null);
  const isTwa = useTwaMode();
  const localizedPricing = useLocalizedPricing(currencyCode, isTwa);
  const googlePlayPricing = useGooglePlayPricing();
  const plans = isTwa ? TWA_PLANS : PLANS;
  const forceFreePricing = searchParams.get("pricing-test") === "free";
  const pricingEntitlements = forceFreePricing ? null : entitlements;
  const paidPlan = pricingEntitlements?.effectivePlan === "basic" || pricingEntitlements?.effectivePlan === "pro"
    ? pricingEntitlements.effectivePlan
    : null;

  useLayoutEffect(() => {
    if (paidPlan || typeof window === "undefined") return;

    const page = document.querySelector<HTMLElement>("[data-pricing-page]");
    if (!page) return;

    let frameId: number | null = null;
    let pollUntil = 0;

    const syncHeadingPosition = () => {
      const navigation = document.querySelector<HTMLElement>("[data-route-transition-navigation]");
      const mobileView = page.querySelector<HTMLElement>("[data-pricing-mobile-view]");
      const heading = page.querySelector<HTMLElement>("[data-pricing-heading-mobile]");
      const perkCard = page.querySelector<HTMLElement>("[data-pricing-perk-card][data-highlighted='true']");
      if (!navigation || !mobileView || !heading || !perkCard) return;

      const navigationBottom = navigation.getBoundingClientRect().bottom;
      const perkTop = perkCard.getBoundingClientRect().top;
      const mobileViewRect = mobileView.getBoundingClientRect();
      const mobileViewScaleY = mobileView.offsetHeight > 0
        ? mobileViewRect.height / mobileView.offsetHeight
        : 1;
      const safeScaleY = Number.isFinite(mobileViewScaleY) && mobileViewScaleY > 0
        ? mobileViewScaleY
        : 1;

      heading.style.top = `${(navigationBottom - mobileViewRect.top) / safeScaleY}px`;
      heading.style.height = `${Math.max(0, (perkTop - navigationBottom) / safeScaleY)}px`;
      heading.style.transform = "none";
    };

    const pollDuringLayoutChange = () => {
      frameId = null;
      syncHeadingPosition();
      if (window.performance.now() < pollUntil) {
        frameId = window.requestAnimationFrame(pollDuringLayoutChange);
      }
    };

    const scheduleSync = () => {
      pollUntil = window.performance.now() + 700;
      if (frameId === null) {
        frameId = window.requestAnimationFrame(pollDuringLayoutChange);
      }
    };

    syncHeadingPosition();
    scheduleSync();
    window.addEventListener("resize", scheduleSync);
    window.visualViewport?.addEventListener("resize", scheduleSync);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleSync);
    resizeObserver?.observe(page);

    const mutationObserver = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(scheduleSync);
    mutationObserver?.observe(page, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-highlighted"],
    });

    return () => {
      window.removeEventListener("resize", scheduleSync);
      window.visualViewport?.removeEventListener("resize", scheduleSync);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [paidPlan]);

  return (
    <div
      data-pricing-page
      className={cn(
        "relative isolate mx-auto min-h-screen max-w-6xl px-4 pb-0 pt-12 max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:min-h-0 max-lg:overflow-hidden max-lg:p-0 sm:px-6 lg:px-8 lg:pb-10",
        paidPlan && ACTIVE_SUBSCRIPTION_SURFACE_CLASS[paidPlan],
      )}
    >
      {!paidPlan ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 bg-[#121212]"
          />
        </>
      ) : null}
      {!paidPlan ? (
        <div
          className="relative z-20 mx-auto hidden w-full text-center lg:block lg:sticky lg:top-[var(--app-header-height)]"
          data-pricing-heading
          data-route-transition-surface
        >
          <PricingHeading locale={locale} />
        </div>
      ) : null}
      {paidPlan ? (
        <ActiveSubscriptionPricingView plan={paidPlan} locale={locale} />
      ) : (
        <>
          <div className="h-full lg:hidden">
            <MobilePricingView
              user={user}
              isTwa={isTwa}
              localizedPricing={localizedPricing}
              googlePlayPricing={googlePlayPricing}
              entitlements={pricingEntitlements}
              locale={locale}
              forceFirstMonthFree={forceFreePricing}
              onRequestCheckout={setCheckoutSelection}
            />
          </div>

          <div className="hidden animate-screen-pop lg:block">
        <div className="relative z-10 mt-8 hidden justify-center" data-route-transition-surface>
          <BillingCycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <div className="relative z-10 mt-8 grid gap-6 md:grid-cols-3">
          {plans.map((item) => (
            <PricingCard
              key={item.plan}
              plan={item.plan}
              monthlyPrice={item.monthlyPrice}
              yearlyPrice={item.yearlyPrice}
              popular={item.popular}
              mascot={item.mascot}
              cycle={cycle}
              currentPlan={pricingEntitlements?.effectivePlan ?? null}
              user={user}
              localizedPricing={localizedPricing}
              googlePlayPricing={googlePlayPricing}
              uiLocale={locale}
              isTwa={isTwa}
              forceFirstMonthFree={forceFreePricing}
              containerClassName={MOBILE_PLAN_ORDER_CLASSNAME[item.plan]}
              onRequestCheckout={setCheckoutSelection}
            />
          ))}
        </div>

        <div className="relative z-10">
          <PaymentProviderNotes />
        </div>
        <p className="relative z-10 mx-auto mt-6 max-w-2xl text-center text-sm text-foreground-muted">
          {t("pricing.contactEmail")}
        </p>
        <ConsentText />
          </div>
        </>
      )}
      {checkoutSelection ? (
        <SubscriptionDetailsOverlay
          selection={checkoutSelection}
          user={user}
          currentPlan={pricingEntitlements?.effectivePlan ?? null}
          isTwa={isTwa}
          localizedPricing={localizedPricing}
          googlePlayPricing={googlePlayPricing}
          locale={locale}
          onClose={() => setCheckoutSelection(null)}
        />
      ) : null}
    </div>
  );
}

function ActiveSubscriptionPricingView({
  plan,
  locale,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  locale: LocaleCode;
}) {
  const t = useT();
  const planImage = plan === "basic"
    ? { src: "/subscriptions/plan-basic-v2.png", width: 1489, height: 450 }
    : { src: "/subscriptions/plan-pro-v2.png", width: 1338, height: 511 };
  const usesSuperWater = canUseSuperWater(locale);

  return (
    <section
      data-pricing-active-subscription
      className="relative z-10 flex min-h-[calc(100dvh-var(--app-header-height))] items-center justify-center px-4 pb-[calc(var(--mobile-nav-bar-height)+2.5rem)] pt-10 text-center text-white lg:min-h-[calc(100vh-var(--app-header-height))] lg:py-10"
    >
      <div className="flex w-full max-w-xl flex-col items-center">
        <p className={cn("font-display text-4xl font-semibold sm:text-5xl", usesSuperWater && "font-super-water")}>
          {formatSuperWaterText(locale, t("pricing.currentSubscription"))}
        </p>
        <Image
          src={planImage.src}
          alt={t(`pricing.${plan}`)}
          width={planImage.width}
          height={planImage.height}
          className="mt-8 h-28 w-auto max-w-[82vw] object-contain sm:h-36"
        />
        <ManageSubscriptionButton locale={locale} plan={plan} />
      </div>
    </section>
  );
}

function PricingHeading({ locale }: { locale: LocaleCode }) {
  const t = useT();

  return (
    <>
      <h1 className={cn("font-display text-[clamp(2.1rem,10vw,3rem)] font-semibold leading-[0.95] text-white lg:text-5xl lg:leading-tight xl:text-6xl", canUseSuperWater(locale) && "font-super-water")}>
        {formatSuperWaterText(locale, t("pricing.title"))}
      </h1>
    </>
  );
}

function PricingButtonBackground({
  image = PRICING_ACTIVE_BUTTON_IMAGE,
  imageClassName,
}: {
  image?: string;
  imageClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 flex overflow-hidden"
    >
      <span className="relative h-full shrink-0 aspect-[150/323] overflow-hidden">
        <Image
          src={image}
          alt=""
          width={1000}
          height={323}
          className={cn("absolute inset-y-0 left-0 h-full w-auto max-w-none", imageClassName)}
        />
      </span>
      <span className="relative h-full min-w-0 flex-1 overflow-hidden">
        <Image
          src={image}
          alt=""
          width={1000}
          height={323}
          className={cn("absolute inset-y-0 left-[-21.4286%] h-full w-[142.8572%] max-w-none", imageClassName)}
        />
      </span>
      <span className="relative h-full shrink-0 aspect-[150/323] overflow-hidden">
        <Image
          src={image}
          alt=""
          width={1000}
          height={323}
          className={cn("absolute inset-y-0 right-0 h-full w-auto max-w-none", imageClassName)}
        />
      </span>
    </span>
  );
}

function PricingPlanCtaBackground({ plan }: { plan: Exclude<SubscriptionPlan, "free"> }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <span
        className={cn(
          "absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.85,0,0.15,1)]",
          plan === "basic" ? "opacity-100" : "opacity-0",
        )}
      >
        <PricingButtonBackground
          image={PRICING_PLAN_BUTTON_BACKGROUND_IMAGES.basic}
          imageClassName="brightness-[0.68]"
        />
      </span>
      <span
        className={cn(
          "absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.85,0,0.15,1)]",
          plan === "pro" ? "opacity-100" : "opacity-0",
        )}
      >
        <PricingButtonBackground
          image={PRICING_PLAN_BUTTON_BACKGROUND_IMAGES.pro}
          imageClassName="brightness-[0.68]"
        />
      </span>
    </span>
  );
}

function PricingPlanButtonBackground({
  plan,
  isSelected,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  isSelected: boolean;
}) {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
      <Image
        src={PRICING_PLAN_BUTTON_BACKGROUND_IMAGES[plan]}
        alt=""
        fill
        sizes="(max-width: 1023px) 50vw, 0px"
        className="object-fill"
        style={{
          filter: `brightness(0.4) saturate(${isSelected ? 1 : 0})`,
          transition: "filter 500ms cubic-bezier(0.85, 0, 0.15, 1)",
        }}
      />
    </span>
  );
}

function PricingDotsBackground({ plan }: { plan: Exclude<SubscriptionPlan, "free"> }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 opacity-30"
      style={{
        backgroundColor: plan === "basic" ? "#2563eb" : "#9333ea",
        maskImage: "url('/pricing-page-dots.png')",
        WebkitMaskImage: "url('/pricing-page-dots.png')",
        maskRepeat: "repeat",
        WebkitMaskRepeat: "repeat",
        maskSize: "auto",
        WebkitMaskSize: "auto",
        transition: "background-color 500ms cubic-bezier(0.85, 0, 0.15, 1)",
      }}
    />
  );
}

function formatPricingCtaText(locale: LocaleCode, text: string) {
  return canUseSuperWater(locale) ? formatSuperWaterUppercaseText(locale, text) : text;
}

function ManageSubscriptionButton({
  locale,
  plan,
}: {
  locale: LocaleCode;
  plan: Exclude<SubscriptionPlan, "free">;
}) {
  const t = useT();
  const { showMessage } = useAppMessage();
  const [state, formAction, pending] = useActionState(createCustomerPortalAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status === "error" && state.message) {
      showMessage(state.message, "error");
    }

    if (state.status !== "success" || !state.customerPortalUrl) return;

    const portalWindow = window.open(state.customerPortalUrl, "_blank", "noopener,noreferrer");
    if (!portalWindow) {
      window.location.assign(state.customerPortalUrl);
    }
  }, [showMessage, state]);

  const buttonLabel = pending ? t("common.loading") : t("pricing.ctaManage");

  return (
    <form action={formAction} className="mt-8 flex w-full max-w-xs flex-col items-center gap-2">
      <Button
        type="submit"
        variant="primary"
        className={cn(
          "h-14 w-full rounded-full border-0 text-xl",
          ACTIVE_SUBSCRIPTION_BUTTON_CLASS[plan],
          canUseSuperWater(locale) && "font-super-water",
        )}
        disabled={pending}
      >
        {formatSuperWaterText(locale, buttonLabel)}
      </Button>
    </form>
  );
}

function BillingCycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  const t = useT();

  return (
    <SegmentedToggle
      value={cycle}
      onChange={onChange}
      options={[
        { value: "monthly", label: t("pricing.billingMonthly") },
        { value: "yearly", label: t("pricing.billingYearly") },
      ]}
    />
  );
}

function PricingCard({
  plan,
  monthlyPrice,
  yearlyPrice,
  popular,
  mascot,
  cycle,
  currentPlan,
  user,
  localizedPricing,
  googlePlayPricing,
  uiLocale,
  isTwa,
  forceFirstMonthFree,
  containerClassName,
  onRequestCheckout,
}: PricingPlan & {
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  user: AuthShellUser | null;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  uiLocale: LocaleCode;
  isTwa: boolean;
  forceFirstMonthFree: boolean;
  containerClassName?: string;
  onRequestCheckout: (selection: CheckoutSelection) => void;
}) {
  const t = useT();
  const isCurrent = currentPlan === plan;
  const googlePlayDetails =
    plan !== "free" ? getGooglePlayPricingDetails(googlePlayPricing, plan, cycle) : null;
  const googlePlayYearlyDetails =
    plan !== "free" ? getGooglePlayPricingDetails(googlePlayPricing, plan, "yearly") : null;
  const fallbackPrice = cycle === "yearly" ? yearlyPrice : monthlyPrice;
  const fallbackYearlyPrice = yearlyPrice;
  const referenceUsdPrice = getReferenceUsdPrice(plan, cycle, isTwa);
  const localized = getLocalizedPrice(localizedPricing, plan, cycle);
  const localizedYearly = getLocalizedPrice(localizedPricing, plan, "yearly");

  const monthlyReferencePrice = useMemo(() => {
    if (plan === "free") return null;
    if (cycle === "monthly") {
      if (googlePlayDetails) return Number.parseFloat(googlePlayDetails.price.value);
      return monthlyPrice;
    }
    if (googlePlayYearlyDetails) {
      const yearly = Number.parseFloat(googlePlayYearlyDetails.price.value);
      return yearly / 12;
    }
    if (yearlyPrice != null) return yearlyPrice / 12;
    return monthlyPrice;
  }, [plan, cycle, googlePlayDetails, googlePlayYearlyDetails, monthlyPrice, yearlyPrice]);

  const yearlyReferencePrice = useMemo(() => {
    if (plan === "free") return null;
    if (cycle === "yearly") {
      if (googlePlayYearlyDetails) return Number.parseFloat(googlePlayYearlyDetails.price.value);
      return yearlyPrice;
    }
    if (googlePlayDetails) return Number.parseFloat(googlePlayDetails.price.value) * 12;
    if (monthlyPrice != null) return monthlyPrice * 12;
    return yearlyPrice;
  }, [plan, cycle, googlePlayDetails, googlePlayYearlyDetails, monthlyPrice, yearlyPrice]);

  const discountRate = useMemo(() => {
    if (monthlyReferencePrice == null || yearlyReferencePrice == null) return null;
    if (monthlyReferencePrice <= 0) return null;
    return Math.round((1 - yearlyReferencePrice / (monthlyReferencePrice * 12)) * 100);
  }, [monthlyReferencePrice, yearlyReferencePrice]);

  const priceDisplay = useMemo(() => {
    if (fallbackPrice === null) return { primary: t("pricing.priceFree"), original: "" };

    const original = referenceUsdPrice !== null ? `USD $${referenceUsdPrice}` : "";

    if (googlePlayDetails) {
      const amount = Number.parseFloat(googlePlayDetails.price.value);
      return {
        primary: formatCurrency(amount, googlePlayDetails.price.currency, uiLocale),
        original,
      };
    }

    if (localized) {
      return {
        primary: formatCurrency(localized.amount, localized.currencyCode, uiLocale),
        original,
      };
    }

    return { primary: `$${fallbackPrice}`, original: "" };
  }, [fallbackPrice, googlePlayDetails, localized, referenceUsdPrice, uiLocale, t]);

  const monthlyEquivalentDisplay = useMemo(() => {
    if (cycle !== "yearly" || plan === "free" || fallbackYearlyPrice == null) return null;

    if (googlePlayYearlyDetails) {
      const yearlyAmount = Number.parseFloat(googlePlayYearlyDetails.price.value);
      return formatCurrency(yearlyAmount / 12, googlePlayYearlyDetails.price.currency, uiLocale);
    }

    if (localizedYearly) {
      return formatCurrency(localizedYearly.amount / 12, localizedYearly.currencyCode, uiLocale);
    }

    return (fallbackYearlyPrice / 12).toFixed(2);
  }, [cycle, plan, fallbackYearlyPrice, googlePlayYearlyDetails, localizedYearly, uiLocale]);

  const showTestIntroOffer = forceFirstMonthFree && cycle === "monthly" && plan !== "free";
  const showIntroOffer =
    showTestIntroOffer ||
    (isTwa &&
      cycle === "monthly" &&
      plan !== "free" &&
      googlePlayDetails?.hasIntroductoryOffer);

  return (
    <div
      data-pricing-card={plan}
      data-route-transition-surface
      className={cn(
        "relative flex flex-col rounded-xl border border-border bg-background-card p-6 text-foreground",
        containerClassName,
      )}
    >
      {popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
          {t("pricing.mostPopular")}
        </span>
      ) : null}

      <div className="flex items-center gap-3">
        {mascot ? (
          <div className="relative h-12 w-12">
            <Image src={mascot} alt="" fill sizes="48px" className="object-contain" />
          </div>
        ) : null}
        <h2 className="text-lg font-semibold">{t(`pricing.${plan}`)}</h2>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-1">
        <span className="font-display text-4xl font-semibold">{priceDisplay.primary}</span>
        {fallbackPrice !== null ? (
          <>
            <span className={cn("text-sm", "text-foreground-muted")}>
              {cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth")}
            </span>
            {priceDisplay.original ? (
              <span className="w-full text-xs text-foreground-muted">{priceDisplay.original}</span>
            ) : null}
          </>
        ) : null}
      </div>

      {cycle === "yearly" && fallbackPrice !== null && discountRate != null && discountRate > 0 ? (
        <p className={cn("mt-1 text-xs font-medium", "text-emerald-600")}>
          {t("pricing.yearlyDiscount", { rate: discountRate })}
        </p>
      ) : null}

      {cycle === "yearly" && monthlyEquivalentDisplay ? (
        <p className={cn("mt-1 text-xs", "text-foreground-muted")}>
          {t("pricing.monthlyEquivalent", { price: monthlyEquivalentDisplay })}
        </p>
      ) : null}

      {showIntroOffer ? (
        <p className="mt-2 text-sm font-bold uppercase text-white">
          {formatSuperWaterUppercaseText(uiLocale, t("pricing.firstMonthFree"))}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {plan === "pro" ? (
          <>
            <Feature included>{t("pricing.featureUnlimitedTextTranslation")}</Feature>
            <Feature included>{t("pricing.featureUnlimitedAiPractice")}</Feature>
          </>
        ) : (
          <Feature included={false}>{t("pricing.featureUnlimitedTextTranslation")}</Feature>
        )}
        <Feature included={plan !== "free"}>{t("pricing.featureCards")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearned")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearnedReview")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureThemes")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureGames")}</Feature>
        {plan !== "pro" ? (
          <>
            <Feature included>{t("pricing.featureAiDaily", { count: PLAN_LIMITS[plan].aiDailyMessages ?? 0 })}</Feature>
            <Feature included>{t("pricing.featureAiMonthly", { count: PLAN_LIMITS[plan].aiMonthlyMessages ?? 0 })}</Feature>
          </>
        ) : null}
      </ul>

      <div className="mt-8">
        {isCurrent ? (
          <CurrentPlanButton className={PRICING_CARD_CTA_CLASS} />
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            onClick={(event) => {
              if (plan === "free") return;
              event.preventDefault();
              onRequestCheckout({
                plan,
                cycle,
                ctaLabel: showTestIntroOffer
                  ? t("pricing.ctaStartFirstMonthFreeTrial")
                  : t("pricing.ctaSubscribe"),
              });
            }}
            className={buttonClassName(
              "primary",
              "md",
              plan === "free"
                ? cn("w-full", PRICING_CARD_CTA_CLASS, PRICING_GRADIENT_BUTTON_CLASS)
                : cn("w-full", PRICING_PURCHASE_BUTTON_CLASS, PRICING_PURCHASE_CTA_CLASS, canUseSuperWater(uiLocale) && "font-super-water"),
            )}
          >
            {plan !== "free" ? <PricingPlanCtaBackground plan={plan} /> : null}
            <span className="relative z-10">
              {plan !== "free"
                ? formatPricingCtaText(
                    uiLocale,
                    showTestIntroOffer
                      ? t("pricing.ctaStartFirstMonthFreeTrial")
                      : t("pricing.ctaSubscribe"),
                  )
                : t("pricing.ctaFree")}
            </span>
          </Link>
        ) : plan === "free" ? (
          <Button variant="secondary" className={cn("w-full", PRICING_CARD_CTA_CLASS)} disabled>
            {t("pricing.ctaCurrent")}
          </Button>
        ) : (
          <>
            <PurchaseButton
              plan={plan}
              cycle={cycle}
              currentPlan={currentPlan}
              className={PRICING_PURCHASE_CTA_CLASS}
              locale={uiLocale}
              ctaContent={showTestIntroOffer ? t("pricing.ctaStartFirstMonthFreeTrial") : undefined}
              onRequestCheckout={() => onRequestCheckout({
                plan,
                cycle,
                ctaLabel: showTestIntroOffer
                  ? t("pricing.ctaStartFirstMonthFreeTrial")
                  : t("pricing.ctaSubscribe"),
              })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Feature({
  included,
  children,
}: {
  included: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-sm">
      {included ? (
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
      ) : (
        <X className="mt-0.5 size-4 shrink-0 text-foreground-muted" aria-hidden="true" />
      )}
      <span className={included ? "" : "text-foreground-muted line-through"}>{children}</span>
    </li>
  );
}

function PurchaseButton({
  plan,
  cycle,
  currentPlan,
  className,
  locale,
  showSubscribeForPaidUser = false,
  ctaContent,
  onRequestCheckout,
  summaryCta = false,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
  locale: LocaleCode;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
  onRequestCheckout?: () => void;
  summaryCta?: boolean;
}) {
  const t = useT();
  const isTwa = useTwaMode();

  if (onRequestCheckout && !summaryCta) {
    return (
      <div className="w-full space-y-2">
        <Button
          type="button"
          variant="primary"
          className={cn(
            "h-12 w-full border-0 whitespace-nowrap text-sm",
            PRICING_PURCHASE_BUTTON_CLASS,
            canUseSuperWater(locale) && "font-super-water",
            className,
          )}
          onClick={onRequestCheckout}
        >
          <PricingPlanCtaBackground plan={plan} />
          <span className="relative z-10">
            {typeof ctaContent === "string"
              ? formatPricingCtaText(locale, ctaContent)
              : ctaContent ?? formatPricingCtaText(locale, t("pricing.ctaSubscribe"))}
          </span>
        </Button>
      </div>
    );
  }

  if (isTwa) {
    return (
      <GooglePlayCheckoutButton
        plan={plan}
        cycle={cycle}
        currentPlan={currentPlan}
        className={className}
        locale={locale}
        showSubscribeForPaidUser={showSubscribeForPaidUser}
        ctaContent={ctaContent}
        summaryCta={summaryCta}
      />
    );
  }

  return (
    <GooglePlayAppButton
      plan={plan}
      currentPlan={currentPlan}
      className={className}
      locale={locale}
      showSubscribeForPaidUser={showSubscribeForPaidUser}
      ctaContent={ctaContent}
      summaryCta={summaryCta}
    />
  );
}

function GooglePlayAppButton({
  plan,
  currentPlan,
  className,
  locale,
  showSubscribeForPaidUser = false,
  ctaContent,
  summaryCta = false,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  currentPlan: SubscriptionPlan | null;
  className?: string;
  locale: LocaleCode;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
  summaryCta?: boolean;
}) {
  const t = useT();
  const isPaidUser = currentPlan != null && currentPlan !== "free";
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(TWA_PACKAGE_NAME)}`;
  const label = isPaidUser && !showSubscribeForPaidUser ? t("pricing.ctaManage") : t("pricing.ctaSubscribe");

  return (
    <div className="w-full space-y-2">
      <a
        href={isPaidUser ? GOOGLE_PLAY_SUBSCRIPTIONS_URL : playStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName(
          "primary",
          "md",
          cn(
            "flex h-12 w-full items-center justify-center whitespace-nowrap border-0 text-sm",
            summaryCta
              ? "relative isolate overflow-hidden !bg-white hover:brightness-105"
              : PRICING_PURCHASE_BUTTON_CLASS,
            canUseSuperWater(locale) && "font-super-water",
            className,
          ),
        )}
      >
        {!summaryCta ? <PricingPlanCtaBackground plan={plan} /> : null}
        <span className="relative z-10" style={{ color: summaryCta ? SUBSCRIPTION_PLAN_COLOR[plan] : undefined }}>
          {typeof ctaContent === "string"
            ? formatPricingCtaText(locale, ctaContent)
            : ctaContent ?? formatPricingCtaText(locale, label)}
        </span>
      </a>
    </div>
  );
}

function GooglePlayCheckoutButton({
  plan,
  cycle,
  currentPlan,
  className,
  locale,
  showSubscribeForPaidUser = false,
  ctaContent,
  summaryCta = false,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
  locale: LocaleCode;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
  summaryCta?: boolean;
}) {
  const t = useT();
  const { presentPurchaseSuccess } = useSubscription();
  const { purchase, isLoading, isSupported } = useGooglePlayBilling();
  const { showMessage } = useAppMessage();
  const isPaidUser = currentPlan != null && currentPlan !== "free";
  const isCurrentPlan = currentPlan === plan;

  const handleClick = async () => {
    if (isPaidUser) {
      window.open(
        GOOGLE_PLAY_SUBSCRIPTIONS_URL,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    try {
      await purchase(getGooglePlaySku(plan, cycle));
      presentPurchaseSuccess();
    } catch (error) {
      if (isGooglePlayPurchaseCancellation(error)) {
        return;
      }

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

  const buttonLabel = isLoading
    ? t("common.loading")
    : isCurrentPlan
    ? t("pricing.ctaCurrent")
    : isPaidUser
      ? showSubscribeForPaidUser
        ? t("pricing.ctaSubscribe")
        : t("pricing.ctaManage")
      : t("pricing.ctaSubscribe");

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        variant="primary"
        className={cn(
          "h-12 w-full border-0 whitespace-nowrap text-sm",
          summaryCta
            ? "relative isolate overflow-hidden !bg-white hover:brightness-105"
            : PRICING_PURCHASE_BUTTON_CLASS,
          canUseSuperWater(locale) && "font-super-water",
          className,
        )}
        disabled={isLoading || !isSupported}
        onClick={handleClick}
      >
        {!summaryCta ? <PricingPlanCtaBackground plan={plan} /> : null}
        <span className="relative z-10" style={{ color: summaryCta ? SUBSCRIPTION_PLAN_COLOR[plan] : undefined }}>
          {isLoading
            ? t("common.loading")
            : typeof ctaContent === "string"
              ? formatPricingCtaText(locale, ctaContent)
              : ctaContent ?? formatPricingCtaText(locale, buttonLabel)}
        </span>
      </Button>

      {!isSupported ? (
        <p className="text-center text-xs text-foreground-muted">
          {t("pricing.googlePlayUnavailable")}
        </p>
      ) : null}
    </div>
  );
}

function CurrentPlanButton({ className }: { className?: string }) {
  const t = useT();

  return (
    <Button variant="secondary" className={cn("w-full whitespace-nowrap", className)} disabled>
      {t("pricing.ctaCurrent")}
    </Button>
  );
}

function PaymentProviderNotes() {
  const t = useT();

  return (
    <div className="mx-auto mt-12 max-w-2xl space-y-2 text-center text-sm text-foreground-muted">
      <p>{t("pricing.paymentProvider")}</p>
      <p>{t("pricing.cancelAnytime")}</p>
    </div>
  );
}

function ConsentText() {
  const t = useT();

  return (
    <p className="mt-3 text-center text-xs text-foreground-muted">
      {t("pricing.consentPrefix")}
      <Link href="/terms" className="underline hover:text-foreground-secondary">
        {t("pricing.consentTerms")}
      </Link>
      {t("pricing.consentAnd")}
      <Link href="/privacy" className="underline hover:text-foreground-secondary">
        {t("pricing.consentPrivacy")}
      </Link>
      {t("pricing.consentSuffix")}
    </p>
  );
}

function SubscriptionDetailsOverlay({
  selection,
  user,
  currentPlan,
  isTwa,
  localizedPricing,
  googlePlayPricing,
  locale,
  onClose,
}: {
  selection: CheckoutSelection;
  user: AuthShellUser | null;
  currentPlan: SubscriptionPlan | null;
  isTwa: boolean;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  locale: LocaleCode;
  onClose: () => void;
}) {
  const t = useT();
  const [isClosing, setIsClosing] = useState(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const planColor = SUBSCRIPTION_PLAN_COLOR[selection.plan];
  const planImage = PRICING_PLAN_BUTTON_IMAGES[selection.plan];
  const price = getMobileOptionPriceValue({
    plan: selection.plan,
    cycle: selection.cycle,
    localizedPricing,
    googlePlayPricing,
    uiLocale: locale,
    isTwa,
  });
  const ctaLabel = selection.ctaLabel ?? t("pricing.ctaSubscribe");
  const period = selection.cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth");
  const usesSuperWater = canUseSuperWater(locale);
  const featureListRef = useRef<HTMLUListElement | null>(null);
  const [showFeatureScrollHint, setShowFeatureScrollHint] = useState(false);
  const [isIntroComplete, setIsIntroComplete] = useState(false);
  const handleIntroComplete = useCallback(() => setIsIntroComplete(true), []);

  useEffect(() => {
    const list = featureListRef.current;
    if (!list) return;

    const updateFeatureScrollHint = () => {
      const hasMoreContent = list.scrollHeight > list.clientHeight + 4;
      const isAtBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
      setShowFeatureScrollHint(hasMoreContent && !isAtBottom);
    };

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
  }, [isIntroComplete]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [handleClose]);

  const content = (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-subscription-details-title"
      data-pricing-subscription-details
      className={cn(
        "subscription-details-overlay fixed inset-0 z-[220] isolate overflow-hidden overscroll-none text-white",
        isClosing && "subscription-details-overlay--closing",
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 z-[2] size-[52rem] -translate-x-1/2 -translate-y-[73%]"
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
        plan={selection.plan}
      />

      <button
        type="button"
        onClick={handleClose}
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

          <div
            className="mx-auto flex w-full flex-none -translate-y-6 flex-col items-center"
          >
            <div
              className={cn(
                "subscription-details-intro-item",
                isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
              )}
              style={{ animationDelay: "530ms" }}
            >
              <Image
                src={planImage.src}
                alt=""
                width={planImage.width}
                height={planImage.height}
                priority
                sizes="18rem"
                className="h-24 w-64 flex-none object-contain"
              />
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

          <div className="relative mt-10 min-h-0 w-full max-w-xl flex-1">
            <ul ref={featureListRef} className="h-full min-h-0 w-full overscroll-contain overflow-y-auto pb-12 pr-1">
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
              "subscription-details-intro-item subscription-details-intro-item--cta mt-8 w-full max-w-xl shrink-0 -translate-y-3",
              isIntroComplete ? "subscription-details-intro-item--enter" : "subscription-details-intro-item--pending",
            )}
            style={{ animationDelay: "1090ms" }}
          >
            {!user ? (
              <Link
                href={`/register?next=${encodeURIComponent("/pricing")}`}
                className={buttonClassName(
                  "primary",
                  "lg",
                  "flex h-16 w-full items-center justify-center rounded-full border-0 !bg-white !text-2xl hover:brightness-95",
                )}
                style={{ color: planColor }}
              >
                <span className={cn("relative z-10", usesSuperWater && "font-super-water")}>
                  {formatPricingCtaText(locale, ctaLabel)}
                </span>
              </Link>
            ) : (
              <PurchaseButton
                plan={selection.plan}
                cycle={selection.cycle}
                currentPlan={currentPlan}
                className="h-16 !rounded-full !text-2xl"
                locale={locale}
                ctaContent={ctaLabel}
                summaryCta
              />
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
  const frameBasePath = plan === "pro"
    ? SUBSCRIPTION_DETAILS_PRO_FRAME_BASE_PATH
    : SUBSCRIPTION_DETAILS_FRAME_BASE_PATH;

  useEffect(() => {
    let cancelled = false;
    let animationFrameId: number | null = null;
    const frameDuration = 1000 / SUBSCRIPTION_DETAILS_FRAME_FPS;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const preloadFrames = Array.from(
      { length: SUBSCRIPTION_DETAILS_FRAME_COUNT },
      (_, index) => {
        const image = new window.Image();
        image.decoding = "async";
        image.src = `${frameBasePath}/${index + 1}.png`;
        return image;
      },
    );

    if (prefersReducedMotion) {
      frameIndexRef.current = SUBSCRIPTION_DETAILS_FRAME_COUNT;
      setFrameIndex(SUBSCRIPTION_DETAILS_FRAME_COUNT);
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
        SUBSCRIPTION_DETAILS_FRAME_COUNT,
        Math.floor((now - startedAt) / frameDuration) + 1,
      );

      if (nextFrame !== frameIndexRef.current) {
        frameIndexRef.current = nextFrame;
        setFrameIndex(nextFrame);
      }

      if (nextFrame === SUBSCRIPTION_DETAILS_FRAME_COUNT) {
        onComplete();
      }

      if (nextFrame < SUBSCRIPTION_DETAILS_FRAME_COUNT) {
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
  }, [frameBasePath, onComplete]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "subscription-details-frame-layer",
        plan === "pro" && "subscription-details-frame-layer--pro",
        isClosing && "subscription-details-frame-layer--closing",
      )}
    >
      <img
        src={`${frameBasePath}/${frameIndex}.png`}
        alt=""
        draggable={false}
        style={{ filter: "none" }}
      />
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
  icon: typeof Layers;
  locale: LocaleCode;
  text: string;
}) {
  return (
    <li
      data-pricing-details-feature={index}
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

type MobileOption = {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
};

const DEFAULT_MOBILE_OPTION: MobileOption = { plan: "basic", cycle: "monthly" };

function getPlanDiscountRate(plan: Exclude<SubscriptionPlan, "free">, isTwa: boolean): number | null {
  const plans = isTwa ? TWA_PLANS : PLANS;
  const planItem = plans.find((item) => item.plan === plan);

  if (!planItem?.monthlyPrice || !planItem.yearlyPrice) {
    return null;
  }

  return Math.round((1 - planItem.yearlyPrice / (planItem.monthlyPrice * 12)) * 100);
}

function MobileOptionPrice({
  plan,
  cycle,
  isSelected,
  localizedPricing,
  googlePlayPricing,
  uiLocale,
  isTwa,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  isSelected: boolean;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  uiLocale: string;
  isTwa: boolean;
}) {
  const t = useT();
  const primary = getMobileOptionPriceValue({
    plan,
    cycle,
    localizedPricing,
    googlePlayPricing,
    uiLocale,
    isTwa,
  }) ?? t("pricing.priceFree");

  return (
    <span
      className={cn(
        "relative z-10 flex items-center justify-center gap-1 whitespace-nowrap font-semibold leading-none transition-[color,filter] duration-500 ease-[cubic-bezier(0.85,0,0.15,1)]",
        isSelected
          ? plan === "basic"
            ? "text-lg text-[#60a5fa]"
            : "text-lg text-[#c084fc]"
          : "text-base text-[#9ca3af] saturate-0",
      )}
      style={{
        transform: `translateY(-0.5rem) scale(${isSelected ? 1 : 0.9})`,
        transition: "transform 500ms cubic-bezier(0.85, 0, 0.15, 1), color 500ms cubic-bezier(0.85, 0, 0.15, 1), filter 500ms cubic-bezier(0.85, 0, 0.15, 1)",
        willChange: "transform, color, filter",
      }}
    >
      <span className={cn("font-display font-semibold tabular-nums", isSelected ? "text-xl" : "text-lg")}>{primary}</span>
      <span aria-hidden="true">/</span>
      <span>{cycle === "yearly" ? t("pricing.billingYearly") : t("pricing.billingMonthly")}</span>
    </span>
  );
}

function getMobileOptionPriceValue({
  plan,
  cycle,
  localizedPricing,
  googlePlayPricing,
  uiLocale,
  isTwa,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  uiLocale: string;
  isTwa: boolean;
}): string | null {
  const plans = isTwa ? TWA_PLANS : PLANS;
  const planItem = plans.find((item) => item.plan === plan);
  const googlePlayDetails = getGooglePlayPricingDetails(googlePlayPricing, plan, cycle);
  const fallbackPrice = cycle === "yearly" ? planItem?.yearlyPrice : planItem?.monthlyPrice;
  const localized = getLocalizedPrice(localizedPricing, plan, cycle);

  if (googlePlayDetails) {
    const amount = Number.parseFloat(googlePlayDetails.price.value);
    return formatCurrency(amount, googlePlayDetails.price.currency, uiLocale);
  }

  if (localized) return formatCurrency(localized.amount, localized.currencyCode, uiLocale);
  if (fallbackPrice != null) return `$${fallbackPrice}`;
  return null;
}

const MOBILE_PERK_ARTWORK = [
  {
    id: "new-cards",
    image: "/pricing-perks/learn-cards-transparent.png",
    titleKey: "pricing.featureCards",
    descriptionKey: "pricing.featureCardsDescription",
  },
  {
    id: "learn-cards",
    image: "/pricing-perks/new-cards-transparent.png",
    titleKey: "pricing.featureLearned",
    descriptionKey: "pricing.featureLearnedDescription",
  },
  {
    id: "review-cards",
    image: "/pricing-perks/review-cards2-transparent.png",
    titleKey: "pricing.featureLearnedReview",
    descriptionKey: "pricing.featureLearnedReviewDescription",
  },
  {
    id: "games",
    image: "/pricing-perks/games-transparent.png",
    titleKey: "pricing.featureGames",
    descriptionKey: "pricing.featureGamesDescription",
  },
  {
    id: "practice",
    image: "/pricing-perks/practice-transparent.png",
    titleKey: "nav.aiPractice",
    descriptionKey: "pricing.featureAiDaily",
  },
  {
    id: "themes",
    image: "/pricing-perks/themes2-transparent.png",
    titleKey: "pricing.featureThemes",
    descriptionKey: "pricing.featureThemesDescription",
  },
  {
    id: "priority-support",
    image: "/pricing-perks/priority-support-transparent.png",
    titleKey: "pricing.featurePrioritySupport",
    descriptionKey: "pricing.featurePrioritySupportDescription",
  },
  {
    id: "scenario-ai",
    image: "/pricing-perks/durum-ai-practice-transparent.png",
    titleKey: "pricing.featureAiScenarios",
    descriptionKey: "pricing.featureAiScenariosDescription",
  },
] as const;

const LOOPED_MOBILE_PERK_ARTWORK = [
  ...MOBILE_PERK_ARTWORK,
  ...MOBILE_PERK_ARTWORK,
  ...MOBILE_PERK_ARTWORK,
];

function MobilePricingPerkCarousel({
  plan,
  locale,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  locale: LocaleCode;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRenderIndexRef = useRef<number>(MOBILE_PERK_ARTWORK.length);
  const activeIndexRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const programmaticScrollUntilRef = useRef(0);
  const settleTimerRef = useRef<number | null>(null);
  const [highlightRenderIndex, setHighlightRenderIndex] = useState<number>(MOBILE_PERK_ARTWORK.length);

  const getNearestCardIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return -1;

    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + track.clientWidth / 2;
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }, []);

  const centerCard = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    const card = cardRefs.current[index];
    if (!track || !card) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const targetLeft = track.scrollLeft +
      (cardRect.left + cardRect.width / 2 - (trackRect.left + track.clientWidth / 2));
    if (Math.abs(track.scrollLeft - targetLeft) < 1) return;

    const nextScrollLeft = Math.max(0, targetLeft);
    if (behavior === "auto") {
      track.scrollLeft = nextScrollLeft;
      return;
    }

    track.scrollTo({ left: nextScrollLeft, behavior });
  }, []);

  const moveToAdjacentCard = useCallback((direction: -1 | 1) => {
    const total = MOBILE_PERK_ARTWORK.length;
    const middleCopyStart = total;
    const middleCopyEnd = total * 2 - 1;
    const currentIndex = activeRenderIndexRef.current;
    const fallbackIndex = middleCopyStart + ((activeIndexRef.current + direction + total) % total);
    const targetIndex = currentIndex + direction < middleCopyStart || currentIndex + direction > middleCopyEnd
      ? fallbackIndex
      : currentIndex + direction;
    const normalizedTargetIndex = ((targetIndex % total) + total) % total;

    activeRenderIndexRef.current = targetIndex;
    activeIndexRef.current = normalizedTargetIndex;
    programmaticScrollUntilRef.current = window.performance.now() + 800;
    setHighlightRenderIndex(targetIndex);

    if (initializedRef.current) {
      vibrate("tap");
      playSoundEffect("pricing-perk-select");
    }

    centerCard(targetIndex, "smooth");
  }, [centerCard]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const initializeCarousel = () => {
      if (initializedRef.current || track.clientWidth === 0) return;

      const middleIndex = MOBILE_PERK_ARTWORK.length;
      if (!cardRefs.current[middleIndex]) return;

      centerCard(middleIndex, "auto");
      activeRenderIndexRef.current = middleIndex;
      setHighlightRenderIndex(middleIndex);
      initializedRef.current = true;
    };

    const initialFrame = window.requestAnimationFrame(initializeCarousel);
    const initialTimer = window.setTimeout(initializeCarousel, 120);

    const handleScroll = () => {
      const nearestIndex = getNearestCardIndex();
      if (nearestIndex < 0) return;
      if (window.performance.now() < programmaticScrollUntilRef.current) return;

      const normalizedIndex = ((nearestIndex % MOBILE_PERK_ARTWORK.length) + MOBILE_PERK_ARTWORK.length) % MOBILE_PERK_ARTWORK.length;
      if (activeRenderIndexRef.current !== nearestIndex) {
        activeRenderIndexRef.current = nearestIndex;
        setHighlightRenderIndex(nearestIndex);
      }

      if (activeIndexRef.current !== normalizedIndex) {
        activeIndexRef.current = normalizedIndex;

        if (initializedRef.current) {
          vibrate("tap");
          playSoundEffect("pricing-perk-select");
        }
      }

      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }

      const middleCopyStart = MOBILE_PERK_ARTWORK.length;
      const middleCopyEnd = middleCopyStart * 2;
      const needsLoopNormalization = nearestIndex < middleCopyStart || nearestIndex >= middleCopyEnd;
      settleTimerRef.current = window.setTimeout(() => {
        const middleIndex = MOBILE_PERK_ARTWORK.length + activeIndexRef.current;
        centerCard(middleIndex, needsLoopNormalization ? "auto" : "smooth");
      }, 140);
    };

    const handleResize = () => {
      centerCard(MOBILE_PERK_ARTWORK.length + activeIndexRef.current, "auto");
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(initializeCarousel);
    resizeObserver?.observe(track);

    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearTimeout(initialTimer);
      track.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, [centerCard, getNearestCardIndex]);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => moveToAdjacentCard(-1)}
        className="absolute left-0 top-1/2 z-30 inline-flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-transparent text-white/90 transition-[color,transform] hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
        aria-label={t("pricing.previousFeature")}
        data-pricing-perk-previous
      >
        <ChevronLeft className="h-7 w-7 pricing-perk-arrow-left" strokeWidth={2.5} aria-hidden="true" />
      </button>

      <div
        ref={trackRef}
        className="-mx-4 -my-12 flex h-[calc(clamp(14rem,40dvh,21rem)+6rem)] w-[calc(100%+2rem)] items-center overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-mobile-pricing-perks
        aria-label={t("pricing.mobileFeatureUnlimitedAccess")}
      >
        <div className="flex h-[clamp(14rem,40dvh,21rem)] w-max snap-x snap-mandatory gap-3 px-[14vw]">
          {LOOPED_MOBILE_PERK_ARTWORK.map((perk, renderIndex) => {
            const index = renderIndex % MOBILE_PERK_ARTWORK.length;
            const isHighlighted = renderIndex === highlightRenderIndex;
            const perkImageOffset = perk.id === "themes"
              ? "-translate-y-12"
              : perk.id === "scenario-ai"
                ? "-translate-y-10"
              : perk.id === "priority-support"
                ? "-translate-y-10"
                : perk.id === "practice"
                  ? "-translate-y-8"
                  : perk.id === "learn-cards" || perk.id === "new-cards"
                    ? "-translate-y-7"
                    : "-translate-y-6";
            const perkImageScale = isHighlighted
              ? perk.id === "scenario-ai" ? "scale-[1.08]" : "scale-[1.16]"
              : perk.id === "scenario-ai" ? "scale-[1.02]" : "scale-[1.08]";

            return (
              <article
                key={`${perk.id}-${renderIndex}`}
                ref={(element) => {
                  cardRefs.current[renderIndex] = element;
                }}
                data-perk-index={index}
                data-pricing-perk-card
                data-highlighted={isHighlighted ? "true" : "false"}
                className={cn(
                  "relative h-full w-[72vw] max-w-[19rem] snap-center snap-always rounded-[2rem] bg-[var(--pricing-mobile-surface)] transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isHighlighted ? "z-20 scale-100 opacity-100" : "z-0 scale-[0.86] opacity-55",
                )}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{ clipPath: "inset(-100% 0 -100% 0)" }}
                >
                  <Image
                    src={perk.image}
                    alt=""
                    fill
                    priority={renderIndex === MOBILE_PERK_ARTWORK.length}
                    sizes="72vw"
                    className={cn(
                      perkImageOffset,
                      "object-contain transition-[transform,filter,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      perkImageScale,
                      isHighlighted ? "opacity-100" : "opacity-45 grayscale-[0.2]",
                    )}
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[2rem] [background:linear-gradient(to_top,rgba(8,9,9,0.98)_0%,rgba(8,9,9,0.9)_25%,rgba(8,9,9,0.46)_52%,transparent_76%)]"
                />
                <div className="relative z-10 flex h-full min-h-[6.5rem] flex-col items-center justify-end px-5 pb-5 text-center transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <h2
                    className={cn(
                      "text-2xl font-semibold leading-none text-white transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      canUseSuperWater(locale) && "font-super-water",
                    )}
                  >
                    {formatSuperWaterText(locale, t(perk.titleKey))}
                  </h2>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => moveToAdjacentCard(1)}
        className="absolute right-0 top-1/2 z-30 inline-flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-transparent text-white/90 transition-[color,transform] hover:bg-transparent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 active:scale-95"
        aria-label={t("pricing.nextFeature")}
        data-pricing-perk-next
      >
        <ChevronRight className="h-7 w-7 pricing-perk-arrow-right" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

function MobileBillingCycleToggle({
  cycle,
  yearlyDiscountRate,
  onChange,
}: {
  cycle: BillingCycle;
  yearlyDiscountRate: number | null;
  onChange: (cycle: BillingCycle) => void;
}) {
  const t = useT();
  const isYearly = cycle === "yearly";
  const savings = yearlyDiscountRate && yearlyDiscountRate > 0
    ? t("pricing.yearlyDiscount", { rate: yearlyDiscountRate })
    : null;

  return (
    <div className="relative flex h-12 shrink-0 rounded-full bg-[var(--pricing-mobile-button-surface)] p-1">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white transition-transform duration-300 ease-out",
          isYearly && "translate-x-full",
        )}
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "relative z-10 flex flex-1 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors duration-300",
          !isYearly ? "text-slate-950" : "text-white/70",
        )}
        aria-pressed={!isYearly}
      >
        {t("pricing.billingMonthly")}
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "relative z-10 flex flex-1 flex-col items-center justify-center rounded-full px-3 text-xs font-semibold leading-none transition-colors duration-300",
          isYearly ? "text-slate-950" : "text-white/70",
        )}
        aria-pressed={isYearly}
      >
        <span>{t("pricing.billingYearly")}</span>
        {savings ? <span className={cn("mt-0.5 text-[9px]", isYearly ? "text-emerald-700" : "text-emerald-300")}>{savings}</span> : null}
      </button>
    </div>
  );
}

function MobileSubscriptionCtaContent({
  hasFirstMonthTrial,
  locale,
}: {
  hasFirstMonthTrial: boolean;
  locale: LocaleCode;
}) {
  const t = useT();

  return (
    <span className="flex flex-col items-center justify-center leading-tight">
      <span className="text-2xl font-semibold">
        {formatPricingCtaText(
          locale,
          hasFirstMonthTrial ? t("pricing.ctaStartFirstMonthFreeTrial") : t("pricing.ctaSubscribe"),
        )}
      </span>
    </span>
  );
}

interface MobilePricingViewProps {
  user: AuthShellUser | null;
  isTwa: boolean;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  entitlements: ReturnType<typeof useSubscription>["entitlements"];
  locale: LocaleCode;
  forceFirstMonthFree: boolean;
  onRequestCheckout: (selection: CheckoutSelection) => void;
}

function MobilePricingView({
  user,
  isTwa,
  localizedPricing,
  googlePlayPricing,
  entitlements,
  locale,
  forceFirstMonthFree,
  onRequestCheckout,
}: MobilePricingViewProps) {
  const t = useT();
  const [selectedOption, setSelectedOption] = useState<MobileOption>(DEFAULT_MOBILE_OPTION);
  const currentPlan = entitlements?.effectivePlan ?? null;

  const handleSelect = (option: MobileOption) => {
    vibrate("tap");
    setSelectedOption(option);
  };

  const isCurrentPlan = currentPlan === selectedOption.plan;
  const yearlyDiscountRate = getPlanDiscountRate(selectedOption.plan, isTwa);
  const selectedPrice = getMobileOptionPriceValue({
    plan: selectedOption.plan,
    cycle: selectedOption.cycle,
    localizedPricing,
    googlePlayPricing,
    uiLocale: locale,
    isTwa,
  });
  const showsFirstMonthTrial =
    selectedOption.cycle === "monthly" &&
    selectedPrice != null &&
    (forceFirstMonthFree || currentPlan == null || currentPlan === "free");
  const ctaContent = selectedPrice ? (
    <MobileSubscriptionCtaContent
      hasFirstMonthTrial={showsFirstMonthTrial}
      locale={locale}
    />
  ) : undefined;
  const ctaLabel = showsFirstMonthTrial
    ? t("pricing.ctaStartFirstMonthFreeTrial")
    : t("pricing.ctaSubscribe");

  return (
    <div
      className="relative z-10 flex h-full flex-col overflow-hidden bg-transparent px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white lg:hidden"
      data-pricing-mobile-view
    >
      <PricingDotsBackground plan={selectedOption.plan} />

      <div className="relative z-10 flex min-h-0 -translate-y-8 flex-1 flex-col items-center justify-center gap-12">
        <div className="h-20 shrink-0" aria-hidden="true" />

        <div className="flex min-h-0 w-full min-w-0 shrink-0 items-center" data-route-transition-surface>
          <MobilePricingPerkCarousel plan={selectedOption.plan} locale={locale} />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-8 top-0 z-20 flex flex-col items-center justify-center px-4 text-center"
        data-pricing-heading
        data-pricing-heading-mobile
        data-route-transition-surface
      >
        <div className="relative z-10">
          <PricingHeading locale={locale} />
        </div>
      </div>

      <div className="relative z-10 -translate-y-8 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {(["basic", "pro"] as const).map((plan) => {
            const isSelected = selectedOption.plan === plan;
            const planButtonImage = PRICING_PLAN_BUTTON_IMAGES[plan];

            return (
              <button
                key={plan}
                type="button"
                onClick={() => handleSelect({ plan, cycle: selectedOption.cycle })}
                className="relative isolate flex h-20 flex-col items-center justify-center overflow-visible rounded-full border-0 bg-transparent px-3 text-center"
                aria-pressed={isSelected}
                data-mobile-pricing-plan-button={plan}
                data-selected={isSelected ? "true" : "false"}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-16 -translate-y-1/2 overflow-hidden rounded-full border border-white/10"
                >
                  <PricingPlanButtonBackground plan={plan} isSelected={isSelected} />
                </span>
                <span
                  className="relative z-10 flex h-16 w-full items-center justify-center overflow-visible"
                >
                  <Image
                    src={planButtonImage.src}
                    alt={t(`pricing.${plan}`)}
                    width={planButtonImage.width}
                    height={planButtonImage.height}
                    sizes="(max-width: 1023px) 50vw, 0px"
                    className="h-auto max-h-16 w-[92%] object-contain"
                    style={{
                      transform: isSelected
                        ? "translateY(-0.5rem) scale(0.88)"
                        : "translateY(0.25rem) scale(0.64)",
                      filter: isSelected ? "saturate(1)" : "saturate(0)",
                      transition: "transform 500ms cubic-bezier(0.85, 0, 0.15, 1), filter 500ms cubic-bezier(0.85, 0, 0.15, 1)",
                      willChange: "transform, filter",
                    }}
                  />
                </span>
                <MobileOptionPrice
                  plan={plan}
                  cycle={selectedOption.cycle}
                  isSelected={isSelected}
                  localizedPricing={localizedPricing}
                  googlePlayPricing={googlePlayPricing}
                  uiLocale={locale}
                  isTwa={isTwa}
                />
              </button>
            );
          })}
        </div>

      <div className="mt-2 hidden" data-route-transition-surface>
        <MobileBillingCycleToggle
          cycle={selectedOption.cycle}
          yearlyDiscountRate={yearlyDiscountRate}
          onChange={(cycle) => handleSelect({ plan: selectedOption.plan, cycle })}
        />
      </div>

      <div className="mt-3 shrink-0" data-route-transition-surface>
        {isCurrentPlan ? (
          <CurrentPlanButton className="h-14 rounded-2xl border-0 bg-[var(--pricing-mobile-surface)] text-base text-white" />
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            onClick={(event) => {
              event.preventDefault();
              onRequestCheckout({
                plan: selectedOption.plan,
                cycle: selectedOption.cycle,
                ctaLabel,
              });
            }}
            className={buttonClassName(
              "primary",
              "lg",
              cn(
                "w-full rounded-2xl border-0",
                PRICING_PURCHASE_BUTTON_CLASS,
                PRICING_PURCHASE_CTA_CLASS,
                canUseSuperWater(locale) && "font-super-water",
              ),
            )}
          >
            <PricingPlanCtaBackground plan={selectedOption.plan} />
            <span className="relative z-10">
              {ctaContent ?? formatPricingCtaText(locale, t("pricing.ctaSubscribe"))}
            </span>
          </Link>
        ) : (
          <PurchaseButton
            plan={selectedOption.plan}
            cycle={selectedOption.cycle}
            currentPlan={currentPlan}
            className={cn(PRICING_PURCHASE_CTA_CLASS, "rounded-2xl")}
            locale={locale}
            showSubscribeForPaidUser={currentPlan === "basic" && selectedOption.plan === "pro"}
            ctaContent={ctaContent}
            onRequestCheckout={() => onRequestCheckout({
              plan: selectedOption.plan,
              cycle: selectedOption.cycle,
              ctaLabel,
            })}
          />
        )}
      </div>

      </div>
    </div>
  );
}
