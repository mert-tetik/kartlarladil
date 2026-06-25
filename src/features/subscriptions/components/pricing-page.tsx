"use client";

import { useActionState, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { createCheckoutAction } from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
  type LocalizedPricingStatus,
} from "@/features/subscriptions/components/use-localized-pricing";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { SubscriptionPlan } from "@/types/domain";

type BillingCycle = "monthly" | "yearly";

interface PricingPageProps {
  user: AuthShellUser | null;
  currencyCode: string | null;
}

interface PricingPlan {
  plan: SubscriptionPlan;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  popular?: boolean;
  mascot?: string;
}

const PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null, mascot: "/mascots/mascot14.png" },
  { plan: "basic", monthlyPrice: 3, yearlyPrice: 30, mascot: "/mascots/mascot15.png" },
  { plan: "pro", monthlyPrice: 9, yearlyPrice: 90, popular: true, mascot: "/mascots/mascot16.png" },
];

export function PricingPage({ user, currencyCode }: PricingPageProps) {
  const t = useT();
  const { locale } = useLocale();
  const { entitlements } = useSubscription();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const localizedPricing = useLocalizedPricing(currencyCode);

  return (
    <div className="animate-screen-pop mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <CheckoutSuccessPoller />
      </Suspense>
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-foreground md:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-foreground-secondary">
          {t("pricing.description")}
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <BillingCycleToggle cycle={cycle} onChange={setCycle} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {PLANS.map((item) => (
          <PricingCard
            key={item.plan}
            plan={item.plan}
            monthlyPrice={item.monthlyPrice}
            yearlyPrice={item.yearlyPrice}
            popular={item.popular}
            mascot={item.mascot}
            cycle={cycle}
            currentPlan={entitlements?.effectivePlan ?? null}
            user={user}
            localizedPricing={localizedPricing}
            uiLocale={locale}
          />
        ))}
      </div>

      <PaymentProviderNotes />
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
  user,
  localizedPricing,
  uiLocale,
}: PricingPlan & {
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  user: AuthShellUser | null;
  localizedPricing: LocalizedPricingStatus;
  uiLocale: string;
}) {
  const t = useT();
  const isCurrent = currentPlan === plan;
  const price = cycle === "yearly" ? yearlyPrice : monthlyPrice;
  const localized = getLocalizedPrice(localizedPricing, plan, cycle);
  const localizedYearly = cycle === "yearly" ? localized : getLocalizedPrice(localizedPricing, plan, "yearly");
  const discountRate = useMemo(() => {
    if (monthlyPrice == null || yearlyPrice == null) return null;
    return Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  }, [monthlyPrice, yearlyPrice]);

  const priceDisplay = useMemo(() => {
    if (price === null) return { primary: t("pricing.priceFree"), original: "" };
    if (localized) {
      return {
        primary: formatCurrency(localized.amount, localized.currencyCode, uiLocale),
        original: `≈ $${price}`,
      };
    }
    return { primary: `$${price}`, original: "" };
  }, [price, localized, uiLocale, t]);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border border-border bg-background-card p-6 text-foreground",
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
        {price !== null ? (
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

      {cycle === "yearly" && price !== null && discountRate != null ? (
        <p className={cn("mt-1 text-xs font-medium", "text-emerald-600")}>
          {t("pricing.yearlyDiscount", { rate: discountRate })}
        </p>
      ) : null}

      {cycle === "yearly" && monthlyPrice != null && yearlyPrice != null ? (
        <p className={cn("mt-1 text-xs", "text-foreground-muted")}>
          {t("pricing.monthlyEquivalent", {
            price:
              localizedYearly
                ? formatCurrency(localizedYearly.amount / 12, localizedYearly.currencyCode, uiLocale)
                : (yearlyPrice / 12).toFixed(2),
          })}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        <Feature included={plan !== "free"}>{t("pricing.featureCards")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearned")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureThemes")}</Feature>
        <Feature included>{t("pricing.featureAiDaily", { count: PLAN_LIMITS[plan].aiDailyMessages })}</Feature>
        <Feature included>{t("pricing.featureAiMonthly", { count: PLAN_LIMITS[plan].aiMonthlyMessages })}</Feature>
      </ul>

      <div className="mt-8">
        {isCurrent ? (
          <Button variant="secondary" className="w-full" disabled>
            {t("pricing.ctaCurrent")}
          </Button>
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            className={buttonClassName("primary", "md", "w-full")}
          >
            {t("pricing.ctaFree")}
          </Link>
        ) : plan === "free" ? (
          <Button variant="secondary" className="w-full" disabled>
            {t("pricing.ctaCurrent")}
          </Button>
        ) : (
          <>
            <PurchaseButton plan={plan} cycle={cycle} currentPlan={currentPlan} />
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
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
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

  const isPaidUser = currentPlan !== "free";

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />
      <Button
        type="submit"
        variant="primary"
        className={cn(
          "w-full border-0",
          (plan === "basic" || plan === "pro") && "bg-brand text-foreground hover:bg-brand-hover",
        )}
        disabled={pending}
      >
        {pending ? t("common.loading") : isPaidUser ? t("pricing.ctaManage") : t("pricing.ctaUpgrade")}
      </Button>
      {state.status === "error" ? <p className="mt-2 text-center text-xs text-rose-600">{state.message}</p> : null}
    </form>
  );
}

function PurchaseButton({
  plan,
  cycle,
  currentPlan,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
}) {
  const isTwa = useTwaMode();

  if (isTwa) {
    return <GooglePlayCheckoutButton plan={plan} cycle={cycle} currentPlan={currentPlan} />;
  }

  return <CheckoutButton plan={plan} cycle={cycle} currentPlan={currentPlan} />;
}

function GooglePlayCheckoutButton({
  plan,
  cycle,
  currentPlan,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
}) {
  const t = useT();
  const { purchase, isLoading } = useGooglePlayBilling();
  const isPaidUser = currentPlan !== "free";

  const handleClick = async () => {
    if (isPaidUser) {
      window.open(
        `https://play.google.com/store/account/subscriptions?package=com.foxiesdeck&sku=${getGooglePlaySku(plan, cycle)}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }

    await purchase(getGooglePlaySku(plan, cycle));
  };

  return (
    <Button
      type="button"
      variant="primary"
      className={cn(
        "w-full border-0",
        (plan === "basic" || plan === "pro") && "bg-brand text-foreground hover:bg-brand-hover",
      )}
      disabled={isLoading}
      onClick={() => void handleClick()}
    >
      {isLoading ? t("common.loading") : isPaidUser ? t("pricing.ctaManage") : t("pricing.ctaUpgrade")}
    </Button>
  );
}

function getGooglePlaySku(plan: Exclude<SubscriptionPlan, "free">, cycle: BillingCycle): string {
  return `${plan}_${cycle}`;
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
