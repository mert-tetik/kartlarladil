"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { SubscriptionPurchaseSuccessDialog } from "@/features/subscriptions/components/subscription-purchase-success-dialog";
import { getUserEntitlementsAction } from "@/features/subscriptions/subscription-actions";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { useAuthSession } from "@/features/auth/auth-client";
import type { UserEntitlements } from "@/types/domain";
import { useAppMessage } from "@/components/app-message-provider";
import { isMissionVisualTestRoute } from "@/lib/visual-test-mode";

const ENTITLEMENTS_CACHE_KEY = "foxiesdeck:entitlements";

interface SubscriptionContextValue {
  entitlements: UserEntitlements | null;
  isLoading: boolean;
  error: string | null;
  refreshEntitlements: () => Promise<UserEntitlements | null>;
  presentPurchaseSuccess: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

function getEntitlementsCacheKey(userId: string) {
  return `${ENTITLEMENTS_CACHE_KEY}:${userId}`;
}

function readCachedEntitlements(userId: string | null): UserEntitlements | null {
  if (!userId) return null;

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getEntitlementsCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as UserEntitlements;
  } catch {
    return null;
  }
}

function writeCachedEntitlements(userId: string, entitlements: UserEntitlements | null) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    const cacheKey = getEntitlementsCacheKey(userId);
    if (entitlements) {
      window.localStorage.setItem(cacheKey, JSON.stringify(entitlements));
    } else {
      window.localStorage.removeItem(cacheKey);
    }
  } catch {
    // Ignore storage errors.
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthSession();

  return (
    <SubscriptionProviderSession key={user?.id ?? "guest"} userId={user?.id ?? null}>
      {children}
    </SubscriptionProviderSession>
  );
}

function SubscriptionProviderSession({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isVisualTestMode = isMissionVisualTestRoute(pathname);
  const [entitlements, setEntitlements] = useState<UserEntitlements | null>(() =>
    readCachedEntitlements(userId),
  );
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(userId && !readCachedEntitlements(userId)),
  );
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccessOpen, setPurchaseSuccessOpen] = useState(false);
  const entitlementsRef = useRef<UserEntitlements | null>(entitlements);
  const userIdRef = useRef<string | null>(userId);
  const refreshPromiseRef = useRef<Promise<UserEntitlements | null> | null>(null);
  const { showMessage } = useAppMessage();

  useEffect(() => {
    if (error) {
      showMessage(error, "error");
    }
  }, [error, showMessage]);

  const refreshEntitlements = useCallback(async () => {
    if (isVisualTestMode) {
      setIsLoading(false);
      setError(null);
      return null;
    }

    const requestUserId = userId;
    if (!requestUserId) {
      entitlementsRef.current = null;
      setEntitlements(null);
      setIsLoading(false);
      setError(null);
      return null;
    }

    const pendingRefresh = refreshPromiseRef.current;
    if (pendingRefresh) {
      return pendingRefresh;
    }

    const hadKnownEntitlements = entitlementsRef.current !== null;
    // Cached entitlements are already authoritative enough for immediate UI
    // actions. A background refresh must not turn a usable paid UI back into a
    // loading/locked state while the server confirms the same information.
    if (!hadKnownEntitlements) {
      setIsLoading(true);
    }
    setError(null);

    const refreshRequest = (async () => {
      try {
        const result = await getUserEntitlementsAction();

        if (userIdRef.current !== requestUserId) {
          return null;
        }

        if (result.status === "success" && result.data) {
          entitlementsRef.current = result.data;
          setEntitlements(result.data);
          writeCachedEntitlements(requestUserId, result.data);
          setIsLoading(false);
          return result.data;
        }

        // Keep the last known entitlement snapshot during transient failures.
        // Only a user with no cached snapshot should remain unresolved/locked.
        if (!hadKnownEntitlements) {
          entitlementsRef.current = null;
          setEntitlements(null);
          writeCachedEntitlements(requestUserId, null);
        }
        setError(hadKnownEntitlements ? null : result.message);
        setIsLoading(false);
        return entitlementsRef.current;
      } catch {
        if (!hadKnownEntitlements) {
          entitlementsRef.current = null;
          setEntitlements(null);
          writeCachedEntitlements(requestUserId, null);
        }
        // A cached snapshot keeps the UI usable during a transient network
        // failure. There is no localized action error to show for a transport
        // failure, so leave the user-facing message silent and retry on the
        // next provider mount/explicit refresh.
        setError(null);
        setIsLoading(false);
        return entitlementsRef.current;
      }
    })();

    refreshPromiseRef.current = refreshRequest;
    void refreshRequest.finally(() => {
      if (refreshPromiseRef.current === refreshRequest) {
        refreshPromiseRef.current = null;
      }
    });

    return refreshRequest;
  }, [isVisualTestMode, userId]);

  useEffect(() => {
    if (isVisualTestMode || !userId) {
      return;
    }

    startTransition(() => {
      void refreshEntitlements();
    });
  }, [isVisualTestMode, refreshEntitlements, userId]);

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
      <GooglePlayBillingSync disabled={isVisualTestMode} />
      <SubscriptionPurchaseSuccessDialog
        open={purchaseSuccessOpen}
        onContinue={handlePurchaseSuccessContinue}
      />
    </SubscriptionContext.Provider>
  );
}

function GooglePlayBillingSync({ disabled }: { disabled: boolean }) {
  const isTwa = useTwaMode();
  const { isSupported, restorePurchases } = useGooglePlayBilling();

  useEffect(() => {
    if (!disabled && isTwa && isSupported) {
      void restorePurchases().catch((error: unknown) => {
        console.error("Google Play purchase restoration failed on mount:", error);
      });
    }
  }, [disabled, isTwa, isSupported, restorePurchases]);

  return null;
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error("useSubscription must be used inside SubscriptionProvider.");
  }

  return context;
}
