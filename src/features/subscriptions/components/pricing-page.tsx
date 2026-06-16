"use client";

import { useActionState, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { createCheckoutAction } from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { SubscriptionPlan } from "@/types/domain";

type BillingCycle = "monthly" | "yearly";

interface PricingPageProps {
  user: AuthShellUser | null;
}

interface PricingPlan {
  plan: SubscriptionPlan;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  popular?: boolean;
}

const PLANS: PricingPlan[] = [
  { plan: "free", monthlyPrice: null, yearlyPrice: null },
  { plan: "basic", monthlyPrice: 3, yearlyPrice: 30 },
  { plan: "pro", monthlyPrice: 9, yearlyPrice: 90, popular: true },
];

export function PricingPage({ user }: PricingPageProps) {
  const t = useT();
  const { entitlements } = useSubscription();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Suspense fallback={null}>
        <CheckoutSuccessPoller />
      </Suspense>
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-slate-950 md:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
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
            cycle={cycle}
            currentPlan={entitlements?.effectivePlan ?? null}
            user={user}
          />
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-2xl space-y-2 text-center text-sm text-slate-500">
        <p>{t("pricing.paymentProvider")}</p>
        <p>{t("pricing.cancelAnytime")}</p>
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
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          cycle === "monthly"
            ? "bg-[#f76808] text-white shadow-sm"
            : "text-slate-600 hover:text-slate-950",
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
            ? "bg-[#f76808] text-white shadow-sm"
            : "text-slate-600 hover:text-slate-950",
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
  cycle,
  currentPlan,
  user,
}: PricingPlan & {
  cycle: BillingCycle;
  currentPlan: SubscriptionPlan | null;
  user: AuthShellUser | null;
}) {
  const t = useT();
  const isCurrent = currentPlan === plan;
  const price = cycle === "yearly" ? yearlyPrice : monthlyPrice;
  const discountRate = useMemo(() => {
    if (monthlyPrice == null || yearlyPrice == null) return null;
    return Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
  }, [monthlyPrice, yearlyPrice]);

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-6",
        popular
          ? "border-[#f76808] bg-[#f76808] text-white"
          : "border-slate-200 bg-white text-slate-950",
      )}
    >
      {popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">
          {t("pricing.mostPopular")}
        </span>
      ) : null}

      <h2 className="text-lg font-semibold">{t(`pricing.${plan}`)}</h2>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-display text-4xl font-semibold">
          {price === null ? t("pricing.priceFree") : `$${price}`}
        </span>
        {price !== null ? (
          <span className={cn("text-sm", popular ? "text-slate-300" : "text-slate-500")}>
            {cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth")}
          </span>
        ) : null}
      </div>

      {cycle === "yearly" && price !== null && discountRate != null ? (
        <p className={cn("mt-1 text-xs font-medium", popular ? "text-emerald-400" : "text-emerald-600")}>
          {t("pricing.yearlyDiscount", { rate: discountRate })}
        </p>
      ) : null}

      {cycle === "yearly" && monthlyPrice != null && yearlyPrice != null ? (
        <p className={cn("mt-1 text-xs", popular ? "text-slate-400" : "text-slate-500")}>
          {t("pricing.monthlyEquivalent", { price: (yearlyPrice / 12).toFixed(2) })}
        </p>
      ) : null}

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        <Feature included={plan !== "free"}>{t("pricing.featureCards")}</Feature>
        <Feature included={plan !== "free"}>{t("pricing.featureLearned")}</Feature>
        <Feature included>{t("pricing.featureAiDaily", { count: getAiDailyLimit(plan) })}</Feature>
        <Feature included>{t("pricing.featureAiMonthly", { count: getAiMonthlyLimit(plan) })}</Feature>
      </ul>

      <div className="mt-8">
        {isCurrent ? (
          <Button variant="secondary" className="w-full" disabled>
            {t("pricing.ctaCurrent")}
          </Button>
        ) : !user ? (
          <Link
            href={`/register?next=${encodeURIComponent("/pricing")}`}
            className={buttonClassName(popular ? "secondary" : "primary", "md", "w-full")}
          >
            {t("pricing.ctaFree")}
          </Link>
        ) : plan === "free" ? (
          <Button variant="secondary" className="w-full" disabled>
            {t("pricing.ctaCurrent")}
          </Button>
        ) : (
          <>
            <CheckoutButton plan={plan} popular={popular} cycle={cycle} />
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
        <X className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
      )}
      <span className={included ? "" : "text-slate-500 line-through"}>{children}</span>
    </li>
  );
}

function CheckoutButton({
  plan,
  popular,
  cycle,
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  popular?: boolean;
  cycle: BillingCycle;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createCheckoutAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status === "success" && state.checkoutUrl) {
      if (typeof window !== "undefined" && window.LemonSqueezy?.Url?.Open) {
        window.createLemonSqueezy?.();
        window.LemonSqueezy.Url.Open(state.checkoutUrl);
      } else {
        window.location.href = state.checkoutUrl;
      }
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />
      <Button
        type="submit"
        variant={popular ? "secondary" : "primary"}
        className={cn(
          "w-full border-0",
          plan === "basic" && "bg-[#f76808] text-slate-950 hover:bg-[#e05d00]",
        )}
        disabled={pending}
      >
        {pending ? t("common.loading") : t("pricing.ctaUpgrade")}
      </Button>
      {state.status === "error" ? <p className="mt-2 text-center text-xs text-rose-600">{state.message}</p> : null}
    </form>
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
    <p className="mt-3 text-center text-xs text-slate-500">
      {t("pricing.consentPrefix")}
      <Link href="/terms" className="underline hover:text-slate-700">
        {t("pricing.consentTerms")}
      </Link>
      {t("pricing.consentAnd")}
      <Link href="/privacy" className="underline hover:text-slate-700">
        {t("pricing.consentPrivacy")}
      </Link>
      {t("pricing.consentSuffix")}
    </p>
  );
}

function getAiDailyLimit(plan: SubscriptionPlan): number {
  switch (plan) {
    case "free":
      return 10;
    case "basic":
      return 30;
    case "pro":
      return 150;
  }
}

function getAiMonthlyLimit(plan: SubscriptionPlan): number {
  switch (plan) {
    case "free":
      return 200;
    case "basic":
      return 900;
    case "pro":
      return 4500;
  }
}
