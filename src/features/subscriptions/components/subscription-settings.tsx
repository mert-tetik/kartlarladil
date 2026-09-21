"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { createCustomerPortalAction } from "@/features/subscriptions/subscription-actions";
import { useT } from "@/i18n/locale-provider";
import { useGooglePlayBilling } from "@/features/subscriptions/use-google-play-billing";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useAppMessage } from "@/components/app-message-provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

interface SubscriptionSettingsProps {
  plan: SubscriptionPlan;
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-border bg-background-muted text-foreground-secondary",
  basic: "border-blue-200 bg-blue-50 text-blue-700",
  pro: "border-amber-200 bg-amber-50 text-amber-700",
};

export function SubscriptionSettings({ plan }: SubscriptionSettingsProps) {
  const t = useT();
  const isPaid = plan !== "free";

  return (
    <div className="rounded-lg border border-border bg-background-card p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("account.subscription.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-secondary">{t("account.subscription.description")}</p>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
              PLAN_STYLES[plan],
            )}
          >
            {t(`pricing.${plan}`)}
          </span>
          {isPaid ? (
            <span className="text-sm text-foreground-muted">{t("account.subscription.cancelDescription")}</span>
          ) : (
            <span className="text-sm text-foreground-muted">{t("account.subscription.noActive")}</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href="/account/subscription" className={buttonClassName("secondary", "sm")}>
            {t("account.subscription.viewDetails")}
          </Link>
          {isPaid ? <CustomerPortalButton /> : null}
          <RestorePurchasesButton />
        </div>
      </div>
    </div>
  );
}

function CustomerPortalButton() {
  const t = useT();
  const { showMessage } = useAppMessage();
  const [state, formAction, pending] = useActionState(createCustomerPortalAction, {
    status: "idle" as const,
    message: "",
  });

  useEffect(() => {
    if (state.status === "error" && state.message) {
      showMessage(state.message, "error");
    }

    if (state.status === "success" && state.customerPortalUrl) {
      const portalWindow = window.open(state.customerPortalUrl, "_blank", "noopener,noreferrer");
      if (!portalWindow) {
        window.location.assign(state.customerPortalUrl);
      }
    }
  }, [showMessage, state]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" size="md" disabled={pending}>
        {pending ? t("common.loading") : t("account.subscription.manage")}
      </Button>
    </form>
  );
}

function RestorePurchasesButton() {
  const t = useT();
  const { isSupported, isLoading, restorePurchases } = useGooglePlayBilling();
  const { refreshEntitlements } = useSubscription();
  const { showMessage } = useAppMessage();

  if (!isSupported) {
    return null;
  }

  async function handleRestore() {
    try {
      await restorePurchases();
      await refreshEntitlements();
      showMessage(t("account.subscription.restoreSuccess"), "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : t("account.subscription.restoreError"), "error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={isLoading}
        onClick={() => void handleRestore()}
      >
        {isLoading ? t("common.loading") : t("account.subscription.restorePurchases")}
      </Button>
    </div>
  );
}
