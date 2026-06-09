"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { LanguageCode, Tier } from "@/types/domain";
import { LANGUAGES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { LanguageFlag } from "@/components/language-flag";
import { cn } from "@/lib/utils";

type LanguageOption = {
  value: LanguageCode | "all";
  label: string;
  icon?: ReactNode;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "all", label: "Tümü" },
  ...LANGUAGES.map((item) => ({ value: item.code, label: item.name, icon: <LanguageFlag code={item.code} /> })),
];

export function FilterControls({
  language,
  tier,
  onLanguageChange,
  onTierChange,
}: {
  language: LanguageCode | "all";
  tier: Tier | "all";
  onLanguageChange: (language: LanguageCode | "all") => void;
  onTierChange: (tier: Tier | "all") => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
      <div>
        <MobileLanguageDropdown
          value={language}
          onChange={(value) => onLanguageChange(value as LanguageCode | "all")}
        />
        <div className="hidden sm:block">
          <SegmentedControl
            label="Dil"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => onLanguageChange(value as LanguageCode | "all")}
          />
        </div>
      </div>
      <SegmentedControl
        label="Tier"
        value={tier}
        options={[
          { value: "all", label: "Tümü" },
          ...TIERS.map((item) => ({ value: item, label: item })),
        ]}
        onChange={(value) => onTierChange(value as Tier | "all")}
      />
    </div>
  );
}

function MobileLanguageDropdown({
  value,
  onChange,
}: {
  value: LanguageCode | "all";
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const labelId = useId();
  const valueId = useId();
  const listboxId = useId();
  const selectedOption = LANGUAGE_OPTIONS.find((option) => option.value === value) ?? LANGUAGE_OPTIONS[0];

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
    <div ref={dropdownRef} className="sm:hidden">
      <p id={labelId} className="mb-2 text-sm font-semibold text-slate-700">
        Dil
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
          className="flex h-11 w-full cursor-pointer items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition-colors hover:border-slate-300 focus:border-slate-950"
        >
          <span id={valueId} className="flex min-w-0 items-center gap-2">
            {"icon" in selectedOption ? selectedOption.icon : null}
            <span className="truncate">{selectedOption.label}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          />
        </button>

        {open ? (
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={buttonId}
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-sm"
          >
            {LANGUAGE_OPTIONS.map((option) => {
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
                    "flex h-10 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50",
                    selected && "bg-slate-100 text-slate-950",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {"icon" in option ? option.icon : null}
                    <span className="truncate">{option.label}</span>
                  </span>
                  {selected ? <Check aria-hidden="true" className="size-4 text-slate-950" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{label}</p>
      <div className="grid grid-cols-4 gap-1 rounded-md bg-slate-100 p-1 sm:flex">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 transition-colors",
                selected && "bg-white text-slate-950 shadow-sm",
              )}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
