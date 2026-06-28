"use client";

import { useEffect, useState } from "react";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import type { SubscriptionPlan } from "@/types/domain";

export type BillingCycle = "monthly" | "yearly";

export const GOOGLE_PLAY_SKUS: Record<
  Exclude<SubscriptionPlan, "free">,
  Record<BillingCycle, string>
> = {
  basic: {
    monthly: "basic_monthly",
    yearly: "basic_yearly",
  },
  pro: {
    monthly: "pro_monthly",
    yearly: "pro_yearly",
  },
};

export function getGooglePlaySku(
  plan: Exclude<SubscriptionPlan, "free">,
  cycle: BillingCycle,
): string {
  return GOOGLE_PLAY_SKUS[plan][cycle];
}

export interface GooglePlayPricingDetails {
  sku: string;
  plan: Exclude<SubscriptionPlan, "free">;
  cycle: BillingCycle;
  price: PaymentCurrencyAmount;
  title: string;
  description?: string;
  subscriptionPeriod?: string;
  introductoryPrice: PaymentCurrencyAmount | null;
  introductoryPricePeriod: string | null;
  introductoryPriceCycles: number | null;
  hasIntroductoryOffer: boolean;
}

export type GooglePlayPricingStatus =
  | { kind: "loading" }
  | { kind: "ready"; details: GooglePlayPricingDetails[] }
  | { kind: "unavailable" };

export function useGooglePlayPricing(): GooglePlayPricingStatus {
  const { isSupported, getProductDetails } = useGooglePlayBilling();
  const [status, setStatus] = useState<GooglePlayPricingStatus>(() =>
    isSupported ? { kind: "loading" } : { kind: "unavailable" },
  );

  useEffect(() => {
    if (!isSupported) return;

    let cancelled = false;

    async function load() {
      const skus = [
        getGooglePlaySku("basic", "monthly"),
        getGooglePlaySku("basic", "yearly"),
        getGooglePlaySku("pro", "monthly"),
        getGooglePlaySku("pro", "yearly"),
      ];

      try {
        const items = (await getProductDetails(skus)) as DigitalGoodsItemDetails[];
        const details = items.map(parseGooglePlayItemDetails);
        if (cancelled) return;
        setStatus({ kind: "ready", details });
      } catch {
        if (cancelled) return;
        setStatus({ kind: "unavailable" });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isSupported, getProductDetails]);

  return status;
}

export function getGooglePlayPricingDetails(
  status: GooglePlayPricingStatus,
  plan: Exclude<SubscriptionPlan, "free">,
  cycle: BillingCycle,
): GooglePlayPricingDetails | null {
  if (status.kind !== "ready") return null;
  return status.details.find((d) => d.plan === plan && d.cycle === cycle) ?? null;
}

function parseGooglePlayItemDetails(item: DigitalGoodsItemDetails): GooglePlayPricingDetails {
  const mapping = findPlanCycleBySku(item.itemId);

  return {
    sku: item.itemId,
    plan: mapping?.plan ?? "basic",
    cycle: mapping?.cycle ?? "monthly",
    price: item.price,
    title: item.title,
    description: item.description,
    subscriptionPeriod: item.subscriptionPeriod,
    introductoryPrice: item.introductoryPrice ?? null,
    introductoryPricePeriod: item.introductoryPricePeriod ?? null,
    introductoryPriceCycles: item.introductoryPriceCycles ?? null,
    hasIntroductoryOffer:
      item.introductoryPrice != null &&
      item.introductoryPriceCycles != null &&
      item.introductoryPriceCycles > 0,
  };
}

function findPlanCycleBySku(
  sku: string,
): { plan: Exclude<SubscriptionPlan, "free">; cycle: BillingCycle } | null {
  for (const [plan, cycles] of Object.entries(GOOGLE_PLAY_SKUS)) {
    for (const [cycle, itemSku] of Object.entries(cycles)) {
      if (itemSku === sku) {
        return {
          plan: plan as Exclude<SubscriptionPlan, "free">,
          cycle: cycle as BillingCycle,
        };
      }
    }
  }
  return null;
}
