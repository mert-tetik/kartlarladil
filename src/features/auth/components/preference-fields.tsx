"use client";

import { useEffect, useState } from "react";
import { LanguagePicker } from "@/components/language-picker";
import { TIERS } from "@/data/tiers";
import { FieldError } from "@/features/auth/components/form-message";
import { getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";

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
  defaultTier?: Tier | null;
  languageError?: string;
  uiLocaleError?: string;
  tierError?: string;
}) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage ?? "en");
  const [selectedUiLocale, setSelectedUiLocale] = useState<LocaleCode>(defaultUiLocale ?? "en");

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

      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">{t("auth.preference.tier")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TIERS.map((tier) => (
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
                  "flex h-12 flex-col justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors",
                  "peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white",
                  "hover:border-slate-400",
                )}
              >
                <span>{tier}</span>
                <span className="text-xs font-semibold opacity-70">{getTierLabel(tier, locale)}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={tierError} />
      </fieldset>
    </div>
  );
}
