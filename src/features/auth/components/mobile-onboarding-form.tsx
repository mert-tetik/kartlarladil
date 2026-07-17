"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { writeLandingCardLanguage } from "@/app/components/landing-card-language";
import { completeOnboardingAction } from "@/features/auth/actions";
import { useAuthSession } from "@/features/auth/auth-client";
import { ProfilePictureOptionGrid } from "@/features/auth/components/profile-picture-option-grid";
import { AUTH_ACTION_IDLE_STATE } from "@/features/auth/auth-types";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { getOnboardingLanguageDefaults } from "@/features/auth/onboarding-defaults";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useDetectedLocale } from "@/i18n/use-detected-locale";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";

type OnboardingStep = "native" | "learning" | "picture";

function getLanguageOrder(firstLanguage: LanguageCode, turkishThird = false) {
  const ordered = [
    ...LANGUAGES.filter((language) => language.code === firstLanguage),
    ...LANGUAGES.filter((language) => language.code !== firstLanguage),
  ];

  if (!turkishThird) {
    return ordered;
  }

  const turkish = ordered.find((language) => language.code === "tr");
  return turkish
    ? [...ordered.filter((language) => language.code !== "tr").slice(0, 2), turkish, ...ordered.filter((language) => language.code !== "tr").slice(2)]
    : ordered;
}

