"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

export type CustomCardTargetLanguage = "auto" | LanguageCode;

const NON_LATIN_SCRIPT_LANGUAGES = new Set<LanguageCode>(["ru", "ar", "ja", "ko", "zh-CN"]);

export function usesNonLatinWritingSystem(language: LanguageCode) {
  return NON_LATIN_SCRIPT_LANGUAGES.has(language);
}

interface MobileCustomCardLanguagePickerProps {
  value: CustomCardTargetLanguage;
  resolvedLanguage: LanguageCode;
  onChange: (value: CustomCardTargetLanguage) => void;
}

export function MobileCustomCardLanguagePicker({
  value,
  resolvedLanguage,
  onChange,
}: MobileCustomCardLanguagePickerProps) {
  const { locale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const showTransliterationHint = usesNonLatinWritingSystem(resolvedLanguage);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectLanguage(nextValue: CustomCardTargetLanguage) {
    onChange(nextValue);
    setOpen(false);
  }

  const resolvedLanguageName = getLanguageDisplayName(resolvedLanguage, locale);

  return (
    <div ref={pickerRef} className="relative">
      {showTransliterationHint ? (
        <p className="mb-2 text-center text-xs leading-5 text-foreground-secondary">
          {t("createCard.targetLanguage.transliterationHint", { language: resolvedLanguageName })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-11 w-full items-center gap-2 rounded-md border border-brand bg-white px-3 text-left text-sm font-semibold text-black"
      >
        <LanguageFlag code={resolvedLanguage} className="h-5 w-7 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {value === "auto"
            ? t("createCard.targetLanguage.autoWithLanguage", { language: resolvedLanguageName })
            : resolvedLanguageName}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t("createCard.targetLanguage.label")}
          className="absolute inset-x-0 bottom-full z-40 mb-2 max-h-56 overflow-y-auto rounded-md border border-border bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === "auto"}
            onClick={() => selectLanguage("auto")}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-slate-950 transition-colors",
              value === "auto" ? "bg-slate-100" : "hover:bg-slate-50",
            )}
          >
            <LanguageFlag code={resolvedLanguage} className="h-5 w-7 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("createCard.targetLanguage.autoWithLanguage", { language: resolvedLanguageName })}</span>
            {value === "auto" ? <Check className="size-4 shrink-0" /> : null}
          </button>
          {LANGUAGES.map((language) => {
            const selected = value === language.code;
            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectLanguage(language.code)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-slate-950 transition-colors",
                  selected ? "bg-slate-100" : "hover:bg-slate-50",
                )}
              >
                <LanguageFlag code={language.code} className="h-5 w-7 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{getLanguageDisplayName(language.code, locale)}</span>
                {selected ? <Check className="size-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
