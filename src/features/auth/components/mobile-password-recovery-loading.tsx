"use client";

import { useT } from "@/i18n/locale-provider";

export function MobilePasswordRecoveryLoading() {
  const t = useT();

  return (
    <div data-gateway-flow-screen className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
      <div
        aria-hidden="true"
        className="mb-6 size-10 animate-spin rounded-full border-4 border-border border-t-foreground"
      />
      <p data-gateway-flow-item data-gateway-flow-order="0" className="text-base font-semibold text-foreground">
        {t("common.loading")}
      </p>
    </div>
  );
}