export function MobileOnboardingForm({
  onComplete,
  countryCode,
}: {
  onComplete?: () => void;
  countryCode: string | null;
}) {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const detectedLocale = useDetectedLocale();
  const { refreshProfile, updateProfileField } = useAuthSession();
  const initialDefaults = getOnboardingLanguageDefaults(countryCode, detectedLocale);
  const [step, setStep] = useState<OnboardingStep>("native");
  const [preferredUiLocale, setPreferredUiLocale] = useState<LocaleCode>(initialDefaults.preferredUiLocale);
  const [preferredLanguageCode, setPreferredLanguageCode] = useState<LanguageCode>(initialDefaults.preferredLanguageCode);
  const [languageOrders, setLanguageOrders] = useState(() => ({
    native: getLanguageOrder(initialDefaults.preferredUiLocale, true),
    learning: getLanguageOrder(initialDefaults.preferredLanguageCode),
  }));
  const [profilePictureIndex, setProfilePictureIndex] = useState(0);
  const [state, formAction] = useActionState(completeOnboardingAction, AUTH_ACTION_IDLE_STATE);
  const formRef = useRef<HTMLFormElement | null>(null);
  const handledSuccessRef = useRef(false);
  const hasSelectedLanguageRef = useRef(false);

  useEffect(() => {
    if (countryCode || hasSelectedLanguageRef.current) {
      return;
    }

    const defaults = getOnboardingLanguageDefaults(null, detectedLocale);
    setPreferredUiLocale(defaults.preferredUiLocale);
    setPreferredLanguageCode(defaults.preferredLanguageCode);
    setLanguageOrders({
      native: getLanguageOrder(defaults.preferredUiLocale, true),
      learning: getLanguageOrder(defaults.preferredLanguageCode),
    });
  }, [countryCode, detectedLocale]);

  useEffect(() => {
    if (state.status !== "success" || handledSuccessRef.current) {
      return;
    }

    handledSuccessRef.current = true;
    writeLandingCardLanguage(preferredLanguageCode);
    setLocale(preferredUiLocale);
    updateProfileField({
      preferredLanguageCode,
      preferredUiLocale,
      preferredTier: "all",
      profilePictureIndex,
      onboardingCompleted: true,
    });
    void refreshProfile();
    onComplete?.();
  }, [
    onComplete,
    preferredLanguageCode,
    preferredUiLocale,
    profilePictureIndex,
    refreshProfile,
    setLocale,
    state.status,
    updateProfileField,
  ]);

  function selectNativeLanguage(code: LanguageCode) {
    hasSelectedLanguageRef.current = true;
    setPreferredUiLocale(code);

    if (preferredLanguageCode === code) {
      setPreferredLanguageCode(code === "en" ? "es" : "en");
    }
  }

  function selectLearningLanguage(code: LanguageCode) {
    if (code === preferredUiLocale) {
      return;
    }

    hasSelectedLanguageRef.current = true;
    setPreferredLanguageCode(code);
  }

  function advanceLanguageStep() {
    setStep((current) => (current === "native" ? "learning" : "picture"));
  }

  function goBack() {
    setStep((current) => (current === "picture" ? "learning" : "native"));
  }

  const isLanguageStep = step === "native" || step === "learning";
  const heading =
    step === "native"
      ? t("auth.onboarding.nativeLanguageTitle")
      : step === "learning"
        ? t("auth.onboarding.learningLanguageTitle")
        : t("profilePicture.title");
  const orderedLanguages = (step === "native" ? languageOrders.native : languageOrders.learning)
    .filter((language) => step !== "learning" || language.code !== preferredUiLocale);
  const actionButtonClass = step === "native"
    ? "bg-emerald-500 text-white hover:bg-emerald-600"
    : step === "learning"
      ? "bg-blue-500 text-white hover:bg-blue-600"
      : "bg-red-500 text-white hover:bg-red-600";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="animate-screen-pop grid h-[min(76vh,44rem)] w-full max-w-sm grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden supports-[height:100dvh]:h-[min(76dvh,44rem)]"
    >
      <input type="hidden" name="preferredUiLocale" value={preferredUiLocale} />
      <input type="hidden" name="preferredLanguageCode" value={preferredLanguageCode} />
      <input type="hidden" name="preferredTier" value="all" />
      <input type="hidden" name="profilePictureIndex" value={profilePictureIndex} />
      <input type="hidden" name="skipRedirect" value="on" />

      <div className="relative shrink-0 pb-5 pt-1 text-center">
        {step !== "native" ? (
          <button
            type="button"
            aria-label={t("common.back")}
            onClick={goBack}
            className="absolute left-0 top-0 inline-flex size-10 items-center justify-center text-foreground transition-transform active:scale-95"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
        ) : null}
        <h2 className="font-display text-3xl font-semibold leading-tight text-foreground">{heading}</h2>
      </div>

      {isLanguageStep ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-x-2 gap-y-5 pb-3">
            {orderedLanguages.map((language) => {
              const selected = step === "native"
                ? preferredUiLocale === language.code
                : preferredLanguageCode === language.code;

              return (
                <button
                  key={language.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (step === "native") {
                      selectNativeLanguage(language.code);
                    } else {
                      selectLearningLanguage(language.code);
                    }
                  }}
                  className={cn(
                    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg px-2 text-center transition-transform duration-200 active:scale-95",
                    selected ? "scale-[1.03]" : "text-foreground-secondary hover:text-foreground",
                  )}
                >
                  <span
                    data-onboarding-language-flag={language.code}
                    className={cn(
                      "inline-flex rounded-md p-[2px] transition-all duration-300",
                      selected && "bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500",
                    )}
                  >
                    <LanguageFlag
                      code={language.code}
                      className={cn("h-14 w-20 rounded-[4px] border-0 transition-transform duration-300", selected && "scale-110")}
                    />
                  </span>
                  <span className={cn(
                    "text-sm font-semibold leading-tight",
                    selected
                      ? "bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent"
                      : "text-foreground-secondary",
                  )}>
                    {getLanguageDisplayName(language.code, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <ProfilePictureOptionGrid selectedIndex={profilePictureIndex} onSelect={setProfilePictureIndex} className="pb-3" />
        </div>
      )}

      <div className="shrink-0 pt-5">
        <FormMessage state={state} />
        {isLanguageStep ? (
          <button
            type="button"
            onClick={advanceLanguageStep}
            className={cn("h-14 w-full rounded-lg px-5 text-base font-bold transition-transform active:scale-[0.99]", actionButtonClass)}
          >
            {t("auth.onboarding.selectLanguage")}
          </button>
        ) : (
          <SubmitButton className={cn("h-14 w-full text-base font-bold", actionButtonClass)} pendingLabel={t("auth.onboarding.pending")}>
            {t("auth.onboarding.continue")}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
