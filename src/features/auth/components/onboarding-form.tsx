"use client";

import { useActionState } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { useT } from "@/i18n/locale-provider";

export function OnboardingForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const detectedLocale = useDetectedLocale();
  const defaultLanguage = detectedLocale === "en" ? "tr" : "en";

  return (
    <form action={formAction} className="space-y-6" data-onboarding-form>
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage={defaultLanguage}
        defaultUiLocale={detectedLocale}
        defaultTier="all"
        languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
        uiLocaleError={state.fieldErrors?.preferredUiLocale?.[0]}
        tierError={state.fieldErrors?.preferredTier?.[0]}
      />

      <SubmitButton className="w-full" pendingLabel={t("auth.onboarding.pending")}>
        {t("auth.onboarding.continue")}
      </SubmitButton>
    </form>
  );
}
