"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { LanguageFlag } from "@/components/language-flag";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

const NON_LATIN_SCRIPT_LANGUAGES = new Set<LanguageCode>(["ru", "ar", "ja", "ko", "zh-CN"]);

export function usesNonLatinWritingSystem(language: LanguageCode) {
  return NON_LATIN_SCRIPT_LANGUAGES.has(language);
}

interface MobileCustomCardLanguagePickerProps {
  value: LanguageCode;
  onChange: (value: LanguageCode) => void;
  className?: string;
}

export function MobileCustomCardLanguagePicker({
  value,
  onChange,
  className,
}: MobileCustomCardLanguagePickerProps) {
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);

  const languageName = getLanguageDisplayName(value, locale);
  const languageOptions = LANGUAGES.map((language) => ({ code: language.code, count: 0 }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "control-gradient-outline flex h-11 w-full items-center gap-2 rounded-full px-3 text-left text-sm font-semibold text-black",
          className,
        )}
      >
        <LanguageFlag code={value} className="h-5 w-7 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{languageName}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <MobileLanguageBottomSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        options={languageOptions}
        selectedLanguage={value}
        onSelect={onChange}
        showCounts={false}
        optionStyle="navbar"
      />
    </>
  );
}
