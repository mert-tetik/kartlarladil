"use client";

import { useLocale } from "@/i18n/locale-provider";

export type OfflineVisualScenario = "offline";

export function OfflineScreen({ visualScenario }: { visualScenario?: OfflineVisualScenario } = {}) {
  const { t } = useLocale();
  const src = visualScenario
    ? `/offline-shell/index.html?visual=${visualScenario}`
    : "/offline-shell/index.html";

  return (
    <iframe
      aria-label={t("offline.title")}
      className="fixed inset-0 h-[100dvh] w-full border-0 bg-[#090909]"
      data-offline-shell-frame="true"
      src={src}
      style={{ zIndex: 1_999 }}
      title={t("offline.title")}
    />
  );
}
