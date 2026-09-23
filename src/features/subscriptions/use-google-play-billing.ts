"use client";

import { useCallback, useState } from "react";
import {
  syncGooglePlayPurchasesAction,
  verifyGooglePlayPurchaseAction,
} from "@/features/subscriptions/subscription-actions";
import { isGooglePlayPurchaseCancellation } from "@/features/subscriptions/google-play-errors";
import { useSubscription } from "@/features/subscriptions/subscription-client";

export function useGooglePlayBilling() {
  const { refreshEntitlements } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nativeBilling =
    typeof window !== "undefined" ? window.FoxiesDeckNativeBilling ?? null : null;
  const isSupported =
    nativeBilling !== null ||
    (typeof window !== "undefined" && typeof window.getDigitalGoodsService === "function");

  const clearError = useCallback(() => setError(null), []);

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
    async (sku: string | string[]) => {
      if (nativeBilling) {
        const skus = Array.isArray(sku) ? sku : [sku];
        const details = parseNativeBillingResponse<DigitalGoodsItemDetails[]>(
          nativeBilling.getDetails(JSON.stringify(skus)),
        );
        return Array.isArray(sku) ? details : (details[0] ?? null);
      }

      const service = await getService();
      const skus = Array.isArray(sku) ? sku : [sku];
      const details = await service.getDetails(skus);
      return Array.isArray(sku) ? details : (details[0] ?? null);
    },
    [getService, nativeBilling],
  );

  const purchase = useCallback(
    async (sku: string) => {
      setIsLoading(true);
      setError(null);

      try {
        if (nativeBilling) {
          const purchase = parseNativeBillingResponse<NativePurchaseResult>(
            nativeBilling.purchase(sku),
          );
          if (purchase.status !== "success" || !purchase.purchaseToken) {
            throw new Error(purchase.message || "Google Play purchase failed.");
          }

          const result = await verifyGooglePlayPurchaseAction(
            purchase.purchaseToken,
            purchase.itemId || sku,
          );
          if (result.status !== "success" || !result.data) {
            throw new Error(result.message || "Purchase verification failed.");
          }

          await refreshEntitlements();
          return result.data;
        }

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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(message);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [getService, nativeBilling, refreshEntitlements],
  );

  const restorePurchases = useCallback(async () => {
    if (!isSupported) return;

    setIsLoading(true);
    setError(null);

    try {
      if (nativeBilling) {
        const purchases = parseNativeBillingResponse<DigitalGoodsPurchaseDetails[]>(
          nativeBilling.listPurchases(),
        );

        if (purchases.length === 0) return;

        const result = await syncGooglePlayPurchasesAction(
          purchases.map((purchase) => ({
            purchaseToken: purchase.purchaseToken,
            productId: purchase.itemId,
          })),
        );

        if (result.status === "error") {
          throw new Error(result.message || "Purchase restoration failed.");
        }

        if (result.data) {
          await refreshEntitlements();
        }
        return;
      }

      const service = await getService();
      const purchases = await service.listPurchases();

      if (purchases.length === 0) return;

      const details = purchases.map((p) => ({
        purchaseToken: p.purchaseToken,
        productId: p.itemId,
      }));

      const result = await syncGooglePlayPurchasesAction(details);

      if (result.status === "error") {
        throw new Error(result.message || "Purchase restoration failed.");
      }

      if (result.data) {
        await refreshEntitlements();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(isGooglePlayPurchaseCancellation(error) ? null : message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [getService, isSupported, nativeBilling, refreshEntitlements]);

  return {
    isSupported,
    isLoading,
    error,
    clearError,
    getProductDetails,
    purchase,
    restorePurchases,
  };
}

interface NativePurchaseResult {
  status: "success" | "error";
  itemId?: string;
  purchaseToken?: string;
  message?: string;
}

function parseNativeBillingResponse<T>(raw: string): T {
  try {
    const parsed = JSON.parse(raw) as { status?: string; message?: string };
    if (parsed && parsed.status === "error") {
      throw new Error(parsed.message || "Native Google Play Billing request failed.");
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Native Google Play Billing returned an invalid response.");
  }
}
