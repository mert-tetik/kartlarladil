"use client";

import { useActionState, useEffect } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { useT } from "@/i18n/locale-provider";

export function MobileOnboardingForm({ onComplete }: { onComplete?: () => void }) {
  const t = useT();
  const detectedLocale = useDetectedLocale();
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);

  useEffect(() => {
    if (state.status === "success" && onComplete) {
      onComplete();
    }
  }, [state, onComplete]);

  return (
    <form action={formAction} className="animate-screen-pop flex w-full max-w-sm flex-col">
      <input type="hidden" name="skipRedirect" value="on" />

      <h2 className="text-center font-display text-2xl font-semibold text-foreground">
        {t("auth.onboarding.title")}
      </h2>
      <p className="mt-2 text-center text-sm text-foreground-secondary">
        {t("auth.onboarding.description")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <FormMessage state={state} />

        <PreferenceFields
          hideTier
          defaultLanguage={detectedLocale === "en" ? "tr" : "en"}
          defaultUiLocale={detectedLocale}
          languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
          uiLocaleError={state.fieldErrors?.preferredUiLocale?.[0]}
        />

        <SubmitButton
          className="mt-2 h-14 w-full text-base font-bold"
          pendingLabel={t("auth.onboarding.pending")}
        >
          {t("auth.onboarding.continue")}
        </SubmitButton>
      </div>
    </form>
  );
}
