"use client";

import Image from "next/image";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  const { locale, t } = useLocale();

  return (
    <section
      aria-labelledby="offline-title"
      className="fixed inset-0 z-[210] flex min-h-dvh items-center justify-center bg-[#f76808] px-8 text-center text-white"
    >
      <div className="flex w-full max-w-[20rem] flex-col items-center">
        <div className="h-14 w-72 max-w-full overflow-hidden">
          <Image
            alt="FoxiesDeck"
            className="h-auto w-full -translate-y-[40%]"
            height={1024}
            priority
            src="/splash.png"
            width={1024}
          />
        </div>
        <h1
          id="offline-title"
          className={cn(
            "mt-12 text-4xl font-semibold leading-none text-white",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterText(locale, t("offline.title"))}
        </h1>
        <p className="mt-5 max-w-xs text-base leading-relaxed text-white/85">
          {t("offline.description")}
        </p>
      </div>
    </section>
  );
}
