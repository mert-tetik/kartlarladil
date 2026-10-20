"use client";

import { AppRenderErrorFallback } from "@/components/app-render-error-fallback";
import { useLocale } from "@/i18n/locale-provider";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();

  return (
    <AppRenderErrorFallback
      error={error}
      title={t("pageLoadError.title")}
      description={t("pageLoadError.description")}
      retryLabel={t("common.retry")}
      reloadLabel={t("pageLoadError.reload")}
      onRetry={reset}
    />
  );
}
