"use client";

import { useActionState, useEffect, useRef } from "react";
import { completeOnboardingAction } from "@/features/auth/actions";
import { getOnboardingLanguageDefaults } from "@/features/auth/onboarding-defaults";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { useT } from "@/i18n/locale-provider";
import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";
import { trackAnalyticsEvent } from "@/lib/analytics-events";

export function OnboardingForm({ nextPath, countryCode }: { nextPath: string; countryCode?: string | null }) {
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const t = useT();
  const detectedLocale = useDetectedLocale();
  const defaults = getOnboardingLanguageDefaults(countryCode, detectedLocale);
  const onboardingTrackedRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || onboardingTrackedRef.current) return;
    onboardingTrackedRef.current = true;
    trackAnalyticsEvent("onboarding_completed", { onboarding_source: "web" });
    sendTwaAnalyticsEvent("fd_onboarding_completed", {
      params: { onboarding_source: "web" },
    });
  }, [state.status]);

  return (
    <form
      action={formAction}
      className="space-y-6"
      data-onboarding-form
      data-flow-button-sound="auth"
    >
      <input type="hidden" name="next" value={nextPath} />
      <FormMessage state={state} />

      <PreferenceFields
        defaultLanguage={defaults.preferredLanguageCode}
        defaultUiLocale={defaults.preferredUiLocale}
        defaultTier="all"
        swapOnConflict
        languageError={state.fieldErrors?.preferredLanguageCode?.[0]}
        uiLocaleError={state.fieldErrors?.preferredUiLocale?.[0]}
        tierError={state.fieldErrors?.preferredTier?.[0]}
      />

      <SubmitButton className="w-full disabled:opacity-100" pendingLabel={t("auth.onboarding.pending")}>
        {t("auth.onboarding.continue")}
      </SubmitButton>
    </form>
  );
}
