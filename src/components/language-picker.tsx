"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

interface LanguagePickerProps {
  name: string;
  label: string;
  value: LanguageCode;
  onChange?: (code: LanguageCode) => void;
  error?: string;
}

export function LanguagePicker({ name, label, value, onChange, error }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const t = useT();

  function handleSelect(code: LanguageCode) {
    onChange?.(code);
    setOpen(false);
  }

  return (
    <div data-language-picker={name}>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "mt-2 flex h-12 w-full items-center justify-between rounded-md border border-border bg-background-card px-3 text-sm font-semibold text-foreground-secondary transition-colors hover:border-foreground-muted",
          error && "border-rose-300 ring-1 ring-rose-300",
        )}
      >
        <span className="flex items-center gap-2">
          <LanguageFlag code={value} />
          {getLanguageDisplayName(value, locale)}
        </span>
        <ChevronDown className="size-4 text-foreground-muted" aria-hidden="true" />
      </button>
      <input type="hidden" name={name} value={value} />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-background-inverse/50"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background-card p-4 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t("auth.preference.selectLanguage")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground"
                aria-label={t("auth.preference.close")}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-1 overflow-y-auto">
              {LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleSelect(language.code)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                    value === language.code
                      ? "bg-background-inverse text-foreground-inverse"
                      : "text-foreground-secondary hover:bg-background-muted",
                  )}
                >
                  <LanguageFlag code={language.code} />
                  {getLanguageDisplayName(language.code, locale)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
