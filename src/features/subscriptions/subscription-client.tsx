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
import { getUserEntitlementsAction } from "@/features/subscriptions/subscription-actions";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import type { UserEntitlements } from "@/types/domain";

interface SubscriptionContextValue {
  entitlements: UserEntitlements | null;
  isLoading: boolean;
  error: string | null;
  refreshEntitlements: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEntitlements = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getUserEntitlementsAction();

    if (result.status === "success" && result.data) {
      setEntitlements(result.data);
    } else {
      setEntitlements(null);
      setError(result.message);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    startTransition(() => {
      void refreshEntitlements();
    });
  }, [refreshEntitlements]);

  return (
    <SubscriptionContext.Provider
      value={{ entitlements, isLoading, error, refreshEntitlements }}
    >
      {children}
      <GooglePlayBillingSync />
    </SubscriptionContext.Provider>
  );
}

function GooglePlayBillingSync() {
  const isTwa = useTwaMode();
  const { isSupported, restorePurchases } = useGooglePlayBilling();

  useEffect(() => {
    if (isTwa && isSupported) {
      void restorePurchases();
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
