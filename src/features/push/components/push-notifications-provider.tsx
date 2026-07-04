"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/features/auth/auth-client";
import { useTwaMode } from "@/features/install-app/use-twa-mode";
import {
  POST_PRACTICE_TUTORIAL_COMPLETED_EVENT,
  PUSH_ACTIVITY_DEBOUNCE_MS,
  clearPushPromptDismissed,
  ensureBrowserPushSubscription,
  getCurrentBrowserPushSubscription,
  getCurrentPushPermission,
  isPushSupported,
  markPushPromptDismissed,
  readLastPushActivityPing,
  readPushPromptDismissedUntil,
  serializePushSubscription,
  unsubscribeBrowserPushSubscription,
  writeLastPushActivityPing,
} from "@/features/push/push-client";
import { PUSH_APP_SURFACE, type PushActionResult, type PushPermissionState } from "@/features/push/push-types";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface PushNotificationsContextValue {
  supported: boolean;
  isTwa: boolean;
  enabled: boolean;
  permission: PushPermissionState;
  busy: boolean;
  enableNotifications: () => Promise<PushActionResult>;
  disableNotifications: () => Promise<PushActionResult>;
}

const PushNotificationsContext = createContext<PushNotificationsContextValue | null>(null);

export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const { user } = useAuthSession();
  const isTwa = useTwaMode();
  const supported = isPushSupported();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const [enabled, setEnabled] = useState(Boolean(user?.profile.pushMarketingEnabled));
  const [permission, setPermission] = useState<PushPermissionState>(() => getCurrentPushPermission());
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptError, setPromptError] = useState("");
  const syncAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    setEnabled(Boolean(user?.profile.pushMarketingEnabled));
  }, [user?.id, user?.profile.pushMarketingEnabled]);

  useEffect(() => {
    setPermission(getCurrentPushPermission());
  }, [supported, isTwa]);

  const postJson = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (response.ok) {
      return { ok: true as const, payload: await response.json().catch(() => ({})) };
    }

    const payload = (await response.json().catch(() => ({}))) as { errorCode?: string; message?: string };
    return { ok: false as const, payload };
  }, []);

  const pingActivity = useCallback(
    async (force = false) => {
      if (!user || !isTwa || !supported) {
        return;
      }

      const now = Date.now();
      const lastPing = readLastPushActivityPing(user.id);

      if (!force && now - lastPing < PUSH_ACTIVITY_DEBOUNCE_MS) {
        return;
      }

      writeLastPushActivityPing(user.id, now);

      await fetch("/api/push/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_surface: PUSH_APP_SURFACE }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [isTwa, supported, user],
  );

  const enableNotifications = useCallback(async (): Promise<PushActionResult> => {
    if (!user) {
      return { ok: false, message: t("push.settings.errorAuthRequired") };
    }

    if (!supported) {
      return { ok: false, message: t("push.settings.errorUnsupported") };
    }

    if (!isTwa) {
      return { ok: false, message: t("push.settings.errorTwaOnly") };
    }

    if (!publicKey) {
      return { ok: false, message: t("push.settings.errorNotConfigured") };
    }

    setBusy(true);
    setPromptError("");

    try {
      let nextPermission = getCurrentPushPermission();

      if (nextPermission === "default") {
        nextPermission = await Notification.requestPermission();
      }

      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        setEnabled(false);
        await postJson("/api/push/subscriptions", {
          method: "DELETE",
          body: JSON.stringify({}),
        });
        return { ok: false, message: t("push.settings.errorPermissionDenied") };
      }

      const subscription = await ensureBrowserPushSubscription(publicKey);
      const payload = serializePushSubscription(subscription);
      const result = await postJson("/api/push/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          subscription: payload,
          permission_state: "granted",
          app_surface: PUSH_APP_SURFACE,
        }),
      });

      if (!result.ok) {
        return { ok: false, message: result.payload.message || t("push.settings.errorUnknown") };
      }

      clearPushPromptDismissed();
      setEnabled(true);
      setPromptOpen(false);
      await pingActivity(true);

      return { ok: true, message: t("push.settings.enabledMessage") };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : t("push.settings.errorUnknown"),
      };
    } finally {
      setBusy(false);
    }
  }, [isTwa, pingActivity, postJson, publicKey, supported, t, user]);

  const disableNotifications = useCallback(async (): Promise<PushActionResult> => {
    if (!user) {
      return { ok: false, message: t("push.settings.errorAuthRequired") };
    }

    setBusy(true);

    try {
      const { endpoint } = await unsubscribeBrowserPushSubscription();
      const result = await postJson("/api/push/subscriptions", {
        method: "DELETE",
        body: JSON.stringify(endpoint ? { endpoint } : {}),
      });

      if (!result.ok) {
        return { ok: false, message: result.payload.message || t("push.settings.errorUnknown") };
      }

      setEnabled(false);
      setPromptOpen(false);

      return { ok: true, message: t("push.settings.disabledMessage") };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : t("push.settings.errorUnknown"),
      };
    } finally {
      setBusy(false);
    }
  }, [postJson, t, user]);

  useEffect(() => {
    if (!user || !isTwa || !supported) {
      setPromptOpen(false);
      return;
    }

    function handlePushPromptRequested() {
      const dismissedUntil = readPushPromptDismissedUntil();
      const currentPermission = getCurrentPushPermission();

      if (
        enabled ||
        busy ||
        currentPermission === "denied" ||
        dismissedUntil > Date.now()
      ) {
        return;
      }

      setPermission(currentPermission);
      setPromptError("");
      setPromptOpen(true);
    }

    window.addEventListener(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT, handlePushPromptRequested);

    return () => {
      window.removeEventListener(POST_PRACTICE_TUTORIAL_COMPLETED_EVENT, handlePushPromptRequested);
    };
  }, [busy, enabled, isTwa, supported, user]);

  useEffect(() => {
    if (!user || !isTwa || !supported) {
      syncAttemptedRef.current = null;
      return;
    }

    if (!enabled || permission !== "granted") {
      return;
    }

    if (syncAttemptedRef.current === user.id) {
      return;
    }

    syncAttemptedRef.current = user.id;

    void (async () => {
      const existingSubscription = await getCurrentBrowserPushSubscription();

      if (!existingSubscription) {
        await enableNotifications();
      }
    })();
  }, [enableNotifications, enabled, isTwa, permission, supported, user]);

  useEffect(() => {
    void pingActivity();
  }, [pathname, pingActivity]);

  useEffect(() => {
    if (!user || !isTwa || !supported) {
      return;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pingActivity();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTwa, pingActivity, supported, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const logId = searchParams.get("pushLog");
    const token = searchParams.get("pushToken");

    if (!logId || !token) {
      return;
    }

    void fetch("/api/push/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, token }),
      keepalive: true,
    }).catch(() => undefined);

    searchParams.delete("pushLog");
    searchParams.delete("pushToken");
    const nextSearch = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [pathname]);

  const value = useMemo<PushNotificationsContextValue>(
    () => ({
      supported,
      isTwa,
      enabled,
      permission,
      busy,
      enableNotifications,
      disableNotifications,
    }),
    [busy, disableNotifications, enableNotifications, enabled, isTwa, permission, supported],
  );

  return (
    <PushNotificationsContext.Provider value={value}>
      {children}
      {promptOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-prompt-title"
            className="w-full max-w-md rounded-lg border border-border bg-background-card p-6 shadow-2xl"
          >
            <h2 id="push-prompt-title" className="text-xl font-semibold text-foreground">
              {t("push.prompt.title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground-secondary">
              {t("push.prompt.body")}
            </p>
            {promptError ? (
              <p className="mt-3 text-sm font-medium text-rose-600">{promptError}</p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="md"
                disabled={busy}
                onClick={() => {
                  void enableNotifications().then((result) => {
                    if (!result.ok) {
                      setPromptError(result.message || t("push.settings.errorUnknown"));
                    }
                  });
                }}
              >
                {busy ? t("common.loading") : t("push.prompt.enable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => {
                  markPushPromptDismissed();
                  setPromptOpen(false);
                }}
              >
                {t("push.prompt.dismiss")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PushNotificationsContext.Provider>
  );
}

export function usePushNotifications() {
  const context = useContext(PushNotificationsContext);

  if (!context) {
    throw new Error("usePushNotifications must be used inside PushNotificationsProvider.");
  }

  return context;
}

export function NotificationToggle({
  enabled,
  disabled,
}: {
  enabled: boolean;
  disabled?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-12 items-center rounded-full border transition-colors",
        enabled ? "border-brand bg-brand" : "border-border bg-background-muted",
        disabled && "opacity-60",
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "mx-1 size-5 rounded-full bg-white transition-transform",
          enabled ? "translate-x-5" : "translate-x-0",
        )}
      />
    </span>
  );
}
