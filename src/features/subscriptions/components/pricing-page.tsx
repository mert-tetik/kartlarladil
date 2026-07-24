"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  X,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  createCheckoutAction,
} from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { markPendingWebSubscriptionCheckout } from "@/features/subscriptions/subscription-purchase-success";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  useGooglePlayPricing,
  type GooglePlayPricingStatus,
  type BillingCycle as GooglePlayBillingCycle,
} from "@/features/subscriptions/use-google-play-pricing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { GOOGLE_PLAY_SUBSCRIPTIONS_URL } from "@/features/subscriptions/google-play-links";
import { SubscriptionMismatchNotice } from "@/features/subscriptions/components/subscription-mismatch";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
  type LocalizedPricingStatus,
} from "@/features/subscriptions/components/use-localized-pricing";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { LocaleCode, SubscriptionPlan, SubscriptionProvider } from "@/types/domain";

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
const PRICING_GRADIENT_TEXT_CLASS =
  "bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500 bg-clip-text text-transparent";
const PRICING_GRADIENT_SURFACE_CLASS =
  "bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500";
const PRICING_GRADIENT_BUTTON_CLASS =
  "bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500 !text-slate-950 hover:brightness-105";

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
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const isTwa = useTwaMode();
  const localizedPricing = useLocalizedPricing(currencyCode, isTwa);
  const googlePlayPricing = useGooglePlayPricing();
  const plans = isTwa ? TWA_PLANS : PLANS;

  return (
    <div
      data-pricing-page
      className="relative isolate mx-auto min-h-screen max-w-6xl px-4 pb-0 pt-12 max-lg:h-[calc(100dvh-var(--app-header-height))] max-lg:min-h-0 max-lg:overflow-hidden max-lg:p-0 sm:px-6 lg:px-8 lg:pb-10"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-1/2 top-0 z-0 h-80 w-screen -translate-x-1/2 overflow-hidden">
        <div className={cn("absolute -top-20 left-[-5%] h-[25rem] w-[110%] rounded-b-[50%] opacity-55", PRICING_GRADIENT_SURFACE_CLASS)} />
      </div>
      <div className="h-full lg:hidden">
        <MobilePricingView
          user={user}
          isTwa={isTwa}
          localizedPricing={localizedPricing}
          googlePlayPricing={googlePlayPricing}
          entitlements={entitlements}
          locale={locale}
        />
      </div>

      <div className="hidden animate-screen-pop lg:block">
        <div className="relative z-10 text-center">
          <h1 className={cn("font-display text-4xl font-semibold text-white md:text-5xl", canUseSuperWater(locale) && "font-super-water")}>
            {formatSuperWaterText(locale, t("pricing.title"))}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-black">
            {t("pricing.mobileFeatureUnlimitedAccess")}
          </p>
          {isTwa ? (
            <p className="mt-3 text-sm font-bold uppercase text-white">
              {t("pricing.firstMonthFreeBanner")}
            </p>
          ) : null}
        </div>

        <div className="relative z-10 mt-8 flex justify-center">
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
              currentPlan={entitlements?.effectivePlan ?? null}
              provider={entitlements?.provider ?? "lemon_squeezy"}
              user={user}
              localizedPricing={localizedPricing}
              googlePlayPricing={googlePlayPricing}
              uiLocale={locale}
              isTwa={isTwa}
              containerClassName={MOBILE_PLAN_ORDER_CLASSNAME[item.plan]}
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
    </div>
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
    <div className="inline-flex items-center rounded-full border border-border bg-background-muted p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          cycle === "monthly"
            ? cn(PRICING_GRADIENT_BUTTON_CLASS, "shadow-sm")
            : "text-foreground-secondary hover:text-foreground",
        )}
        aria-pressed={cycle === "monthly"}
      >
        {t("pricing.billingMonthly")}
      </button>
      <button
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          cycle === "yearly"
            ? cn(PRICING_GRADIENT_BUTTON_CLASS, "shadow-sm")
            : "text-foreground-secondary hover:text-foreground",
        )}
        aria-pressed={cycle === "yearly"}
      >
        {t("pricing.billingYearly")}
      </button>
    </div>
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
  provider,
  user,
  localizedPricing,
  googlePlayPricing,
  uiLocale,
  isTwa,
  containerClassName,
}: PricingPlan & {
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  provider: SubscriptionProvider;
  user: AuthShellUser | null;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  uiLocale: string;
  isTwa: boolean;
  containerClassName?: string;
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

  const showIntroOffer =
    isTwa &&
    cycle === "monthly" &&
    plan !== "free" &&
    googlePlayDetails?.hasIntroductoryOffer;

  return (
    <div
      data-pricing-card={plan}
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
        <p className={cn("mt-2 text-sm font-bold uppercase", PRICING_GRADIENT_TEXT_CLASS)}>
          {t("pricing.firstMonthFree")}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        <Feature included={plan !== "free"}>{t("pricing.featureCards")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearned")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearnedReview")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureThemes")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureGames")}</Feature>
        <Feature included>{t("pricing.featureAiDaily", { count: PLAN_LIMITS[plan].aiDailyMessages })}</Feature>
        <Feature included>{t("pricing.featureAiMonthly", { count: PLAN_LIMITS[plan].aiMonthlyMessages })}</Feature>
      </ul>

      <div className="mt-8">
        {isCurrent ? (
          <CurrentPlanButton className={PRICING_CARD_CTA_CLASS} />
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            className={buttonClassName("primary", "md", cn("w-full", PRICING_CARD_CTA_CLASS, PRICING_GRADIENT_BUTTON_CLASS))}
          >
            {plan === "free" ? t("pricing.ctaFree") : t("pricing.ctaSubscribe")}
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
              provider={provider}
              className={PRICING_CARD_CTA_CLASS}
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

function CheckoutButton({
  plan,
  cycle,
  currentPlan,
  className,
  showSubscribeForPaidUser = false,
  ctaContent,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createCheckoutAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status !== "success") return;

    if (state.customerPortalUrl) {
      const portalWindow = window.open(state.customerPortalUrl, "_blank", "noopener,noreferrer");
      if (!portalWindow) {
        window.location.assign(state.customerPortalUrl);
      }
      return;
    }

    if (state.checkoutUrl) {
      markPendingWebSubscriptionCheckout();
      if (typeof window !== "undefined" && window.LemonSqueezy?.Url?.Open) {
        window.createLemonSqueezy?.();
        window.LemonSqueezy.Url.Open(state.checkoutUrl);
      } else {
        window.location.href = state.checkoutUrl;
      }
    }
  }, [state]);

  const isPaidUser = currentPlan != null && currentPlan !== "free";

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />
      <Button
        type="submit"
        variant="primary"
        className={cn(
          "h-12 w-full border-0 whitespace-nowrap text-sm",
          (plan === "basic" || plan === "pro") && PRICING_GRADIENT_BUTTON_CLASS,
          className,
        )}
        disabled={pending}
      >
        {pending
          ? t("common.loading")
          : ctaContent
            ? ctaContent
          : isPaidUser && !showSubscribeForPaidUser
            ? t("pricing.ctaManage")
            : t("pricing.ctaSubscribe")}
      </Button>
      {state.status === "error" ? <p className="mt-2 text-center text-xs text-rose-600">{state.message}</p> : null}
    </form>
  );
}

