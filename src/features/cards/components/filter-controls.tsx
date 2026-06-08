"use client";

import type { ReactNode } from "react";
import type { LanguageCode, Tier } from "@/types/domain";
import { LANGUAGES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { LanguageFlag } from "@/components/language-flag";
import { cn } from "@/lib/utils";

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
      <SegmentedControl
        label="Dil"
        value={language}
        options={[
          { value: "all", label: "Tümü" },
          ...LANGUAGES.map((item) => ({ value: item.code, label: item.name, icon: <LanguageFlag code={item.code} /> })),
        ]}
        onChange={(value) => onLanguageChange(value as LanguageCode | "all")}
      />
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
                "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-600 transition-colors",
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
