"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

interface SubscriptionRestrictionSurfaceProps {
  children: ReactNode;
  className?: string;
  labelledBy: string;
}

/**
 * Shared art-directed frame for every paid-feature restriction. Its fixed
 * portrait ratio keeps the supplied ticket artwork intact on all viewports.
 */
export function SubscriptionRestrictionSurface({
  children,
  className,
  labelledBy,
}: SubscriptionRestrictionSurfaceProps) {
  const { locale } = useLocale();
  const backgroundImage = locale === "tr"
    ? "/subscription-restrictions/subscription-restriction-tr.png"
    : "/subscription-restrictions/subscription-restriction-en.png";

  return (
    <section
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cn(
        "relative isolate aspect-[971/1620] w-[min(92vw,55.15dvh)] overflow-hidden rounded-[clamp(1.65rem,5vw,3rem)] bg-[#ff5c08] bg-cover bg-top shadow-lg",
        className,
      )}
      role="dialog"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* The artwork is decorative. This gradient reserves its lower half for readable actions. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#421200]/78 via-[#8a2600]/30 to-transparent" aria-hidden="true" />
      {children}
    </section>
  );
}
