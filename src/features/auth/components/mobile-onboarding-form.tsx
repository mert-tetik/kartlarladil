"use client";

import { useActionState, useEffect, useRef } from "react";
import { LANGUAGES } from "@/data/languages";
import { writeLandingCardLanguage } from "@/app/components/landing-card-language";
import { completeOnboardingAction } from "@/features/auth/actions";
import { useAuthSession } from "@/features/auth/auth-client";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { PreferenceFields } from "@/features/auth/components/preference-fields";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { isPreferredTier } from "@/features/auth/preferred-tier";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { useT } from "@/i18n/locale-provider";
import type { LanguageCode, LocaleCode } from "@/types/domain";

function readLanguageCode(value: FormDataEntryValue | null): LanguageCode | null {
  return typeof value === "string" && LANGUAGES.some((language) => language.code === value)
    ? (value as LanguageCode)
    : null;
}

export function MobileOnboardingForm({ onComplete }: { onComplete?: () => void }) {
  const t = useT();
  const detectedLocale = useDetectedLocale();
  const { refreshProfile, updateProfileField } = useAuthSession();
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const formRef = useRef<HTMLFormElement | null>(null);
  const handledSuccessRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;

    if (formRef.current) {
      const formData = new FormData(formRef.current);
      const preferredLanguageCode = readLanguageCode(formData.get("preferredLanguageCode"));
      const preferredUiLocale = readLanguageCode(formData.get("preferredUiLocale")) as LocaleCode | null;
      const preferredTierValue = formData.get("preferredTier");
      const preferredTier =
        typeof preferredTierValue === "string" && isPreferredTier(preferredTierValue)
          ? preferredTierValue
          : null;

      if (preferredLanguageCode) {
        writeLandingCardLanguage(preferredLanguageCode);
      }

      updateProfileField({
        ...(preferredLanguageCode ? { preferredLanguageCode } : {}),
        ...(preferredUiLocale ? { preferredUiLocale } : {}),
        ...(preferredTier ? { preferredTier } : {}),
        onboardingCompleted: true,
      });
    }

    void refreshProfile();
    onComplete?.();
  }, [state.status, onComplete, refreshProfile, updateProfileField]);

  return (
    <form ref={formRef} action={formAction} className="animate-screen-pop flex w-full max-w-sm flex-col">
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
          swapOnConflict
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
