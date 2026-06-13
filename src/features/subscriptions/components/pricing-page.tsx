"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { createCheckoutAction } from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { SubscriptionPlan } from "@/types/domain";

interface PricingPageProps {
  user: AuthShellUser | null;
}

interface PricingPlan {
  plan: SubscriptionPlan;
  price: number | null;
  popular?: boolean;
}

export function PricingPage({ user }: PricingPageProps) {
  const t = useT();
  const { entitlements, isLoading } = useSubscription();

  const plans: PricingPlan[] = [
    { plan: "free", price: null },
    { plan: "basic", price: 3 },
    { plan: "pro", price: 9, popular: true },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-slate-950 md:text-5xl">
          {t("pricing.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
          {t("pricing.description")}
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((item) => (
          <PricingCard
            key={item.plan}
            plan={item.plan}
            price={item.price}
            popular={item.popular}
            currentPlan={entitlements?.effectivePlan ?? null}
            isLoading={isLoading}
            user={user}
          />
        ))}
      </div>
    </div>
  );
}

function PricingCard({
  plan,
  price,
  popular,
  currentPlan,
  isLoading,
  user,
}: PricingPlan & {
  currentPlan: SubscriptionPlan | null;
  isLoading: boolean;
  user: AuthShellUser | null;
}) {
  const t = useT();
  const isCurrent = currentPlan === plan;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-6",
        popular
          ? "border-slate-950 bg-slate-950 text-white"
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
            {t("pricing.perMonth")}
          </span>
        ) : null}
      </div>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        <Feature included={plan !== "free"} popular={popular}>
          {t("pricing.featureCards")}
        </Feature>
        <Feature included={plan !== "free"} popular={popular}>
          {t("pricing.featureLearned")}
        </Feature>
        <Feature included>
          {t("pricing.featureAiDaily", { count: getAiDailyLimit(plan) })}
        </Feature>
        <Feature included>
          {t("pricing.featureAiMonthly", { count: getAiMonthlyLimit(plan) })}
        </Feature>
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
          <CheckoutButton plan={plan} popular={popular} />
        )}
      </div>
    </div>
  );
}

function Feature({
  included,
  popular,
  children,
}: {
  included: boolean;
  popular?: boolean;
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
}: {
  plan: Exclude<SubscriptionPlan, "free">;
  popular?: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(createCheckoutAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status === "success" && state.checkoutUrl) {
      window.location.href = state.checkoutUrl;
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <Button
        type="submit"
        variant={popular ? "secondary" : "primary"}
        className="w-full"
        disabled={pending}
      >
        {pending ? t("common.loading") : t("pricing.ctaUpgrade")}
      </Button>
      {state.status === "error" ? (
        <p className="mt-2 text-center text-xs text-rose-600">{state.message}</p>
      ) : null}
    </form>
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
