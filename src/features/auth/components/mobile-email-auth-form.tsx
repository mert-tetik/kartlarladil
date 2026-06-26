"use client";

import { useActionState } from "react";
import { ChevronLeft } from "lucide-react";
import { loginAction, registerAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FieldError, FormMessage, inputClassName } from "@/features/auth/components/form-message";
import { PasswordInput } from "@/features/auth/components/password-input";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";

interface MobileEmailAuthFormProps {
  authType: "login" | "register";
  onToggleAuthType: () => void;
  onBack: () => void;
}

export function MobileEmailAuthForm({ authType, onToggleAuthType, onBack }: MobileEmailAuthFormProps) {
  const t = useT();
  const isRegister = authType === "register";
  const [state, formAction] = useActionState(
    isRegister ? registerAction : loginAction,
    AUTH_ACTION_IDLE_STATE,
  );

  return (
    <form action={formAction} className="flex w-full flex-col">
      <input type="hidden" name="next" value="/" />

      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 self-start text-sm font-semibold text-foreground-secondary transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
        {t("common.back")}
      </button>

      <h2 className="font-display text-2xl font-semibold text-foreground">
        {isRegister ? t("auth.register.title") : t("auth.login.title")}
      </h2>

      <div className="mt-6 flex flex-col gap-4">
        <FormMessage state={state} />

        {isRegister ? (
          <label className="block">
            <span className="text-sm font-semibold text-foreground">{t("common.displayName")}</span>
            <input
              className={inputClassName}
              name="displayName"
              type="text"
              autoComplete="name"
            />
            <FieldError message={state.fieldErrors?.displayName?.[0]} />
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.email")}</span>
          <input
            className={inputClassName}
            name="email"
            type="email"
            autoComplete={isRegister ? "email" : "email"}
            required
          />
          <FieldError message={state.fieldErrors?.email?.[0]} />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-foreground">{t("common.password")}</span>
          <PasswordInput
            name="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
          />
          <FieldError message={state.fieldErrors?.password?.[0]} />
        </label>

        {isRegister ? (
          <>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="consent"
                value="on"
                required
                className="mt-1 size-4 rounded border-border text-foreground focus:ring-foreground"
              />
              <span className="text-sm leading-6 text-foreground-secondary">
                {t("register.consentPrefix")}
                <a href="/terms" className="font-semibold text-foreground underline hover:no-underline">
                  {t("register.consentTerms")}
                </a>
                {t("register.consentAnd")}
                <a href="/privacy" className="font-semibold text-foreground underline hover:no-underline">
                  {t("register.consentPrivacy")}
                </a>
                {t("register.consentSuffix")}
              </span>
            </label>
            <FieldError message={state.fieldErrors?.consent?.[0]} />
          </>
        ) : null}

        <PreferenceFields
          hideTier
          defaultLanguage="en"
          defaultUiLocale="tr"
          languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
          uiLocaleError={state.fieldErrors?.preferredUiLocale?.[0]}
        />

        <SubmitButton
          className="mt-2 h-14 w-full text-base font-bold"
          pendingLabel={isRegister ? t("auth.register.pending") : t("auth.login.pending")}
        >
          {isRegister ? t("auth.register.title") : t("auth.login.title")}
        </SubmitButton>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onToggleAuthType}
        className="mt-4 h-auto w-full py-2 text-sm font-semibold"
      >
        {isRegister ? t("auth.register.hasAccount") : t("auth.login.noAccount")}
      </Button>
    </form>
  );
}