function PurchaseButton({
  plan,
  cycle,
  currentPlan,
  provider,
  className,
  showSubscribeForPaidUser = false,
  ctaContent,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  provider: SubscriptionProvider;
  className?: string;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
}) {
  const isTwa = useTwaMode();
  const isPaid = currentPlan != null && currentPlan !== "free";
  const isMismatch =
    isPaid &&
    ((isTwa && provider === "lemon_squeezy") || (!isTwa && provider === "google_play"));

  if (isMismatch) {
    return <SubscriptionMismatchNotice provider={provider} context="pricing" />;
  }

  if (isTwa) {
    return (
      <GooglePlayCheckoutButton
        plan={plan}
        cycle={cycle}
        currentPlan={currentPlan}
        className={className}
        showSubscribeForPaidUser={showSubscribeForPaidUser}
        ctaContent={ctaContent}
      />
    );
  }

  return (
    <CheckoutButton
      plan={plan}
      cycle={cycle}
      currentPlan={currentPlan}
      className={className}
      showSubscribeForPaidUser={showSubscribeForPaidUser}
      ctaContent={ctaContent}
    />
  );
}

function GooglePlayCheckoutButton({
  plan,
  cycle,
  currentPlan,
  className,
  showSubscribeForPaidUser = false,
  ctaContent,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
  showSubscribeForPaidUser?: boolean;
  ctaContent?: React.ReactNode;
}) {
  const t = useT();
  const { presentPurchaseSuccess } = useSubscription();
  const { purchase, isLoading, isSupported } = useGooglePlayBilling();
  const isPaidUser = currentPlan != null && currentPlan !== "free";
  const isCurrentPlan = currentPlan === plan;
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const handleClick = async () => {
    setPurchaseError(null);

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
      console.error("Google Play purchase failed:", error);
      setPurchaseError(
        getGooglePlayErrorMessage(
          error,
          t("pricing.error.checkoutFailed"),
          t("pricing.error.clientAppUnavailable"),
        ),
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
          (plan === "basic" || plan === "pro") && PRICING_GRADIENT_BUTTON_CLASS,
          className,
        )}
        disabled={isLoading || !isSupported}
        onClick={handleClick}
      >
        {isLoading ? t("common.loading") : ctaContent ?? buttonLabel}
      </Button>

      {!isSupported ? (
        <p className="text-center text-xs text-foreground-muted">
          {t("pricing.googlePlayUnavailable")}
        </p>
      ) : purchaseError ? (
        <p className="text-center text-xs text-rose-600">{purchaseError}</p>
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
  const isTwa = useTwaMode();

  return (
    <div className="mx-auto mt-12 max-w-2xl space-y-2 text-center text-sm text-foreground-muted">
      <p>{isTwa ? "Google Play Billing" : t("pricing.paymentProvider")}</p>
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
        "relative z-10 flex items-center justify-center gap-1 whitespace-nowrap text-xs font-medium leading-none transition-colors duration-300",
        isSelected ? "text-slate-950" : "text-white",
      )}
    >
      <span className="font-display text-sm font-semibold tabular-nums">{primary}</span>
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
    image: "/pricing-perks/new-cards.png",
    titleKey: "pricing.featureCards",
    descriptionKey: "pricing.featureCardsDescription",
  },
  {
    id: "learn-cards",
    image: "/pricing-perks/learn-cards.png",
    titleKey: "pricing.featureLearned",
    descriptionKey: "pricing.featureLearnedDescription",
  },
  {
    id: "review-cards",
    image: "/pricing-perks/review-cards.png",
    titleKey: "pricing.featureLearnedReview",
    descriptionKey: "pricing.featureLearnedReviewDescription",
  },
  {
    id: "games",
    image: "/pricing-perks/games.png",
    titleKey: "pricing.featureGames",
    descriptionKey: "pricing.featureGamesDescription",
  },
  {
    id: "practice",
    image: "/pricing-perks/practice.png",
    titleKey: "nav.aiPractice",
    descriptionKey: "pricing.featureAiDaily",
  },
  {
    id: "themes",
    image: "/pricing-perks/themes.png",
    titleKey: "pricing.featureThemes",
    descriptionKey: "pricing.featureThemesDescription",
  },
  {
    id: "priority-support",
    image: "/pricing-perks/priority-support.png",
    titleKey: "pricing.featurePrioritySupport",
    descriptionKey: "pricing.featurePrioritySupportDescription",
  },
  {
    id: "monthly-ai",
    image: "/pricing-perks/monthly-ai.png",
    titleKey: "nav.aiPractice",
    descriptionKey: "pricing.featureAiMonthly",
  },
] as const;

