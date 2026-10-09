"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";

export function PageLoadErrorTestScreen() {
  const { t } = useLocale();

  return (
    <main
      className="fixed inset-0 z-[200] flex min-h-dvh items-center justify-center overflow-auto bg-white px-6 py-12 text-[#171717]"
      data-page-load-error-test
    >
      <section className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-[#f1f1f1] text-[#5b5b5b]">
          <TriangleAlert className="size-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("pageLoadError.title")}</h1>
        <p className="mt-3 max-w-xs text-sm leading-6 text-[#666666]">
          {t("pageLoadError.description")}
        </p>
        <button
          type="button"
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#171717] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#303030] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("pageLoadError.reload")}
        </button>
      </section>
    </main>
  );
}
