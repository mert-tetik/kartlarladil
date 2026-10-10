"use client";

import { useState } from "react";
import Image from "next/image";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthConsentText } from "@/features/auth/components/auth-consent-text";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { MobileEmailAuthForm } from "@/features/auth/components/mobile-email-auth-form";
import { MobileResetPasswordForm } from "@/features/auth/components/mobile-reset-password-form";
import { useT } from "@/i18n/locale-provider";
import { APP_NAME } from "@/lib/constants";

type AuthMode = "google" | "email-login" | "email-register" | "email-reset";
type AuthType = "login" | "register";

export function MobileAuthScreen({
  mode: controlledMode,
  onModeChange,
}: {
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
}) {
  const t = useT();
  const [localMode, setLocalMode] = useState<AuthMode>("google");
  const mode = controlledMode ?? localMode;
  const authType: AuthType = mode === "email-register" ? "register" : "login";

  const changeMode = (nextMode: AuthMode) => {
    if (controlledMode === undefined) {
      setLocalMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  if (mode !== "google") {
    return (
      <div data-gateway-flow-screen className="mx-auto flex w-full max-w-sm flex-col">
        {mode === "email-reset" ? (
          <MobileResetPasswordForm
            onBack={() => changeMode("email-login")}
            onLogin={() => changeMode("email-login")}
          />
        ) : (
          <MobileEmailAuthForm
            authType={authType}
            onToggleAuthType={() => changeMode(authType === "login" ? "email-register" : "email-login")}
            onBack={() => changeMode("google")}
            onForgotPassword={() => changeMode("email-reset")}
          />
        )}
      </div>
    );
  }

  return (
    <div data-gateway-flow-screen className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
      <div data-gateway-flow-visual className="h-11 w-72 max-w-full overflow-hidden sm:w-80">
        <Image
          src="/splash.png"
          alt={APP_NAME}
          width={1024}
          height={1024}
          priority
          className="h-auto w-full -translate-y-[40%]"
        />
      </div>

      <p data-gateway-flow-item data-gateway-flow-order="0" className="mt-6 text-base leading-relaxed text-foreground-secondary">
        {t("auth.mobile.welcomeDescription")}
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <div data-gateway-flow-item data-gateway-flow-order="1" className="-translate-y-2.5">
          <GoogleSignInButton
            nextPath="/?mobileLanguageRefresh=1&showOffer=1"
            label={t("auth.google.signIn")}
            showConsent={false}
          />
        </div>

        <div
          data-gateway-flow-item
          data-gateway-flow-order="2"
          className="mobile-primary-action-depth mobile-primary-action-depth--emerald w-full rounded-xl"
        >
          <Button
            type="button"
            onClick={() => changeMode("email-login")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-0 bg-action-learn text-base font-bold text-white transition-colors active:scale-[0.98] hover:bg-action-learn-hover"
          >
            <Mail className="size-5" aria-hidden="true" />
            {t("auth.mobile.useEmailInstead")}
          </Button>
        </div>

        <div data-gateway-flow-item data-gateway-flow-order="3">
          <AuthConsentText />
        </div>
      </div>
    </div>
  );
}
