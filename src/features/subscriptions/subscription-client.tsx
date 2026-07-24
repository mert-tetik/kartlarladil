"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { SubscriptionPurchaseSuccessDialog } from "@/features/subscriptions/components/subscription-purchase-success-dialog";
import { getUserEntitlementsAction } from "@/features/subscriptions/subscription-actions";
import {
  clearPendingWebSubscriptionCheckout,
  hasCheckoutSuccessParam,
  hasPendingWebSubscriptionCheckout,
  removeCheckoutSuccessParam,
} from "@/features/subscriptions/subscription-purchase-success";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import type { UserEntitlements } from "@/types/domain";

const ENTITLEMENTS_CACHE_KEY = "foxiesdeck:entitlements";
const WEB_CHECKOUT_VERIFY_ATTEMPTS = 5;
const WEB_CHECKOUT_VERIFY_DELAY_MS = 3000;

interface SubscriptionContextValue {
  entitlements: UserEntitlements | null;
  isLoading: boolean;
  error: string | null;
  refreshEntitlements: () => Promise<UserEntitlements | null>;
  presentPurchaseSuccess: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function readCachedEntitlements(): UserEntitlements | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ENTITLEMENTS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserEntitlements;
  } catch {
    return null;
  }
}

function writeCachedEntitlements(entitlements: UserEntitlements | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (entitlements) {
      window.localStorage.setItem(ENTITLEMENTS_CACHE_KEY, JSON.stringify(entitlements));
    } else {
      window.localStorage.removeItem(ENTITLEMENTS_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors.
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(readCachedEntitlements);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);

  const refreshEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getUserEntitlementsAction();

    if (result.status === "success" && result.data) {
      setEntitlements(result.data);
      writeCachedEntitlements(result.data);
      setIsLoading(false);
      return result.data;
    } else {
      setEntitlements(null);
      writeCachedEntitlements(null);
      setError(result.message);
      setIsLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refreshEntitlements();
    });
  }, [refreshEntitlements]);

  const presentPurchaseSuccess = useCallback(() => {
    setPurchaseSuccessOpen(true);
  }, []);

  const handlePurchaseSuccessContinue = useCallback(() => {
    setPurchaseSuccessOpen(false);
    if (pathname !== "/") {
      router.replace("/");
    }
  }, [pathname, router]);

  return (
    <SubscriptionContext.Provider
      value={{ entitlements, isLoading, error, refreshEntitlements, presentPurchaseSuccess }}
    >
      {children}
      <GooglePlayBillingSync />
      <WebCheckoutSuccessObserver onVerified={presentPurchaseSuccess} />
      <SubscriptionPurchaseSuccessDialog
        open={purchaseSuccessOpen}
        onContinue={handlePurchaseSuccessContinue}
      />
    </SubscriptionContext.Provider>
  );
}

function WebCheckoutSuccessObserver({ onVerified }: { onVerified: () => void }) {
  const { refreshEntitlements } = useSubscription();

  useEffect(() => {
    if (!hasCheckoutSuccessParam() || !hasPendingWebSubscriptionCheckout()) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const scheduleRetry = () => {
      attempts += 1;
      if (attempts >= WEB_CHECKOUT_VERIFY_ATTEMPTS) {
        finish();
        return;
      }

      timeoutId = setTimeout(() => {
        void verify();
      }, WEB_CHECKOUT_VERIFY_DELAY_MS);
    };

    const finish = () => {
      clearPendingWebSubscriptionCheckout();
      removeCheckoutSuccessParam();
    };

    const verify = async () => {
      let nextEntitlements: UserEntitlements | null = null;
      try {
        nextEntitlements = await refreshEntitlements();
      } catch {
        // A temporary connection error must not leave a stale checkout marker behind.
      }
      if (cancelled) return;

      if (nextEntitlements?.effectivePlan && nextEntitlements.effectivePlan !== "free") {
        finish();
        onVerified();
        return;
      }

      scheduleRetry();
    };

    void verify();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onVerified, refreshEntitlements]);

  return null;
}

function GooglePlayBillingSync() {
  const isTwa = useTwaMode();
  const { isSupported, restorePurchases } = useGooglePlayBilling();

  useEffect(() => {
    if (isTwa && isSupported) {
      void restorePurchases().catch((error: unknown) => {
        console.error("Google Play purchase restoration failed on mount:", error);
      });
    }
  }, [isTwa, isSupported, restorePurchases]);

  return null;
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error("useSubscription must be used inside SubscriptionProvider.");
  }

  return context;
}
