"use client";

import { useEffect, useState } from "react";
import { LanguagePicker } from "@/components/language-picker";
import { PREFERRED_TIERS } from "@/features/auth/preferred-tier";
import { FieldError } from "@/features/auth/components/form-message";
import { getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode, PreferredTier, Tier } from "@/types/domain";

export function PreferenceFields({
  defaultLanguage = "en",
  defaultUiLocale = "en",
  defaultTier = "A1",
  languageError,
  uiLocaleError,
  tierError,
}: {
  defaultLanguage?: LanguageCode | null;
  defaultUiLocale?: LocaleCode | null;
  defaultTier?: PreferredTier | null;
  languageError?: string;
  uiLocaleError?: string;
  tierError?: string;
}) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage ?? "en");
  const [selectedUiLocale, setSelectedUiLocale] = useState<LocaleCode>(defaultUiLocale ?? "en");

  useEffect(() => {
    if (defaultLanguage && defaultLanguage !== selectedLanguage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedLanguage(defaultLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLanguage]);

  useEffect(() => {
    if (defaultUiLocale && defaultUiLocale !== selectedUiLocale) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedUiLocale(defaultUiLocale);
      setLocale(defaultUiLocale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUiLocale]);

  function handleUiLocaleChange(code: LocaleCode) {
    setSelectedUiLocale(code);
    setLocale(code);
  }

  return (
    <div className="space-y-5">
      <LanguagePicker
        name="preferredLanguageCode"
        label={t("auth.preference.language")}
        value={selectedLanguage}
        onChange={setSelectedLanguage}
        error={languageError}
      />

      <LanguagePicker
        name="preferredUiLocale"
        label={t("auth.preference.uiLanguage")}
        value={selectedUiLocale}
        onChange={handleUiLocaleChange}
        error={uiLocaleError}
      />

      <fieldset data-preference-tier>
        <legend className="text-sm font-semibold text-foreground">{t("auth.preference.tier")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PREFERRED_TIERS.map((tier) => (
            <label key={tier} className="block">
              <input
                className="peer sr-only"
                type="radio"
                name="preferredTier"
                value={tier}
                defaultChecked={(defaultTier ?? "A1") === tier}
                required
              />
              <span
                className={cn(
                  "flex h-12 flex-col justify-center rounded-md border border-border bg-background-card px-3 text-sm font-semibold text-foreground-secondary transition-colors",
                  "peer-checked:border-foreground peer-checked:bg-background-inverse peer-checked:text-foreground-inverse",
                  "hover:border-foreground-muted",
                )}
              >
                {tier === "all" ? (
                  <span>{t("common.all")}</span>
                ) : (
                  <>
                    <span>{tier}</span>
                    <span className="text-xs font-semibold opacity-70">{getTierLabel(tier as Tier, locale)}</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={tierError} />
      </fieldset>
    </div>
  );
}
