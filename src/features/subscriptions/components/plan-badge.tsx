"use client";

import { Crown, Loader2 } from "lucide-react";
import { useId } from "react";
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

const MOBILE_GAME_PLAN_TEXT_STYLES: Record<SubscriptionPlan, string> = {
  free: "text-white/65",
  basic: "bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 bg-clip-text text-transparent",
  pro: "bg-gradient-to-r from-fuchsia-400 via-pink-500 to-violet-500 bg-clip-text text-transparent",
};

export function PlanBadge({ plan, className, variant = "default" }: PlanBadgeProps) {
  const t = useT();
  const { entitlements, isLoading } = useSubscription();
  const gradientId = useId().replace(/:/g, "");
  const effectivePlan = plan ?? entitlements?.effectivePlan ?? "free";

  if (isLoading) {
    return (
      <span
        className={cn(
          variant === "mobile-game"
            ? "inline-flex h-9 min-w-[4.75rem] items-center justify-center rounded-md text-white/65"
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
    const gradientStops =
      effectivePlan === "pro"
        ? ["#e879f9", "#ec4899", "#8b5cf6"]
        : ["#fde047", "#f59e0b", "#f97316"];

    return (
      <span
        data-mobile-membership-badge
        className={cn(
          "relative inline-flex h-9 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-md px-1 text-[11px] font-bold leading-none transition-transform active:scale-[0.96]",
          className,
        )}
      >
        {isPaid ? (
          <svg aria-hidden="true" className="absolute size-0">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor={gradientStops[0]} />
                <stop offset="55%" stopColor={gradientStops[1]} />
                <stop offset="100%" stopColor={gradientStops[2]} />
              </linearGradient>
            </defs>
          </svg>
        ) : null}
        <Crown
          className={cn("size-3.5 shrink-0", !isPaid && MOBILE_GAME_PLAN_TEXT_STYLES.free)}
          stroke={isPaid ? `url(#${gradientId})` : "currentColor"}
          strokeWidth={2.4}
          aria-hidden="true"
        />
        <span className={MOBILE_GAME_PLAN_TEXT_STYLES[effectivePlan]}>{t(`pricing.${effectivePlan}`)}</span>
      </span>
    );
  }

  return (
    <Badge className={cn("text-xs font-semibold", PLAN_STYLES[effectivePlan], className)}>
      {t(`pricing.${effectivePlan}`)}
    </Badge>
  );
}
