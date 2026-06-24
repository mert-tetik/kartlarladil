"use client";

import { useEffect, useState } from "react";
import {
  fetchExchangeRate,
  formatCurrency,
} from "@/lib/geo-currency";
import {
  getCountryCodeFromLocale,
  getCurrencyCodeForCountry,
} from "@/lib/country-currency";

export { formatCurrency };
import type { SubscriptionPlan } from "@/types/domain";

export type BillingCycle = "monthly" | "yearly";

export type LocalizedPrice = {
  amount: number;
  currencyCode: string;
};

export type LocalizedPricingStatus =
  | { kind: "loading" }
  | { kind: "ready"; currencyCode: string; prices: Partial<Record<`${SubscriptionPlan}:${BillingCycle}`, LocalizedPrice>> }
  | { kind: "unavailable" };

export function useLocalizedPricing(
  serverCurrencyCode: string | null,
): LocalizedPricingStatus {
  const [status, setStatus] = useState<LocalizedPricingStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const browserCurrencyCode = getCurrencyCodeForCountry(
        getCountryCodeFromLocale(navigator.language),
      );
      const currencyCode = serverCurrencyCode ?? browserCurrencyCode;

      if (!currencyCode || currencyCode === "USD") {
        setStatus({ kind: "unavailable" });
        return;
      }

      const planCycles: Array<{ plan: SubscriptionPlan; cycle: BillingCycle; usd: number }> = [
        { plan: "basic", cycle: "monthly", usd: 3 },
        { plan: "basic", cycle: "yearly", usd: 30 },
        { plan: "pro", cycle: "monthly", usd: 9 },
        { plan: "pro", cycle: "yearly", usd: 90 },
      ];

      const prices: Partial<Record<`${SubscriptionPlan}:${BillingCycle}`, LocalizedPrice>> = {};
      const rate = await fetchExchangeRate("USD", currencyCode);
      if (cancelled) return;

      if (rate === null) {
        setStatus({ kind: "unavailable" });
        return;
      }

      for (const item of planCycles) {
        prices[`${item.plan}:${item.cycle}`] = {
          amount: Math.round(item.usd * rate),
          currencyCode,
        };
      }

      setStatus({ kind: "ready", currencyCode, prices });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [serverCurrencyCode]);

  return status;
}

export function getLocalizedPrice(
  status: LocalizedPricingStatus,
  plan: SubscriptionPlan,
  cycle: BillingCycle,
): LocalizedPrice | null {
  if (status.kind !== "ready") return null;
  return status.prices[`${plan}:${cycle}`] ?? null;
}

export function formatLocalizedPrice(
  price: LocalizedPrice | null,
  usdAmount: number,
  locale: string,
): { primary: string; original: string } {
  if (price) {
    return {
      primary: formatCurrency(price.amount, price.currencyCode, locale),
      original: `≈ $${usdAmount}`,
    };
  }

  return {
    primary: `$${usdAmount}`,
    original: "",
  };
}
