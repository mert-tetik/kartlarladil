"use client";

import { WifiOff } from "lucide-react";
import { useT } from "@/i18n/locale-provider";

export default function OfflinePage() {
  const t = useT();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background-card p-8 shadow-sm">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
          <WifiOff className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground">
          {t("offline.title")}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t("offline.description")}
        </p>
      </div>
    </div>
  );
}
