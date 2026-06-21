"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_STYLES } from "@/data/tiers";
import { LanguageFlag } from "@/components/language-flag";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier } from "@/types/domain";

type SelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  className?: string;
};

export function FilterControls({
  language,
  tier,
  onLanguageChange,
  onTierChange,
  mobileMenuDirection = "down",
}: {
  language: LanguageCode | "all";
  tier: Tier | "all";
  onLanguageChange: (language: LanguageCode | "all") => void;
  onTierChange: (tier: Tier | "all") => void;
  mobileMenuDirection?: "up" | "down";
}) {
  const t = useT();
  const { locale } = useLocale();
  const languageOptions = useMemo<SelectOption[]>(
    () => [
      { value: "all", label: t("common.all") },
      ...LANGUAGES.map((item) => ({
        value: item.code,
        label: getLanguageDisplayName(item.code, locale),
        icon: <LanguageFlag code={item.code} className="h-5 w-7" />,
      })),
    ],
    [locale, t],
  );

  const tierOptions = useMemo<SelectOption[]>(
    () => [
      { value: "all", label: t("common.all") },
      ...TIERS.map((item) => ({
        value: item,
        label: item,
        className: TIER_STYLES[item].text,
      })),
    ],
    [t],
  );

  return (
    <div className="grid grid-cols-2 gap-2 md:gap-3">
      <div>
        <SelectDropdown
          label={t("cards.language")}
          options={languageOptions}
          value={language}
          onChange={(value) => onLanguageChange(value as LanguageCode | "all")}
          mobileMenuDirection={mobileMenuDirection}
        />
      </div>
      <div>
        <SelectDropdown
          label={t("cards.tier")}
          options={tierOptions}
          value={tier}
          onChange={(value) => onTierChange(value as Tier | "all")}
          mobileMenuDirection={mobileMenuDirection}
        />
      </div>
    </div>
  );
}

export function SelectDropdown({
  label,
  options,
  value,
  onChange,
  mobileMenuDirection = "down",
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  mobileMenuDirection?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={dropdownRef}>
      <p id={labelId} className="mb-1 mt-0.5 text-sm font-semibold text-foreground-secondary">
        {label}
      </p>
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={`${labelId} ${valueId}`}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="flex h-11 w-full cursor-pointer items-center justify-between rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors hover:border-border focus:border-foreground"
        >
          <span id={valueId} className="flex min-w-0 items-center gap-2">
            {selectedOption.icon}
            <span className={cn("truncate", selectedOption.className)}>{selectedOption.label}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 shrink-0 text-foreground-muted transition-transform", open && "rotate-180")}
          />
        </button>

        {open ? (
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={buttonId}
            className={cn(
              "animate-menu-pop absolute left-0 right-0 z-30 max-h-72 overflow-y-auto rounded-md border border-border bg-background-card p-1 shadow-lg",
              mobileMenuDirection === "up"
                ? "top-[calc(100%+6px)] origin-top max-lg:bottom-[calc(100%+6px)] max-lg:top-auto max-lg:origin-bottom"
                : "top-[calc(100%+6px)] origin-top",
            )}
          >
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-10 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-sm font-semibold text-foreground-secondary transition-colors hover:bg-background",
                    selected && "bg-background-muted text-foreground",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {option.icon}
                    <span className={cn("truncate", option.className)}>{option.label}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" className="size-4 text-foreground" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
