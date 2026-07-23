"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [anchor, setAnchor] = useState<{
    bottom: number;
    left: number;
    maxMenuHeight: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const showTransliterationHint = usesNonLatinWritingSystem(resolvedLanguage);

  function updateAnchor() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const bottom = Math.max(8, window.innerHeight - rect.top + 8);
    setAnchor({
      bottom,
      left: Math.max(12, rect.left),
      maxMenuHeight: Math.max(132, Math.min(256, rect.top - 76)),
      width: Math.min(rect.width, window.innerWidth - Math.max(12, rect.left) - 12),
    });
  }

  useEffect(() => {
    if (!open && !showTransliterationHint) return;

    const frame = window.requestAnimationFrame(updateAnchor);

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function handleViewportChange() {
      window.requestAnimationFrame(updateAnchor);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, showTransliterationHint]);

  function selectLanguage(nextValue: CustomCardTargetLanguage) {
    onChange(nextValue);
    setOpen(false);
  }

  const resolvedLanguageName = getLanguageDisplayName(resolvedLanguage, locale);
  const dropdown = open && anchor && typeof document !== "undefined"
    ? createPortal(
      <div
        ref={menuRef}
        role="listbox"
        aria-label={t("createCard.targetLanguage.label")}
        className="fixed z-[110] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-200 ease-out"
        style={{ bottom: anchor.bottom, left: anchor.left, maxHeight: anchor.maxMenuHeight, width: anchor.width }}
      >
        <LanguageOption
          language={resolvedLanguage}
          selected={value === "auto"}
          label={t("createCard.targetLanguage.autoWithLanguage", { language: resolvedLanguageName })}
          onClick={() => selectLanguage("auto")}
        />
        {LANGUAGES.map((language) => (
          <LanguageOption
            key={language.code}
            language={language.code}
            selected={value === language.code}
            label={getLanguageDisplayName(language.code, locale)}
            onClick={() => selectLanguage(language.code)}
          />
        ))}
      </div>,
      document.body,
    )
    : null;

  const transliterationHint = showTransliterationHint && anchor && typeof document !== "undefined"
    ? createPortal(
      <p
        className="pointer-events-none fixed z-[111] max-w-[calc(100vw-1.5rem)] rounded-lg bg-black/75 px-3 py-2 text-center text-xs leading-5 text-white shadow-lg"
        style={{
          bottom: anchor.bottom + (open ? anchor.maxMenuHeight + 10 : 0),
          left: anchor.left,
          width: anchor.width,
        }}
      >
        {t("createCard.targetLanguage.transliterationHint", { language: resolvedLanguageName })}
      </p>,
      document.body,
    )
    : null;

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open) updateAnchor();
          setOpen((current) => !current);
        }}
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
      {dropdown}
      {transliterationHint}
    </div>
  );
}

function LanguageOption({
  language,
  selected,
  label,
  onClick,
}: {
  language: LanguageCode;
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-950 transition-colors",
        selected ? "bg-slate-100" : "hover:bg-slate-50",
      )}
    >
      <LanguageFlag code={language} className="h-5 w-7 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? <Check className="size-4 shrink-0" /> : null}
    </button>
  );
}
