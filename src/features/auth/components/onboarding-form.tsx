"use client";

import { useActionState, useEffect, useState } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { matchSupportedLocale } from "@/data/languages";
import { useT } from "@/i18n/locale-provider";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export function OnboardingForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const [defaultUiLocale, setDefaultUiLocale] = useState<LocaleCode>("tr");
  const [defaultLanguage, setDefaultLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    const detected = matchSupportedLocale(navigator.language) ?? "tr";
    setDefaultUiLocale(detected);
    setDefaultLanguage(detected === "en" ? "tr" : "en");
  }, []);

  return (
    <form action={formAction} className="space-y-6" data-onboarding-form>
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage={defaultLanguage}
        defaultUiLocale={defaultUiLocale}
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