function MobilePricingPerkCarousel({
  plan,
  locale,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  locale: LocaleCode;
}) {
  const t = useT();

  return (
    <div
      className="-mx-4 h-[clamp(14rem,40dvh,21rem)] w-full overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      data-mobile-pricing-perks
    >
      <div className="flex h-full w-max snap-x snap-mandatory gap-3 pr-4">
        {MOBILE_PERK_ARTWORK.map((perk, index) => {
          const description = perk.id === "practice"
            ? t("pricing.featureAiDaily", { count: PLAN_LIMITS[plan].aiDailyMessages })
            : perk.id === "monthly-ai"
              ? t("pricing.featureAiMonthly", { count: PLAN_LIMITS[plan].aiMonthlyMessages })
              : t(perk.descriptionKey);

          return (
            <article
              key={perk.id}
              className="relative h-full w-[72vw] max-w-[19rem] snap-center overflow-hidden rounded-[2rem] bg-[var(--pricing-mobile-surface)]"
            >
              <Image
                src={perk.image}
                alt=""
                fill
                priority={index === 0}
                sizes="72vw"
                className="-translate-y-3 scale-110 object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 [background:linear-gradient(to_top,rgba(8,9,9,0.98)_0%,rgba(8,9,9,0.9)_25%,rgba(8,9,9,0.46)_52%,transparent_76%)]"
              />
              <div className="absolute inset-x-0 bottom-0 flex min-h-[6.5rem] flex-col items-center justify-end px-5 pb-5 text-center">
                <h2
                  className={cn(
                    "text-xl font-semibold leading-none text-white",
                    canUseSuperWater(locale) && "font-super-water",
                  )}
                >
                  {formatSuperWaterText(locale, t(perk.titleKey))}
                </h2>
                <p className="mt-2 max-w-[16rem] text-xs leading-4 text-white/80">{description}</p>
              </div>
            </article>
          );
        })}
      </div>
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
    <div className="relative flex h-12 shrink-0 rounded-full bg-[var(--pricing-mobile-surface)] p-1">
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
  price,
  cycle,
  hasFirstMonthTrial,
}: {
  price: string;
  cycle: BillingCycle;
  hasFirstMonthTrial: boolean;
}) {
  const t = useT();
  const period = cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth");

  return (
    <span className="flex flex-col items-center justify-center leading-tight">
      <span className="text-base font-semibold">
        {hasFirstMonthTrial ? t("pricing.ctaStartFirstMonthFreeTrial") : t("pricing.ctaSubscribe")}
      </span>
      <span className="mt-0.5 text-sm font-medium text-slate-950/55">
        {hasFirstMonthTrial
          ? t("pricing.ctaTrialAfter", { price, period })
          : t("pricing.ctaPriceWithPeriod", { price, period })}
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
}

function MobilePricingView({
  user,
  isTwa,
  localizedPricing,
  googlePlayPricing,
  entitlements,
  locale,
}: MobilePricingViewProps) {
  const t = useT();
  const [selectedOption, setSelectedOption] = useState<MobileOption>(DEFAULT_MOBILE_OPTION);
  const currentPlan = entitlements?.effectivePlan ?? null;
  const provider = entitlements?.provider ?? "lemon_squeezy";

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
    (currentPlan == null || currentPlan === "free");
  const ctaContent = selectedPrice ? (
    <MobileSubscriptionCtaContent
      price={selectedPrice}
      cycle={selectedOption.cycle}
      hasFirstMonthTrial={showsFirstMonthTrial}
    />
  ) : undefined;

  return (
    <div className="relative z-10 flex h-full flex-col overflow-hidden bg-[#080909] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-white lg:hidden">
      <header className="shrink-0 translate-y-1.5 text-center">
        <h1 className={cn("font-display text-[clamp(1.8rem,8vw,2.5rem)] font-semibold leading-[0.95] text-white", canUseSuperWater(locale) && "font-super-water")}>
          {formatSuperWaterText(locale, t("pricing.title"))}
        </h1>
        <p className={cn("mt-3 text-base font-semibold", PRICING_GRADIENT_TEXT_CLASS)}>
          {t("pricing.firstMonthFreeBanner")}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 items-center py-4">
        <MobilePricingPerkCarousel plan={selectedOption.plan} locale={locale} />
      </div>

      <div className="shrink-0">
        <div className="grid grid-cols-2 gap-2">
          {(["basic", "pro"] as const).map((plan) => {
            const isSelected = selectedOption.plan === plan;

            return (
              <button
                key={plan}
                type="button"
                onClick={() => handleSelect({ plan, cycle: selectedOption.cycle })}
                className="relative isolate flex h-16 flex-col items-center justify-center overflow-hidden rounded-full border border-transparent px-3 text-center"
                aria-pressed={isSelected}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border border-transparent [background:linear-gradient(var(--pricing-mobile-surface),var(--pricing-mobile-surface))_padding-box,linear-gradient(180deg,var(--pricing-mobile-surface-outline-top),var(--pricing-mobile-surface-outline-bottom))_border-box]"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 rounded-full border border-transparent [background:linear-gradient(135deg,#fde047,#f59e0b,#f97316)_padding-box,linear-gradient(180deg,#6a4600,#fff0a6)_border-box] transition-opacity duration-300 ease-out",
                    isSelected ? "opacity-100" : "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 font-display text-lg font-semibold leading-none transition-colors duration-300",
                    isSelected ? "text-slate-950" : "text-white",
                    canUseSuperWater(locale) && "font-super-water",
                  )}
                >
                  {formatSuperWaterText(locale, t(`pricing.${plan}`))}
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

      <div className="mt-2">
        <MobileBillingCycleToggle
          cycle={selectedOption.cycle}
          yearlyDiscountRate={yearlyDiscountRate}
          onChange={(cycle) => handleSelect({ plan: selectedOption.plan, cycle })}
        />
      </div>

      <div className="mt-3 shrink-0">
        {isCurrentPlan ? (
          <CurrentPlanButton className="h-14 rounded-2xl border-0 bg-[var(--pricing-mobile-surface)] text-base text-white" />
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            className={buttonClassName("primary", "lg", cn("h-14 w-full rounded-2xl border-0 text-base", PRICING_GRADIENT_BUTTON_CLASS))}
          >
            {ctaContent ?? t("pricing.ctaSubscribe")}
          </Link>
        ) : (
          <PurchaseButton
            plan={selectedOption.plan}
            cycle={selectedOption.cycle}
            currentPlan={currentPlan}
            provider={provider}
            className="h-14 rounded-2xl text-base"
            showSubscribeForPaidUser={currentPlan === "basic" && selectedOption.plan === "pro"}
            ctaContent={ctaContent}
          />
        )}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-center gap-3 text-[10px] text-white/45">
        <Link href="/terms" className="underline underline-offset-2">{t("pricing.consentTerms")}</Link>
        <Link href="/privacy" className="underline underline-offset-2">{t("pricing.consentPrivacy")}</Link>
      </div>
      </div>
    </div>
  );
}
