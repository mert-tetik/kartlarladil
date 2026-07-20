"use client";

import { useState } from "react";
import Image from "next/image";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { MobileEmailAuthForm } from "@/features/auth/components/mobile-email-auth-form";
import { useT } from "@/i18n/locale-provider";
import { APP_NAME } from "@/lib/constants";

type AuthMode = "google" | "email";
type AuthType = "login" | "register";

export function MobileAuthScreen() {
  const t = useT();
  const [mode, setMode] = useState<AuthMode>("google");
  const [authType, setAuthType] = useState<AuthType>("login");

  if (mode === "email") {
    return (
      <div className="animate-screen-pop flex w-full max-w-sm flex-col">
        <MobileEmailAuthForm
          authType={authType}
          onToggleAuthType={() => setAuthType((current) => (current === "login" ? "register" : "login"))}
          onBack={() => setMode("google")}
        />
      </div>
    );
  }

  return (
    <div className="animate-screen-pop flex w-full max-w-sm flex-col items-center pb-10 text-center">
      <div className="h-11 w-72 max-w-full overflow-hidden sm:w-80">
        <Image
          src="/splash.png"
          alt={APP_NAME}
          width={1024}
          height={1024}
          priority
          className="h-auto w-full -translate-y-[40%]"
        />
      </div>

      <p className="mt-6 text-base leading-relaxed text-foreground-secondary">
        {t("auth.mobile.welcomeDescription")}
      </p>

      <div className="mt-10 flex w-full flex-col gap-3">
        <GoogleSignInButton
          nextPath="/?showOffer=1"
          label={t("auth.google.signIn")}
        />

        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => setMode("email")}
          className="mobile-primary-action-depth h-14 w-full gap-2 bg-emerald-500 text-base font-semibold text-white hover:bg-emerald-600"
        >
          <Mail className="size-5" aria-hidden="true" />
          {t("auth.mobile.useEmailInstead")}
        </Button>
      </div>
    </div>
  );
}
