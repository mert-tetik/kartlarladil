"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clearGoogleAuthPending, markGoogleAuthPending } from "@/features/auth/google-auth-flow";
import { getSafeNextPath } from "@/features/auth/auth-redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/locale-provider";

export const NATIVE_GOOGLE_AUTH_CALLBACK_EVENT = "foxiesdeck:native-google-auth-callback";
export const NATIVE_GOOGLE_AUTH_CALLBACK_QUEUE_KEY = "__foxiesdeckNativeGoogleAuthQueue";

export interface NativeGoogleAuthCallbackPayload {
  code?: string;
  next?: string;
  error?: string;
  errorDescription?: string;
}

declare global {
  interface Window {
    __foxiesdeckNativeGoogleAuthQueue?: NativeGoogleAuthCallbackPayload[];
    FoxiesDeckNativeGoogleAuthCallback?: () => void;
  }
}

function getInitialCallbackPayload(): NativeGoogleAuthCallbackPayload | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("nativeAuthCode") ?? undefined;
  const error = params.get("nativeAuthError") ?? undefined;
  const next = params.get("nativeAuthNext") ?? undefined;
  const errorDescription = params.get("nativeAuthErrorDescription") ?? undefined;

  if (!code && !error) return null;
  return { code, next, error, errorDescription };
}

function clearNativeCallbackQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete("nativeAuthCode");
  url.searchParams.delete("nativeAuthNext");
  url.searchParams.delete("nativeAuthError");
  url.searchParams.delete("nativeAuthErrorDescription");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function getCallbackKey(payload: NativeGoogleAuthCallbackPayload) {
  return [payload.code, payload.next, payload.error, payload.errorDescription].join("|");
}

export function NativeGoogleAuthCallback() {
  const router = useRouter();
  const t = useT();
  const handledPayloadRef = useRef<string | null>(null);

  const processPayload = useCallback(async (payload: NativeGoogleAuthCallbackPayload) => {
    const code = payload.code?.trim();
    const callbackKey = getCallbackKey(payload);
    if ((!code && !payload.error) || handledPayloadRef.current === callbackKey) return;
    handledPayloadRef.current = callbackKey;

    markGoogleAuthPending();

    if (payload.error || !code) {
      clearGoogleAuthPending();
      clearNativeCallbackQuery();
      router.replace(`/?mobile-gateway-login=1&message=${encodeURIComponent(t("auth.message.googleFailed"))}`);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw error;
      }

      const nextPath = getSafeNextPath(payload.next, "/");
      clearNativeCallbackQuery();
      // Always notify the App Router after removing the native callback query.
      // A direct history.replaceState does not reliably update useSearchParams,
      // so skipping this when the path appears unchanged can leave the mobile
      // gateway stuck on its loading screen.
      router.replace(nextPath);
      // AuthSessionProvider clears the pending marker after it has loaded the
      // profile. Keeping it until then prevents the login screen from flashing.
    } catch {
      clearGoogleAuthPending();
      clearNativeCallbackQuery();
      router.replace(`/?mobile-gateway-login=1&message=${encodeURIComponent(t("auth.message.googleFailed"))}`);
    }
  }, [router, t]);

  useEffect(() => {
    const drainQueue = () => {
      const queued = window.__foxiesdeckNativeGoogleAuthQueue ?? [];
      window.__foxiesdeckNativeGoogleAuthQueue = [];
      queued.forEach((payload) => {
        void processPayload(payload);
      });
    };

    window.FoxiesDeckNativeGoogleAuthCallback = drainQueue;
    window.addEventListener(NATIVE_GOOGLE_AUTH_CALLBACK_EVENT, drainQueue);
    drainQueue();

    const initialPayload = getInitialCallbackPayload();
    if (initialPayload) {
      void processPayload(initialPayload);
    }

    return () => {
      window.removeEventListener(NATIVE_GOOGLE_AUTH_CALLBACK_EVENT, drainQueue);
      if (window.FoxiesDeckNativeGoogleAuthCallback === drainQueue) {
        delete window.FoxiesDeckNativeGoogleAuthCallback;
      }
    };
  }, [processPayload]);

  return null;
}
