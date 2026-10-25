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
import {
  type SubscriptionDetailsSelection,
} from "@/features/subscriptions/components/global-subscription-details-overlay";
import dynamic from "next/dynamic";
import { getUserEntitlementsAction } from "@/features/subscriptions/subscription-actions";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useGooglePlayPricing } from "@/features/subscriptions/use-google-play-pricing";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import { useAuthSession } from "@/features/auth/auth-client";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { isUsableEntitlementsSnapshot } from "@/features/subscriptions/subscription-entitlement";
import type { AuthShellUser } from "@/features/auth/auth-types";
import type { SubscriptionPlan, UserEntitlements } from "@/types/domain";
import { useAppMessage } from "@/components/app-message-provider";
import { isMissionVisualTestRoute } from "@/lib/visual-test-mode";

const ENTITLEMENTS_CACHE_KEY = "foxiesdeck:entitlements";

const GlobalSubscriptionDetailsOverlay = dynamic(
  () => import("@/features/subscriptions/components/global-subscription-details-overlay")
    .then((module) => module.GlobalSubscriptionDetailsOverlay),
  { ssr: false, loading: () => null },
);

interface SubscriptionContextValue {
  entitlements: UserEntitlements | null;
  isLoading: boolean;
  error: string | null;
  refreshEntitlements: () => Promise<UserEntitlements | null>;
  applyVerifiedEntitlements: (next: UserEntitlements) => void;
  presentPurchaseSuccess: () => void;
  openSubscriptionDetails: (
    selection: SubscriptionDetailsSelection,
    options?: {
      currencyCode?: string | null;
      currentPlan?: SubscriptionPlan | null;
      onPurchaseSuccess?: () => void | Promise<void>;
    },
  ) => void;
}

interface SubscriptionDetailsRequest {
  selection: SubscriptionDetailsSelection;
  currencyCode: string | null;
  currentPlan?: SubscriptionPlan | null;
  onPurchaseSuccess?: () => void | Promise<void>;
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
    const cached: unknown = JSON.parse(raw);
    return isUsableEntitlementsSnapshot(cached) ? cached : null;
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
    <SubscriptionProviderSession key={user?.id ?? "guest"} userId={user?.id ?? null} user={user}>
      {children}
    </SubscriptionProviderSession>
  );
}

