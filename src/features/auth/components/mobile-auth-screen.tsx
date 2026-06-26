"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { MobileEmailAuthForm } from "@/features/auth/components/mobile-email-auth-form";
import { useT } from "@/i18n/locale-provider";

type AuthMode = "google" | "email";
type AuthType = "login" | "register";

export function MobileAuthScreen() {
  const t = useT();
  const [mode, setMode] = useState<AuthMode>("google");
  const [authType, setAuthType] = useState<AuthType>("login");

  if (mode === "email") {
    return (
      <div className="flex w-full max-w-sm flex-col">
        <MobileEmailAuthForm
          authType={authType}
          onToggleAuthType={() => setAuthType((current) => (current === "login" ? "register" : "login"))}
          onBack={() => setMode("google")}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <h1 className="font-display text-3xl font-semibold text-orange-500">
        {t("auth.mobile.welcomeTitle")}
      </h1>

      <p className="mt-4 text-base leading-relaxed text-foreground-secondary">
        {t("auth.mobile.welcomeDescription")}
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <GoogleSignInButton
          nextPath="/"
          label={t("auth.google.signIn")}
        />

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => setMode("email")}
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          <Mail className="size-5" aria-hidden="true" />
          {t("auth.mobile.useEmailInstead")}
        </Button>
      </div>
    </div>
  );
}
