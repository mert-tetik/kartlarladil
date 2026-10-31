"use client";

import type { ComponentProps } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

type SuperWaterTextProps = Omit<ComponentProps<"span">, "children"> & {
  children: string;
};

export function SuperWaterText({ children, className, ...props }: SuperWaterTextProps) {
  const { locale } = useLocale();
  const useSuperWater = canUseSuperWater(locale);

  return (
    <span className={cn(useSuperWater && "font-super-water", className)} {...props}>
      {formatSuperWaterText(locale, children)}
    </span>
  );
}
