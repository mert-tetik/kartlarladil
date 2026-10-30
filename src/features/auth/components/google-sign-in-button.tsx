"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { AuthConsentText } from "@/features/auth/components/auth-consent-text";
import { FormMessage } from "@/features/auth/components/form-message";
import { clearGoogleAuthPending, markGoogleAuthPending } from "@/features/auth/google-auth-flow";
import { getGoogleOAuthRedirectTo } from "@/features/auth/google-oauth-redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { useT } from "@/i18n/locale-provider";

interface GoogleSignInButtonProps {
  nextPath: string;
  label: string;
  showConsent?: boolean;
}

const MOBILE_LOGIN_TUTORIAL_RESET_KEY = "foxiesdeck:mobile-login-tutorial-reset-requested";

function isNativeTwaRuntime() {
  if (typeof window === "undefined") return false;

  if (window.FoxiesDeckNativeBilling) return true;

  // LauncherActivity appends this marker before the WebView starts. Keep it as
  // a fallback because the JavaScript bridge can become visible one frame
  // after the first interactive render.
  return new URLSearchParams(window.location.search).get("native") === "1";
}

export function setNativeTwaFormField(form: HTMLFormElement, nativeBridge: unknown) {
  const nativeTwaField = form.elements.namedItem("nativeTwa");
  if (nativeTwaField instanceof HTMLInputElement) {
    nativeTwaField.value = nativeBridge ? "1" : "0";
  }
}

export function GoogleSignInButton({ nextPath, label, showConsent = true }: GoogleSignInButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const t = useT();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setErrorMessage("");
    const nativeTwa = isNativeTwaRuntime();
    setNativeTwaFormField(event.currentTarget, nativeTwa);

    if (!hasSupabaseBrowserConfig()) {
      setIsPending(false);
      setErrorMessage(t("auth.message.notConfigured"));
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getGoogleOAuthRedirectTo(window.location.origin, nextPath, nativeTwa),
          queryParams: {
            prompt: "select_account",
          },
          // Fetch the provider URL in the browser, then navigate explicitly.
          // This avoids waiting on a Next.js server action before Google opens.
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        clearGoogleAuthPending();
        setIsPending(false);
        setErrorMessage(error ? t("auth.message.googleFailed") : t("auth.message.googleNoUrl"));
        return;
      }

      // Keep this marker for the callback/bootstrap handoff, but only after
      // the provider URL is ready so it cannot cover the initial OAuth wait.
      if (window.innerWidth < 1024) {
        markGoogleAuthPending();

        if (nextPath.includes("showOffer=1")) {
          window.sessionStorage.setItem(MOBILE_LOGIN_TUTORIAL_RESET_KEY, "1");
        }
      }
      window.location.assign(data.url);
    } catch {
      clearGoogleAuthPending();
      setIsPending(false);
      setErrorMessage(t("auth.message.googleFailed"));
    }
  };

  return (
    <form
      className="w-full"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="nativeTwa" defaultValue="0" />
      <FormMessage
        state={errorMessage ? { status: "error", message: errorMessage } : AUTH_ACTION_IDLE_STATE}
      />
      <Button
        type="submit"
        className="flex w-full items-center justify-center gap-2 bg-foreground text-background hover:opacity-90"
        disabled={isPending}
      >
        <GoogleLogo />
        {isPending ? t("auth.google.pending") : label}
      </Button>
      {showConsent ? <AuthConsentText /> : null}
    </form>
  );
}

function GoogleLogo() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
