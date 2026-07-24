"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";

interface SubscriptionPurchaseSuccessDialogProps {
  open: boolean;
  onContinue: () => void;
}

function subscribeToClientRender() {
  return () => undefined;
}

export function SubscriptionPurchaseSuccessDialog({
  open,
  onContinue,
}: SubscriptionPurchaseSuccessDialogProps) {
  const t = useT();
  const { locale } = useLocale();
  const mounted = useSyncExternalStore(
    subscribeToClientRender,
    () => true,
    () => false,
  );

  if (!open || !mounted) return null;

  const title = formatSuperWaterText(locale, t("pricing.purchaseSuccessTitle"));
  const description = formatSuperWaterText(locale, t("pricing.purchaseSuccessDescription"));
  const continueLabel = formatSuperWaterText(locale, t("pricing.purchaseSuccessContinue"));
  const usesSuperWater = canUseSuperWater(locale);

  return createPortal(
    <div
      aria-describedby="subscription-purchase-success-description"
      aria-labelledby="subscription-purchase-success-title"
      aria-modal="true"
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/55 p-5"
      role="alertdialog"
    >
      <section className="animate-screen-pop w-full max-w-sm rounded-3xl bg-brand px-7 py-8 text-center text-brand-foreground shadow-lg">
        <h2
          id="subscription-purchase-success-title"
          className={cn("text-3xl font-bold leading-tight", usesSuperWater && "font-super-water")}
        >
          {title}
        </h2>
        <p
          id="subscription-purchase-success-description"
          className={cn("mt-4 text-base font-semibold leading-6", usesSuperWater && "font-super-water")}
        >
          {description}
        </p>
        <Button
          autoFocus
          type="button"
          onClick={onContinue}
          className={cn(
            "mt-8 h-14 w-full rounded-full bg-white text-brand hover:bg-white/90",
            "text-xl font-bold",
            usesSuperWater && "font-super-water",
          )}
        >
          {continueLabel}
        </Button>
      </section>
    </div>,
    document.body,
  );
}
