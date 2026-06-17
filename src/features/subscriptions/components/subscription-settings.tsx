"use client";

import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

interface SubscriptionSettingsProps {
  plan: SubscriptionPlan;
  customerPortalUrl: string | null;
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-border bg-background-muted text-foreground-secondary",
  basic: "border-blue-200 bg-blue-50 text-blue-700",
  pro: "border-amber-200 bg-amber-50 text-amber-700",
};

export function SubscriptionSettings({ plan, customerPortalUrl }: SubscriptionSettingsProps) {
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
          {isPaid ? (
            customerPortalUrl ? (
              <a
                href={customerPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClassName("secondary", "md")}
              >
                {t("account.subscription.cancel")}
              </a>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {t("account.subscription.customerPortalMissing")}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
