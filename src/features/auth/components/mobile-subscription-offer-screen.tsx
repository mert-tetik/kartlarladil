"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import Image from "next/image";
import {
  BookOpen,
  Gamepad2,
  Headset,
  Layers,
  MessageCircle,
  MessagesSquare,
  Palette,
} from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { getGooglePlayErrorMessage } from "@/features/subscriptions/google-play-errors";
import {
  getGooglePlayPricingDetails,
  getGooglePlaySku,
  useGooglePlayPricing,
} from "@/features/subscriptions/use-google-play-pricing";
import { createCheckoutAction } from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { markPendingWebSubscriptionCheckout } from "@/features/subscriptions/subscription-purchase-success";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import {
  formatCurrency,
  getLocalizedPrice,
  useLocalizedPricing,
} from "@/features/subscriptions/components/use-localized-pricing";
import {
  PLANS,
  TWA_PLANS,
  getReferenceUsdPrice,
} from "@/features/subscriptions/components/pricing-page";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";

interface MobileSubscriptionOfferScreenProps {
  onContinueFree: () => void;
}

export function MobileSubscriptionOfferScreen({
  onContinueFree,
}: MobileSubscriptionOfferScreenProps) {
  const t = useT();
  const { locale } = useLocale();
  const { presentPurchaseSuccess } = useSubscription();
  const isTwa = useTwaMode();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const localizedPricing = useLocalizedPricing(null, isTwa);
  const googlePlayPricing = useGooglePlayPricing();
  const { purchase, isLoading: isGooglePlayLoading, isSupported } = useGooglePlayBilling();
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isCheckoutPending, setIsCheckoutPending] = useState(false);

  const plans = isTwa ? TWA_PLANS : PLANS;
  const basicPlan = plans.find((item) => item.plan === "basic");
  const fallbackPrice = cycle === "yearly" ? basicPlan?.yearlyPrice : basicPlan?.monthlyPrice;
  const referenceUsdPrice = getReferenceUsdPrice("basic", cycle, isTwa);
  const googlePlayDetails = getGooglePlayPricingDetails(googlePlayPricing, "basic", cycle);
  const localized = getLocalizedPrice(localizedPricing, "basic", cycle);

  const showIntroOffer =
    isTwa && cycle === "monthly" && googlePlayDetails?.hasIntroductoryOffer;

  const priceDisplay = useMemo(() => {
    if (googlePlayDetails) {
      const amount = Number.parseFloat(googlePlayDetails.price.value);
      return {
        primary: formatCurrency(amount, googlePlayDetails.price.currency, locale),
        original: referenceUsdPrice !== null ? `USD $${referenceUsdPrice}` : "",
      };
    }

    if (localized) {
      return {
        primary: formatCurrency(localized.amount, localized.currencyCode, locale),
        original: referenceUsdPrice !== null ? `USD $${referenceUsdPrice}` : "",
      };
    }

    return {
      primary: fallbackPrice != null ? `$${fallbackPrice}` : "",
      original: "",
    };
  }, [fallbackPrice, googlePlayDetails, localized, referenceUsdPrice, locale]);

  const monthlyEquivalent = useMemo(() => {
    if (cycle !== "yearly" || basicPlan?.yearlyPrice == null) return null;

    const yearlyDetails = getGooglePlayPricingDetails(googlePlayPricing, "basic", "yearly");
    if (yearlyDetails) {
      return formatCurrency(
        Number.parseFloat(yearlyDetails.price.value) / 12,
        yearlyDetails.price.currency,
        locale,
      );
    }

    const yearlyLocalized = getLocalizedPrice(localizedPricing, "basic", "yearly");
    if (yearlyLocalized) {
      return formatCurrency(yearlyLocalized.amount / 12, yearlyLocalized.currencyCode, locale);
    }

    return (basicPlan.yearlyPrice / 12).toFixed(2);
  }, [cycle, basicPlan, googlePlayPricing, localizedPricing, locale]);

  async function handlePurchase() {
    setPurchaseError(null);

    if (isTwa) {
      try {
        await purchase(getGooglePlaySku("basic", cycle));
        presentPurchaseSuccess();
        onContinueFree();
      } catch (error) {
        setPurchaseError(
          getGooglePlayErrorMessage(
            error,
            t("pricing.error.checkoutFailed"),
            t("pricing.error.clientAppUnavailable"),
          ),
        );
      }
      return;
    }

    setIsCheckoutPending(true);
    try {
      const formData = new FormData();
      formData.set("plan", "basic");
      formData.set("cycle", cycle);
      const result = await createCheckoutAction({ status: "idle", message: "" }, formData);

      if (result.status === "success" && result.checkoutUrl) {
        markPendingWebSubscriptionCheckout();
        onContinueFree();
        window.location.href = result.checkoutUrl;
        return;
      }

      if (result.status === "success" && result.customerPortalUrl) {
        onContinueFree();
        window.location.assign(result.customerPortalUrl);
        return;
      }

      setPurchaseError(result.message || t("pricing.error.checkoutFailed"));
    } catch {
      setPurchaseError(t("pricing.error.checkoutFailed"));
    } finally {
      setIsCheckoutPending(false);
    }
  }

  const isLoading = isGooglePlayLoading || isCheckoutPending;

  return (
    <div data-mobile-subscription-offer className="animate-screen-pop flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden overflow-y-auto bg-[#070707] pb-[env(safe-area-inset-bottom)] text-center text-white">
      <div className="relative isolate h-[42vh] min-h-[260px] w-full overflow-hidden">
        <Image
          src="/onboarding-premium-hero.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/75 to-black/20" />
        <div className="absolute inset-x-0 bottom-4 top-auto flex flex-col items-center px-4">
          <span className="font-display text-4xl font-bold uppercase tracking-tighter text-yellow-400 drop-shadow-sm sm:text-5xl">
            {t("pricing.firstMonthFree")}
          </span>
          <span className="mt-1 text-xs font-semibold uppercase tracking-widest text-foreground-secondary">
            {t("pricing.billingMonthly")}
          </span>
        </div>
      </div>

      <div className="flex flex-col px-6 pb-8 pt-2">
        <div className="mt-4 flex items-baseline justify-center gap-1">
          <span className="font-display text-5xl font-semibold text-white">
            {priceDisplay.primary}
          </span>
          <span className="text-sm text-white/60">
            {cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth")}
          </span>
        </div>

        {priceDisplay.original ? (
          <p className="text-xs text-white/55">{priceDisplay.original}</p>
        ) : null}

        {cycle === "yearly" && monthlyEquivalent ? (
          <p className="mt-1 text-xs text-emerald-600">
            {t("pricing.monthlyEquivalent", { price: monthlyEquivalent })}
          </p>
        ) : null}

        {showIntroOffer ? (
          <p className="mt-2 text-sm font-bold uppercase text-brand">
            {t("pricing.firstMonthFree")}
          </p>
        ) : null}

        <h2 className="mt-4 font-display text-3xl font-semibold text-white">
          {t("pricing.seriousLearner")}
        </h2>
        <p className="mt-2 text-base leading-6 text-white/75">
          {t("pricing.description")}
        </p>

        <div className="mx-auto mt-5 inline-flex rounded-full border border-border bg-background-muted p-1">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              cycle === "monthly"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-white/65 hover:text-white",
            )}
          >
            {t("pricing.billingMonthly")}
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              cycle === "yearly"
                ? "bg-brand text-brand-foreground shadow-sm"
                : "text-white/65 hover:text-white",
            )}
          >
            {t("pricing.billingYearly")}
          </button>
        </div>

        <ul className="mt-5 divide-y divide-white/15 text-center">
          <OfferPerk icon={Layers} colorClass="text-blue-500">{t("pricing.featureCards")}</OfferPerk>
          <OfferPerk icon={BookOpen} colorClass="text-emerald-500">{t("pricing.featureLearned")}</OfferPerk>
          <OfferPerk icon={Palette} colorClass="text-violet-500">{t("pricing.featureThemes")}</OfferPerk>
          <OfferPerk icon={Gamepad2} colorClass="text-cyan-500">{t("pricing.featureGames")}</OfferPerk>
          <OfferPerk icon={Headset} colorClass="text-fuchsia-500">{t("pricing.featurePrioritySupport")}</OfferPerk>
          <OfferPerk icon={MessageCircle} colorClass="text-amber-500">
            {t("pricing.featureAiDaily", { count: PLAN_LIMITS.basic.aiDailyMessages })}
          </OfferPerk>
          <OfferPerk icon={MessagesSquare} colorClass="text-rose-500">
            {t("pricing.featureAiMonthly", { count: PLAN_LIMITS.basic.aiMonthlyMessages })}
          </OfferPerk>
        </ul>

        <Button
          type="button"
          size="lg"
          onClick={handlePurchase}
          disabled={isLoading || (isTwa && !isSupported)}
          className="mt-6 h-14 w-full border-0 bg-brand text-base font-bold text-brand-foreground shadow-lg hover:bg-brand-hover"
        >
          {isLoading ? t("common.loading") : t("pricing.ctaUpgrade")}
        </Button>

        {isTwa && !isSupported ? (
          <p className="mt-2 text-center text-xs text-foreground-muted">
            {t("pricing.googlePlayUnavailable")}
          </p>
        ) : purchaseError ? (
          <p className="mt-2 text-center text-xs text-rose-600">{purchaseError}</p>
        ) : null}

        <button
          type="button"
          onClick={onContinueFree}
          className={buttonClassName(
            "ghost",
            "lg",
            "mt-3 h-12 w-full text-base font-semibold text-white hover:text-white",
          )}
        >
          {t("pricing.ctaSkip")}
        </button>
      </div>
    </div>
  );
}

function OfferPerk({
  icon: Icon,
  colorClass,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  colorClass: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start justify-center gap-4 py-3 text-[0.95rem] leading-6 text-white">
      <Icon className={cn("mt-0.5 size-5 shrink-0", colorClass)} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}
