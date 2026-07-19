"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";

interface PlanBadgeProps {
  plan?: SubscriptionPlan;
  className?: string;
  variant?: "default" | "mobile-game";
}

const PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-border bg-background-muted text-foreground-secondary",
  basic: "border-blue-200 bg-blue-50 text-blue-700",
  pro: "border-amber-200 bg-amber-50 text-amber-700",
};

const MOBILE_GAME_PLAN_STYLES: Record<SubscriptionPlan, string> = {
  free: "border-slate-400/45 bg-[linear-gradient(135deg,#4b5563_0%,#111827_52%,#374151_100%)] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(0,0,0,0.35)]",
  basic: "border-yellow-100/75 bg-gradient-to-r from-yellow-300 via-yellow-400 to-orange-500 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_2px_6px_rgba(249,115,22,0.42)]",
  pro: "border-yellow-100/75 bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.58),0_2px_6px_rgba(249,115,22,0.48)]",
};

export function PlanBadge({ plan, className, variant = "default" }: PlanBadgeProps) {
  const t = useT();
  const { entitlements, isLoading } = useSubscription();
  const effectivePlan = plan ?? entitlements?.effectivePlan ?? "free";

  if (isLoading) {
    return (
      <span
        className={cn(
          variant === "mobile-game"
            ? "inline-flex h-9 min-w-[4.75rem] items-center justify-center rounded-md border border-slate-400/45 bg-[linear-gradient(135deg,#4b5563_0%,#111827_52%,#374151_100%)] text-slate-100"
            : "inline-flex items-center justify-center rounded-full border border-border bg-background-muted px-2 py-0.5",
          className,
        )}
      >
        <Loader2 className={cn("animate-spin", variant === "mobile-game" ? "size-4 text-yellow-200" : "size-3 text-foreground-muted")} aria-hidden="true" />
      </span>
    );
  }

  if (variant === "mobile-game") {
    const isPaid = effectivePlan !== "free";

    return (
      <span
        data-mobile-membership-badge
        className={cn(
          "relative inline-flex h-9 min-w-[4.75rem] items-center justify-center gap-1.5 overflow-hidden rounded-md border px-2 text-[11px] font-bold leading-none transition-transform active:scale-[0.96]",
          MOBILE_GAME_PLAN_STYLES[effectivePlan],
          isPaid && "motion-safe:animate-[pulse_3s_ease-in-out_infinite]",
          className,
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-x-1 top-0 h-px bg-white/60", !isPaid && "bg-slate-100/35")} />
        <Crown className="relative size-3.5 shrink-0" strokeWidth={2.4} aria-hidden="true" />
        <span className="relative">{t(`pricing.${effectivePlan}`)}</span>
        {effectivePlan === "pro" ? (
          <Sparkles className="relative size-3 shrink-0 text-white/85 motion-safe:animate-pulse" aria-hidden="true" />
        ) : null}
      </span>
    );
  }

  return (
    <Badge className={cn("text-xs font-semibold", PLAN_STYLES[effectivePlan], className)}>
      {t(`pricing.${effectivePlan}`)}
    </Badge>
  );
}
