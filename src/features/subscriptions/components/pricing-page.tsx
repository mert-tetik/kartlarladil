"use client";

import { useActionState, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  Check,
  X,
  Headset,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import {
  createCheckoutAction,
} from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
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
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
  type LocalizedPricingStatus,
} from "@/features/subscriptions/components/use-localized-pricing";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { SubscriptionPlan, SubscriptionProvider } from "@/types/domain";

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
const PRICING_STICKY_CTA_CLASS = "h-[3.25rem] whitespace-nowrap text-sm";

export const PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null, mascot: "/mascots/mascot14.png" },
  { plan: "basic", monthlyPrice: 3, yearlyPrice: 30, mascot: "/mascots/mascot15.png" },
  { plan: "pro", monthlyPrice: 9, yearlyPrice: 90, popular: true, mascot: "/mascots/mascot16.png" },
];

export const TWA_PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null, mascot: "/mascots/mascot14.png" },
  { plan: "basic", monthlyPrice: 2, yearlyPrice: 20, mascot: "/mascots/mascot15.png" },
  { plan: "pro", monthlyPrice: 6, yearlyPrice: 60, popular: true, mascot: "/mascots/mascot16.png" },
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
      className="relative isolate mx-auto min-h-screen max-w-6xl px-4 pb-0 pt-12 sm:px-6 lg:px-8 lg:pb-10"
    >
      <Suspense fallback={null}>
        <CheckoutSuccessPoller />
      </Suspense>

      <div className="lg:hidden">
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
          <h1 className="font-display text-4xl font-semibold text-brand md:text-5xl">
            {t("pricing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-foreground-secondary">
            {t("pricing.description")}
          </p>
          {isTwa ? (
            <p className="mt-3 text-sm font-bold uppercase text-brand">
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
            ? "bg-brand text-brand-foreground shadow-sm"
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
            ? "bg-brand text-brand-foreground shadow-sm"
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
        <p className="mt-2 text-sm font-bold uppercase text-brand">
          {t("pricing.firstMonthFree")}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        <Feature included={plan !== "free"}>{t("pricing.featureCards")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearned")}</Feature>
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
            className={buttonClassName("primary", "md", cn("w-full", PRICING_CARD_CTA_CLASS))}
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
            <ConsentText />
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
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
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
          (plan === "basic" || plan === "pro") && "bg-brand text-foreground hover:bg-brand-hover",
          className,
        )}
        disabled={pending}
      >
        {pending ? t("common.loading") : isPaidUser ? t("pricing.ctaManage") : t("pricing.ctaSubscribe")}
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
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  provider: SubscriptionProvider;
  className?: string;
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
    return <GooglePlayCheckoutButton plan={plan} cycle={cycle} currentPlan={currentPlan} className={className} />;
  }

  return <CheckoutButton plan={plan} cycle={cycle} currentPlan={currentPlan} className={className} />;
}

function GooglePlayCheckoutButton({
  plan,
  cycle,
  currentPlan,
  className,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  className?: string;
}) {
  const t = useT();
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
        ? t("pricing.ctaManage")
        : t("pricing.ctaSubscribe");

  return (
    <div className="w-full space-y-2">
      <Button
        type="button"
        variant="primary"
        className={cn(
          "h-12 w-full border-0 whitespace-nowrap text-sm",
          (plan === "basic" || plan === "pro") && "bg-brand text-foreground hover:bg-brand-hover",
          className,
        )}
        disabled={isLoading || !isSupported}
        onClick={handleClick}
      >
        {buttonLabel}
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

function CheckoutSuccessPoller() {
  const t = useT();
  const searchParams = useSearchParams();
  const { refreshEntitlements } = useSubscription();
  const isCheckoutSuccess = searchParams.get("checkout") === "success";
  const [visible, setVisible] = useState(isCheckoutSuccess);

  useEffect(() => {
    if (!isCheckoutSuccess) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 5;

    void refreshEntitlements();

    const interval = setInterval(() => {
      void refreshEntitlements();
      attempts += 1;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 3000);

    const hideTimeout = setTimeout(() => setVisible(false), 8000);

    if (typeof window !== "undefined" && window.history.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }

    return () => {
      clearInterval(interval);
      clearTimeout(hideTimeout);
    };
  }, [isCheckoutSuccess, refreshEntitlements]);

  if (!visible) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-800">
      {t("pricing.checkoutSuccess")}
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
  popular?: boolean;
};

const MOBILE_OPTIONS: MobileOption[] = [
  { plan: "basic", cycle: "monthly", popular: true },
  { plan: "basic", cycle: "yearly" },
  { plan: "pro", cycle: "monthly" },
  { plan: "pro", cycle: "yearly" },
];

const MASCOT_BY_PLAN: Record<Exclude<SubscriptionPlan, "free">, string> = {
  basic: "/mascots/mascot15.png",
  pro: "/mascots/mascot16.png",
};

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
}) {
  const t = useT();
  const plans = isTwa ? TWA_PLANS : PLANS;
  const planItem = plans.find((item) => item.plan === plan);
  const googlePlayDetails = getGooglePlayPricingDetails(googlePlayPricing, plan, cycle);
  const fallbackPrice = cycle === "yearly" ? planItem?.yearlyPrice : planItem?.monthlyPrice;
  const localized = getLocalizedPrice(localizedPricing, plan, cycle);

  let primary: string;
  if (googlePlayDetails) {
    const amount = Number.parseFloat(googlePlayDetails.price.value);
    primary = formatCurrency(amount, googlePlayDetails.price.currency, uiLocale);
  } else if (localized) {
    primary = formatCurrency(localized.amount, localized.currencyCode, uiLocale);
  } else if (fallbackPrice != null) {
    primary = `$${fallbackPrice}`;
  } else {
    primary = t("pricing.priceFree");
  }

  return (
    <div className="absolute right-0 top-1/2 flex -translate-y-1/2 shrink-0 flex-col items-end text-right leading-none">
      <span className="font-display text-lg font-semibold tabular-nums text-foreground">
        {primary}
      </span>
      <span className="mt-1 text-[11px] font-medium text-foreground-muted">
        {cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth")}
      </span>
    </div>
  );
}

function MobilePerkItem({
  icon: Icon,
  colorClass,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-4 py-3.5 text-[0.95rem] leading-6 text-foreground">
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", colorClass)} />
      <span>{children}</span>
    </li>
  );
}

interface MobilePricingViewProps {
  user: AuthShellUser | null;
  isTwa: boolean;
  localizedPricing: LocalizedPricingStatus;
  googlePlayPricing: GooglePlayPricingStatus;
  entitlements: ReturnType<typeof useSubscription>["entitlements"];
  locale: string;
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
  const [selectedOption, setSelectedOption] = useState<MobileOption>(MOBILE_OPTIONS[0]);
  const currentPlan = entitlements?.effectivePlan ?? null;
  const provider = entitlements?.provider ?? "lemon_squeezy";
  const stickyPortalTarget = typeof document === "undefined" ? null : document.body;

  const handleSelect = (option: MobileOption) => {
    vibrate("tap");
    setSelectedOption(option);
  };

  const isCurrentPlan = currentPlan === selectedOption.plan;
  const selectedPlanLabel = t(`pricing.${selectedOption.plan}`);

  return (
    <div className="relative z-10 flex flex-col pb-[7.5rem] lg:hidden">
      <div className="animate-screen-pop">
        <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-brand">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-foreground-secondary">
          {t("pricing.description")}
        </p>
        {isTwa ? (
          <p className="mt-2 text-xs font-bold uppercase text-brand">
            {t("pricing.firstMonthFreeBanner")}
          </p>
        ) : null}
        </div>

        <div className="mt-8 space-y-3">
        {MOBILE_OPTIONS.map((option) => {
          const isSelected =
            selectedOption.plan === option.plan && selectedOption.cycle === option.cycle;
          const planLabel = t(`pricing.${option.plan}`);
          const cycleLabel =
            option.cycle === "yearly" ? t("pricing.billingYearly") : t("pricing.billingMonthly");
          const yearlyDiscountRate =
            option.cycle === "yearly" ? getPlanDiscountRate(option.plan, isTwa) : null;
          const yearlySavingsLabel =
            yearlyDiscountRate && yearlyDiscountRate > 0
              ? t("pricing.yearlyDiscount", { rate: yearlyDiscountRate })
              : null;

          return (
            <button
              key={`${option.plan}-${option.cycle}`}
              type="button"
              onClick={() => handleSelect(option)}
              className={cn(
                "relative flex h-24 w-full items-center gap-3 rounded-2xl border-2 px-4 transition-all",
                isSelected
                  ? "border-brand bg-background-card shadow-md"
                  : "border-border bg-background-card/60 hover:border-brand/40"
              )}
            >
              {option.popular ? (
                <span className="absolute -top-2.5 left-4 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  {t("pricing.mostPopular")}
                </span>
              ) : null}
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-brand bg-brand text-white"
                    : "border-foreground-muted bg-transparent"
                )}
              >
                {isSelected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </div>
              <div className="relative flex min-w-0 flex-1 flex-col justify-center pr-22">
                {option.cycle === "monthly" ? (
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-left text-[10px] font-bold text-transparent">
                    {t("pricing.firstMonthFree")}
                  </span>
                ) : null}
                <span className="mt-0.5 truncate text-left font-display text-base font-semibold">
                  {planLabel}
                </span>
                <span className="mt-1 text-left text-[11px] font-medium text-foreground-muted">
                  {cycleLabel}
                </span>
                {yearlySavingsLabel ? (
                  <span className="mt-1 bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-200 bg-clip-text text-left text-[10px] font-bold text-transparent">
                    {yearlySavingsLabel}
                  </span>
                ) : null}
                <MobileOptionPrice
                  plan={option.plan}
                  cycle={option.cycle}
                  localizedPricing={localizedPricing}
                  googlePlayPricing={googlePlayPricing}
                  uiLocale={locale}
                  isTwa={isTwa}
                />
              </div>
              <div className="relative h-12 w-12 shrink-0">
                <Image
                  src={MASCOT_BY_PLAN[option.plan]}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-contain"
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-transparent bg-transparent p-5">
        <h2 className="bg-gradient-to-r from-amber-300 via-yellow-200 to-orange-400 bg-clip-text text-center font-display text-[1.65rem] font-bold leading-tight text-transparent">
          {t("pricing.mobileFeaturesTitle", { plan: selectedPlanLabel })}
        </h2>
        <ul className="mt-4 divide-y divide-border/45">
          <MobilePerkItem icon={Sparkles} colorClass="text-amber-400">
            {t("pricing.mobileFeatureUnlimitedAccess")}
          </MobilePerkItem>
          <MobilePerkItem icon={Palette} colorClass="text-violet-500">
            {t("pricing.featureThemes")}
          </MobilePerkItem>
          <MobilePerkItem icon={Headset} colorClass="text-fuchsia-500">
            {t("pricing.featurePrioritySupport")}
          </MobilePerkItem>
        </ul>
      </div>

        <div className="relative z-10 mt-10">
          <PaymentProviderNotes />
          <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-foreground-muted">
            {t("pricing.contactEmail")}
          </p>
        </div>
      </div>

      {stickyPortalTarget
        ? createPortal(
            <div
              className="pointer-events-none fixed inset-x-0 z-30 lg:hidden"
              style={{ bottom: 0 }}
            >
              <div className="pointer-events-auto w-full border-t border-border bg-background/95 px-4 pb-3 pt-3 shadow-sm backdrop-blur-md">
                {isCurrentPlan ? (
                  <CurrentPlanButton className={PRICING_STICKY_CTA_CLASS} />
                ) : !user ? (
                  <Link
                    href={`/register?next=${encodeURIComponent("/pricing")}`}
                    className={buttonClassName("primary", "lg", cn("w-full", PRICING_STICKY_CTA_CLASS))}
                  >
                    {t("pricing.ctaSubscribe")}
                  </Link>
                ) : (
                  <PurchaseButton
                    plan={selectedOption.plan}
                    cycle={selectedOption.cycle}
                    currentPlan={currentPlan}
                    provider={provider}
                    className={PRICING_STICKY_CTA_CLASS}
                  />
                )}
                <ConsentText />
              </div>
            </div>,
            stickyPortalTarget,
          )
        : null}
    </div>
  );
}