function SubscriptionProviderSession({
  children,
  userId,
  user,
}: {
  children: ReactNode;
  userId: string | null;
  user: AuthShellUser | null;
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
  const [subscriptionDetailsRequest, setSubscriptionDetailsRequest] = useState<SubscriptionDetailsRequest | null>(null);
  const entitlementsRef = useRef<UserEntitlements | null>(entitlements);
  const userIdRef = useRef<string | null>(userId);
  const entitlementRevisionRef = useRef(0);
  const refreshPromiseRef = useRef<{
    revision: number;
    promise: Promise<UserEntitlements | null>;
  } | null>(null);
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

    // A server read started before a verified purchase or expiry transition
    // must not be allowed to overwrite that newer state. If such a read is
    // still pending, wait for it to settle and then issue a fresh read.
    let pendingRefresh = refreshPromiseRef.current;
    while (pendingRefresh) {
      const currentRevision = entitlementRevisionRef.current;
      if (pendingRefresh.revision === currentRevision) {
        return pendingRefresh.promise;
      }

      await pendingRefresh.promise;
      if (userIdRef.current !== requestUserId) {
        return null;
      }
      pendingRefresh = refreshPromiseRef.current;
    }

    const requestRevision = entitlementRevisionRef.current;
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

        if (entitlementRevisionRef.current !== requestRevision) {
          return entitlementsRef.current;
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
        if (
          userIdRef.current !== requestUserId
          || entitlementRevisionRef.current !== requestRevision
        ) {
          return entitlementsRef.current;
        }

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

    refreshPromiseRef.current = { revision: requestRevision, promise: refreshRequest };
    const clearRefresh = () => {
      if (refreshPromiseRef.current?.promise === refreshRequest) {
        refreshPromiseRef.current = null;
      }
    };
    void refreshRequest.then(clearRefresh, clearRefresh);

    return refreshRequest;
  }, [isVisualTestMode, userId]);

  const applyVerifiedEntitlements = useCallback((next: UserEntitlements) => {
    if (!userId) return;
    entitlementRevisionRef.current += 1;
    entitlementsRef.current = next;
    setEntitlements(next);
    setIsLoading(false);
    setError(null);
    writeCachedEntitlements(userId, next);
  }, [userId]);

  useEffect(() => {
    if (isVisualTestMode || !userId) {
      return;
    }

    startTransition(() => {
      void refreshEntitlements();
    });
  }, [isVisualTestMode, refreshEntitlements, userId]);

  useEffect(() => {
    if (!userId || !entitlements || entitlements.effectivePlan === "free") return;

    const expiresAt = new Date(entitlements.endsAt ?? "").getTime();
    let timeoutId: number | undefined;

    const expireEntitlementAtDeadline = () => {
      const remainingMs = expiresAt - Date.now();
      if (remainingMs > 0) {
        timeoutId = window.setTimeout(
          expireEntitlementAtDeadline,
          Math.min(remainingMs, 2_147_000_000),
        );
        return;
      }

      const latestEntitlements = entitlementsRef.current;
      if (!latestEntitlements || latestEntitlements.effectivePlan === "free") return;

      const expiredEntitlements: UserEntitlements = {
        ...latestEntitlements,
        effectivePlan: "free",
        limits: PLAN_LIMITS.free,
      };
      entitlementRevisionRef.current += 1;
      entitlementsRef.current = expiredEntitlements;
      setEntitlements(expiredEntitlements);
      writeCachedEntitlements(userId, expiredEntitlements);
      void refreshEntitlements();
    };

    timeoutId = window.setTimeout(
      expireEntitlementAtDeadline,
      Math.max(0, Math.min(expiresAt - Date.now(), 2_147_000_000)),
    );

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [entitlements, refreshEntitlements, userId]);

  const presentPurchaseSuccess = useCallback(() => {
    setPurchaseSuccessOpen(true);
  }, []);

  const openSubscriptionDetails = useCallback<SubscriptionContextValue["openSubscriptionDetails"]>(
    (selection, options) => {
      setSubscriptionDetailsRequest({
        selection,
        currencyCode: options?.currencyCode ?? null,
        currentPlan: options?.currentPlan,
        onPurchaseSuccess: options?.onPurchaseSuccess,
      });
    },
    [],
  );

  const closeSubscriptionDetails = useCallback(() => {
    setSubscriptionDetailsRequest(null);
  }, []);

  const handlePurchaseSuccessContinue = useCallback(() => {
    setPurchaseSuccessOpen(false);
    if (pathname !== "/") {
      router.replace("/");
    }
  }, [pathname, router]);

  return (
    <SubscriptionContext.Provider
      value={{ entitlements, isLoading, error, refreshEntitlements, applyVerifiedEntitlements, presentPurchaseSuccess, openSubscriptionDetails }}
    >
      {children}
      {subscriptionDetailsRequest ? (
        <SubscriptionDetailsHost
          request={subscriptionDetailsRequest}
          user={user}
          currentPlan={subscriptionDetailsRequest.currentPlan !== undefined
            ? subscriptionDetailsRequest.currentPlan
            : entitlements?.effectivePlan ?? null}
          onClose={closeSubscriptionDetails}
          onPresentPurchaseSuccess={presentPurchaseSuccess}
        />
      ) : null}
      <GooglePlayBillingSync disabled={isVisualTestMode} />
      <SubscriptionPurchaseSuccessDialog
        open={purchaseSuccessOpen}
        onContinue={handlePurchaseSuccessContinue}
      />
    </SubscriptionContext.Provider>
  );
}

function SubscriptionDetailsHost({
  request,
  user,
  currentPlan,
  onClose,
  onPresentPurchaseSuccess,
}: {
  request: SubscriptionDetailsRequest;
  user: AuthShellUser | null;
  currentPlan: SubscriptionPlan | null;
  onClose: () => void;
  onPresentPurchaseSuccess: () => void;
}) {
  const isTwa = useTwaMode();
  const googlePlayPricing = useGooglePlayPricing();
  const { purchase, isLoading, isSupported } = useGooglePlayBilling();

  return (
    <GlobalSubscriptionDetailsOverlay
      selection={request.selection}
      user={user}
      currentPlan={currentPlan}
      isTwa={isTwa}
      currencyCode={request.currencyCode}
      googlePlayPricing={googlePlayPricing}
      purchase={purchase}
      purchaseLoading={isLoading}
      purchaseSupported={isSupported}
      onClose={onClose}
      onPurchaseSuccess={request.onPurchaseSuccess}
      onPresentPurchaseSuccess={onPresentPurchaseSuccess}
    />
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
