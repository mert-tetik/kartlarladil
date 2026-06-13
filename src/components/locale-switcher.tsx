"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGES } from "@/data/languages";
import { LanguageFlag } from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LocaleCode } from "@/types/domain";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const listboxId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        id={buttonId}
        type="button"
        variant="secondary"
        size="sm"
        aria-label={t("locale.change")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        className="h-9 gap-1.5 px-2"
      >
        <LanguageFlag code={locale} className="h-4 w-6" />
        <ChevronDown aria-hidden="true" className={cn("size-3.5 text-slate-500 transition-transform", open && "rotate-180")} />
      </Button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
        >
          {LANGUAGES.map((language) => {
            const selected = language.code === locale;

            return (
              <button
                key={language.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setLocale(language.code as LocaleCode);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-11 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-sm transition-colors hover:bg-slate-50",
                  selected && "bg-slate-100",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <LanguageFlag code={language.code} className="h-4 w-6" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-950">{language.nativeName}</span>
                    <span className="block truncate text-xs text-slate-500">{getLanguageDisplayName(language.code, locale)}</span>
                  </span>
                </span>
                {selected ? <Check aria-hidden="true" className="size-4 text-slate-950" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
