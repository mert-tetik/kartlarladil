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

const WEB_PLAN_CYCLES = [
  { plan: "basic" as const, cycle: "monthly" as const, usd: 3 },
  { plan: "basic" as const, cycle: "yearly" as const, usd: 30 },
  { plan: "pro" as const, cycle: "monthly" as const, usd: 9 },
  { plan: "pro" as const, cycle: "yearly" as const, usd: 90 },
];

const TWA_PLAN_CYCLES = [
  { plan: "basic" as const, cycle: "monthly" as const, usd: 2 },
  { plan: "basic" as const, cycle: "yearly" as const, usd: 20 },
  { plan: "pro" as const, cycle: "monthly" as const, usd: 6 },
  { plan: "pro" as const, cycle: "yearly" as const, usd: 60 },
];

export function useLocalizedPricing(
  serverCurrencyCode: string | null,
  isTwa = false,
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

      const planCycles = isTwa ? TWA_PLAN_CYCLES : WEB_PLAN_CYCLES;

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
  }, [serverCurrencyCode, isTwa]);

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
      original: `USD $${usdAmount}`,
    };
  }

  return {
    primary: `$${usdAmount}`,
    original: "",
  };
}
