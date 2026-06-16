"use client";

import { useActionState, useState } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { matchSupportedLocale } from "@/data/languages";
import { useT } from "@/i18n/locale-provider";
import type { LocaleCode } from "@/types/domain";

export function OnboardingForm({ nextPath }: { nextPath: string }) {
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const [deviceLocale] = useState<LocaleCode>(() => matchSupportedLocale(navigator.language) ?? "en");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage="en"
        defaultUiLocale={deviceLocale}
        defaultTier="A1"
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
