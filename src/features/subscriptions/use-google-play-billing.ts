"use client";

import { useCallback, useState } from "react";
import {
  syncGooglePlayPurchasesAction,
  verifyGooglePlayPurchaseAction,
} from "@/features/subscriptions/subscription-actions";
import { useSubscription } from "@/features/subscriptions/subscription-client";

export function useGooglePlayBilling() {
  const { refreshEntitlements } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);

  const isSupported =
    typeof window !== "undefined" && typeof window.getDigitalGoodsService === "function";

  const getService = useCallback(async (): Promise<DigitalGoodsService> => {
    if (!isSupported) {
      throw new Error("Google Play Billing is not available in this environment.");
    }

    const service = await window.getDigitalGoodsService!("https://play.google.com/billing");
    if (!service) {
      throw new Error("Failed to initialize Google Play Billing service.");
    }

    return service;
  }, [isSupported]);

  const getProductDetails = useCallback(
    async (sku: string) => {
      const service = await getService();
      const details = await service.getDetails([sku]);
      return details[0] ?? null;
    },
    [getService],
  );

  const purchase = useCallback(
    async (sku: string) => {
      setIsLoading(true);

      try {
        const service = await getService();
        const details = await service.getDetails([sku]);
        const item = details[0];

        if (!item) {
          throw new Error(`Product ${sku} is not available on Google Play.`);
        }

        const request = new PaymentRequest(
          [
            {
              supportedMethods: "https://play.google.com/billing",
              data: { sku },
            },
          ],
          {
            total: {
              label: "Total",
              amount: {
                currency: item.price.currency,
                value: item.price.value,
              },
            },
          },
        );

        const response = await request.show();
        const { purchaseToken } = response.details as { purchaseToken?: string };

        if (!purchaseToken) {
          await response.complete("fail");
          throw new Error("Purchase token is missing from Google Play response.");
        }

        const result = await verifyGooglePlayPurchaseAction(purchaseToken, sku);

        if (result.status !== "success" || !result.data) {
          await response.complete("fail");
          throw new Error(result.message || "Purchase verification failed.");
        }

        await response.complete("success");
        await refreshEntitlements();

        return result.data;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, refreshEntitlements],
  );

  const restorePurchases = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);

    try {
      const service = await getService();
      const purchases = await service.listPurchases();

      if (purchases.length === 0) return;

      const details = purchases.map((p) => ({
        purchaseToken: p.purchaseToken,
        productId: p.itemId,
      }));

      const result = await syncGooglePlayPurchasesAction(details);

      if (result.status === "success" && result.data) {
        await refreshEntitlements();
      }
    } finally {
      setIsLoading(false);
    }
  }, [getService, isSupported, refreshEntitlements]);

  return {
    isSupported,
    isLoading,
    getProductDetails,
    purchase,
    restorePurchases,
  };
}
