"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

interface SubscriptionSettingsProps {
  plan: SubscriptionPlan;
  customerPortalUrl: string | null;
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-slate-200 bg-slate-100 text-slate-600",
  basic: "border-blue-200 bg-blue-50 text-blue-700",
  pro: "border-amber-200 bg-amber-50 text-amber-700",
};

export function SubscriptionSettings({ plan, customerPortalUrl }: SubscriptionSettingsProps) {
  const t = useT();
  const isPaid = plan !== "free";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{t("account.subscription.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t("account.subscription.description")}</p>
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
            <span className="text-sm text-slate-500">{t("account.subscription.cancelDescription")}</span>
          ) : (
            <span className="text-sm text-slate-500">{t("account.subscription.noActive")}</span>
          )}
        </div>

        {isPaid ? (
          <div className="mt-4">
            {customerPortalUrl ? (
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
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
