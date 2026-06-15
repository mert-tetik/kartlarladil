"use client";

import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

interface PlanBadgeProps {
  plan?: SubscriptionPlan;
  className?: string;
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-slate-200 bg-slate-100 text-slate-600",
  basic: "border-blue-200 bg-blue-50 text-blue-700",
  pro: "border-amber-200 bg-amber-50 text-amber-700",
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  const t = useT();
  const { entitlements } = useSubscription();
  const effectivePlan = plan ?? entitlements?.effectivePlan ?? "free";

  return (
    <Badge className={cn("text-xs font-semibold", PLAN_STYLES[effectivePlan], className)}>
      {t(`pricing.${effectivePlan}`)}
    </Badge>
  );
}
