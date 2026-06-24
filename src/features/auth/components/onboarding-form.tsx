"use client";

import { useActionState, useEffect, useState } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { matchSupportedLocale } from "@/data/languages";
import { useT } from "@/i18n/locale-provider";
import { fetchGeoCurrencyInfo } from "@/lib/geo-currency";
import type { LanguageCode } from "@/types/domain";

export function OnboardingForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      const geo = await fetchGeoCurrencyInfo();
      if (cancelled) return;

      const languageCode =
        geo?.languageCode ?? matchSupportedLocale(navigator.language) ?? "en";
      setDetectedLanguage(languageCode as LanguageCode);
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <form action={formAction} className="space-y-6" data-onboarding-form>
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage={detectedLanguage}
        defaultUiLocale="tr"
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
