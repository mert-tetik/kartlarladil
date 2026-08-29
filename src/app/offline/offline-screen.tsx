"use client";

import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

export function OfflineScreen() {
  const { locale, t } = useLocale();

  return (
    <section
      aria-labelledby="offline-title"
      className="fixed inset-0 z-[210] flex min-h-dvh items-center justify-center bg-[#f76808] px-8 text-center text-white"
    >
      <h1
        id="offline-title"
        className={cn(
          "max-w-[20rem] text-[clamp(2rem,8vw,3.5rem)] font-semibold leading-tight text-white",
          canUseSuperWater(locale) && "font-super-water",
        )}
      >
        {formatSuperWaterText(locale, t("offline.title"))}
      </h1>
    </section>
  );
}
