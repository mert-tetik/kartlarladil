"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

interface InlineLanguagePickerProps {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
}

export function InlineLanguagePicker({ value, onChange }: InlineLanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const t = useT();

  function handleSelect(code: LanguageCode) {
    onChange(code);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex cursor-pointer items-center gap-2 rounded-md text-sm text-foreground-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <LanguageFlag code={value} className="h-4 w-6" />
        <span className="truncate font-medium">{getLanguageDisplayName(value, locale)}</span>
        <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-background-inverse/50"
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
                  <LanguageFlag code={language.code} className="h-5 w-7" />
                  {getLanguageDisplayName(language.code, locale)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
